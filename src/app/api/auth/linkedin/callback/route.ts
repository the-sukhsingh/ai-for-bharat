import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * LinkedIn OAuth 2.0 Flow - Step 2: Handle Callback
 * 
 * This endpoint receives the authorization code from LinkedIn,
 * exchanges it for an access token, and stores the account information.
 * 
 * Reference: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
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
      console.error('LinkedIn OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=linkedin_auth_failed&reason=${error}`
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

    // Exchange code for access token
    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=oauth_not_configured`
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // Usually 5184000 seconds (60 days)

    // Get user profile information from LinkedIn API
    // Using the v2 profile API endpoint
    const profileResponse = await fetch(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!profileResponse.ok) {
      console.error('Failed to fetch LinkedIn profile');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=profile_fetch_failed`
      );
    }

    const profileData = await profileResponse.json();

    // Get user from Convex
    const user = await convex.query(api.users.getUserByEmail, {
      email: session.user.email
    });

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=user_not_found`
      );
    }

    // Store the LinkedIn account in Convex
    const tokenExpiresAt = Date.now() + (expiresIn * 1000);
    
    await convex.mutation(api.users.linkSocialAccount, {
      userId: user._id,
      platform: 'linkedin',
      accountId: profileData.sub, // LinkedIn user ID
      username: profileData.email || profileData.name, // LinkedIn doesn't always provide username
      displayName: profileData.name,
      accessToken: accessToken,
      tokenExpiresAt: tokenExpiresAt,
    });

    // Redirect back to profile page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/profile?success=linkedin_connected`
    );

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/profile?error=unknown_error`
    );
  }
}
