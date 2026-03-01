import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { publishToLinkedIn } from "@/lib/publish-linkedin";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * API route for publishing content to LinkedIn
 * Handles authentication and delegates to shared publishing logic
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountId, content, draftId } = body;

    if (!accountId || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user
    const user = await convex.query(api.users.getUserByEmail, {
      email: session.user.email,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.plan === 'free') {
      return NextResponse.json(
        { error: "Plan limit reached. Post publishing is only available on Basic and Pro plans. Please upgrade your plan." },
        { status: 403 }
      );
    }

    // Check plan limits
    const planCheck = await convex.query(api.plans.checkPlanLimits, {
      userId: user._id,
      feature: "posts",
    });

    if (!planCheck.allowed) {
      return NextResponse.json(
        { error: `Plan limit reached. Your ${planCheck.plan} plan allows up to ${planCheck.limit} posts this month. Please upgrade your plan.` },
        { status: 403 }
      );
    }

    // Use shared publishing logic
    const result = await publishToLinkedIn({
      userId: user._id,
      accountId: accountId as Id<"socialAccounts">,
      content,
      draftId: draftId ? (draftId as Id<"contentDrafts">) : undefined,
      convexContext: {
        query: convex.query.bind(convex),
        mutation: convex.mutation.bind(convex),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      platform: 'linkedin',
      postUrl: result.postUrl,
    });

  } catch (error) {
    console.error("LinkedIn publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish to LinkedIn" },
      { status: 500 }
    );
  }
}

