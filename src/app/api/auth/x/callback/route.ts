import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * X (Twitter) OAuth 2.0 Flow - Step 2: Handle Callback
 * 
 * This endpoint receives the authorization code from X,
 * exchanges it for an access token using PKCE, and stores the account information.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('X OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=x_auth_failed&reason=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=missing_parameters`
      );
    }

    // Verify state and extract user email
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=invalid_state`
      );
    }

    // Verify session matches state
    const session = await auth();
    if (!session?.user?.email || session.user.email !== stateData.email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=session_mismatch`
      );
    }

    // Exchange code for access token using PKCE
    const X_CLIENT_ID = process.env.X_CLIENT_ID;
    const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`;

    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=oauth_not_configured`
      );
    }

    // Get code verifier from cookie (it was set in the frontend)
    // Note: In production, you'd retrieve this from a secure session storage
    // For now, we'll pass it through the state parameter or use a session
    const codeVerifier = stateData.codeVerifier;

    if (!codeVerifier) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=missing_code_verifier`
      );
    }

    // Exchange authorization code for access token
    const authString = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('X token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // Usually 7200 seconds (2 hours)

    // Get user profile information from X API
    const profileResponse = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url,verified,subscription_type',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!profileResponse.ok) {
      console.error('Failed to fetch X profile');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=profile_fetch_failed`
      );
    }
    const profileData = await profileResponse.json();
    const userData = profileData.data;

    // Get user from Convex
    const user = await convex.query(api.users.getUserByEmail, {
      email: session.user.email
    });

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=user_not_found`
      );
    }

    // Store the X account in Convex
    const tokenExpiresAt = Date.now() + (expiresIn * 1000);
    
    await convex.mutation(api.users.linkSocialAccount, {
      userId: user._id,
      platform: 'x',
      accountId: userData.id,
      username: userData.username,
      displayName: userData.name,
      accessToken: accessToken,
      refreshToken: refreshToken,
      subType: userData.subscription_type, // e.g., "premium" or "none"
      tokenExpiresAt: tokenExpiresAt,
    });

    // Redirect back to profile with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/profile?success=x_connected`
    );
  } catch (error) {
    console.error("X callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=unexpected_error`
    );
  }
}
