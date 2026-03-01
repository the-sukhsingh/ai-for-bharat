import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { publishToX } from "@/lib/publish-x";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * API route for publishing content to X (Twitter)
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
    const { accountId, content, draftId, imageUrl } = body;

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

    // Get image URL from draft if not provided
    let finalImageUrl = imageUrl;
    if (!finalImageUrl && draftId) {
      const draft = await convex.query(api.contentDrafts.getContentDraftById, {
        draftId: draftId as Id<"contentDrafts">,
        requestingUserId: user._id,
      });

      if (draft?.imageStorageId) {
        // Get the image URL from storage
        finalImageUrl = await convex.query(api.ai_tools.getStorageUrl, {
          storageId: draft.imageStorageId,
        });
      }
    }

    // Use shared publishing logic
    const result = await publishToX({
      userId: user._id,
      accountId: accountId as Id<"socialAccounts">,
      content,
      imageUrl: finalImageUrl,
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
      platform: 'x',
      tweetUrl: result.postUrl,
    });

  } catch (error) {
    console.error("X publish error:", error);

    return NextResponse.json(
      { error: "Failed to publish to X" },
      { status: 500 }
    );
  }
}
