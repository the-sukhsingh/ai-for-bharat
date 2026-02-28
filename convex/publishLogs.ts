import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Log a publishing activity
 */
export const logPublish = mutation({
  args: {
    userId: v.id("users"),
    draftId: v.optional(v.id("contentDrafts")),
    socialAccountId: v.id("socialAccounts"),
    platform: v.union(
      v.literal("linkedin"),
      v.literal("x")
    ),
    status: v.union(v.literal("success"), v.literal("failed")),
    postId: v.optional(v.string()),
    postUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("publishLogs"),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("publishLogs", {
      userId: args.userId,
      draftId: args.draftId,
      socialAccountId: args.socialAccountId,
      platform: args.platform,
      status: args.status,
      postId: args.postId,
      postUrl: args.postUrl,
      errorMessage: args.errorMessage,
      publishedAt: Date.now(),
    });

    return logId;
  },
});

/**
 * Log a publishing activity (internal version for scheduled posts)
 */
export const logPublishInternal = internalMutation({
  args: {
    userId: v.id("users"),
    draftId: v.optional(v.id("contentDrafts")),
    socialAccountId: v.id("socialAccounts"),
    platform: v.union(
      v.literal("linkedin"),
      v.literal("x")
    ),
    status: v.union(v.literal("success"), v.literal("failed")),
    postId: v.optional(v.string()),
    postUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("publishLogs"),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("publishLogs", {
      userId: args.userId,
      draftId: args.draftId,
      socialAccountId: args.socialAccountId,
      platform: args.platform,
      status: args.status,
      postId: args.postId,
      postUrl: args.postUrl,
      errorMessage: args.errorMessage,
      publishedAt: Date.now(),
    });

    return logId;
  },
});

/**
 * Get publish logs for a user
 */
export const getUserPublishLogs = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("publishLogs"),
      _creationTime: v.number(),
      userId: v.id("users"),
      draftId: v.optional(v.id("contentDrafts")),
      socialAccountId: v.id("socialAccounts"),
      platform: v.union(
        v.literal("linkedin"),
        v.literal("x")
      ),
      status: v.union(v.literal("success"), v.literal("failed")),
      postId: v.optional(v.string()),
      postUrl: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      publishedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const logs = await ctx.db
      .query("publishLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return logs;
  },
});

/**
 * Get publish logs for a specific draft
 */
export const getDraftPublishLogs = query({
  args: {
    draftId: v.id("contentDrafts"),
  },
  returns: v.array(
    v.object({
      _id: v.id("publishLogs"),
      _creationTime: v.number(),
      userId: v.id("users"),
      draftId: v.optional(v.id("contentDrafts")),
      socialAccountId: v.id("socialAccounts"),
      platform: v.union(
        v.literal("linkedin"),
        v.literal("x")
      ),
      status: v.union(v.literal("success"), v.literal("failed")),
      postId: v.optional(v.string()),
      postUrl: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      publishedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("publishLogs")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .collect();

    return logs;
  },
});

/**
 * Get publishing statistics for a user
 */
export const getPublishStats = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    totalPublished: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    byPlatform: v.object({
      x: v.number(),
      linkedin: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("publishLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const stats = {
      totalPublished: logs.length,
      successCount: logs.filter((l) => l.status === "success").length,
      failedCount: logs.filter((l) => l.status === "failed").length,
      byPlatform: {
        x: logs.filter((l) => l.platform === "x").length,
        linkedin: logs.filter((l) => l.platform === "linkedin").length,
      },
    };

    return stats;
  },
});
