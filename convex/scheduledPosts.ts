import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const schedulePost = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        socialAccountId: v.id("socialAccounts"),
        platform: v.union(
            v.literal("linkedin"),
            v.literal("x"),
            v.literal("twitter")
        ),
        content: v.string(),
        imageStorageId: v.optional(v.id("_storage")),
        scheduledFor: v.number(),
    },
    returns: v.id("scheduledPosts"),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Draft not found");
        }

        // Use provided imageStorageId or get it from the draft
        const imageStorageId = args.imageStorageId || draft.imageStorageId;

        const account = await ctx.db.get(args.socialAccountId);
        if (!account) {
            throw new Error("Social account not found");
        }

        if (account.userId !== args.userId) {
            throw new Error("Social account does not belong to user");
        }

        const now = Date.now();
        if (args.scheduledFor <= now) {
            throw new Error("Scheduled time must be in the future");
        }

        const scheduleId = await ctx.db.insert("scheduledPosts", {
            userId: args.userId,
            draftId: args.draftId,
            socialAccountId: args.socialAccountId,
            platform: args.platform,
            content: args.content,
            imageStorageId: args.imageStorageId,
            scheduledFor: args.scheduledFor,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        });

        // Schedule the post to be published at the specified time
        await ctx.scheduler.runAt(args.scheduledFor, internal.scheduledPosts.publishScheduledPost, {
            scheduleId: scheduleId,
        });

        return scheduleId;
    },
});

export const updateScheduledPost = mutation({
    args: {
        userId: v.id("users"),
        scheduleId: v.id("scheduledPosts"),
        scheduledFor: v.optional(v.number()),
        content: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            throw new Error("Scheduled post not found");
        }

        if (schedule.userId !== args.userId) {
            throw new Error("Unauthorized");
        }

        if (schedule.status !== "pending") {
            throw new Error("Cannot update post that is not pending");
        }

        const updates: Record<string, any> = {
            updatedAt: Date.now(),
        };

        if (args.scheduledFor !== undefined) {
            if (args.scheduledFor <= Date.now()) {
                throw new Error("Scheduled time must be in the future");
            }
            updates.scheduledFor = args.scheduledFor;
            
            // Reschedule the post to the new time
            await ctx.scheduler.runAt(args.scheduledFor, internal.scheduledPosts.publishScheduledPost, {
                scheduleId: args.scheduleId,
            });
        }

        if (args.content !== undefined) {
            updates.content = args.content;
        }

        await ctx.db.patch(args.scheduleId, updates);
        return null;
    },
});

export const cancelScheduledPost = mutation({
    args: {
        userId: v.id("users"),
        scheduleId: v.id("scheduledPosts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            throw new Error("Scheduled post not found");
        }

        if (schedule.userId !== args.userId) {
            throw new Error("Unauthorized");
        }

        if (schedule.status !== "pending") {
            throw new Error("Cannot cancel post that is not pending");
        }

        await ctx.db.patch(args.scheduleId, {
            status: "cancelled",
            updatedAt: Date.now(),
        });

        return null;
    },
});

export const deleteScheduledPost = mutation({
    args: {
        userId: v.id("users"),
        scheduleId: v.id("scheduledPosts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule) {
            throw new Error("Scheduled post not found");
        }

        if (schedule.userId !== args.userId) {
            throw new Error("Unauthorized");
        }

        await ctx.db.delete(args.scheduleId);
        return null;
    },
});

export const getUserScheduledPosts = query({
    args: {
        userId: v.id("users"),
        status: v.optional(v.union(
            v.literal("pending"),
            v.literal("published"),
            v.literal("failed"),
            v.literal("cancelled")
        )),
    },
    returns: v.array(v.object({
        _id: v.id("scheduledPosts"),
        _creationTime: v.number(),
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        socialAccountId: v.id("socialAccounts"),
        platform: v.union(
            v.literal("linkedin"),
            v.literal("x"),
            v.literal("twitter")
        ),
        content: v.string(),
        scheduledFor: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("published"),
            v.literal("failed"),
            v.literal("cancelled")
        ),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        let query = ctx.db
            .query("scheduledPosts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId));

        const results = await query.collect();

        if (args.status) {
            return results.filter(s => s.status === args.status);
        }

        return results;
    },
});

export const getDraftScheduledPosts = query({
    args: {
        draftId: v.id("contentDrafts"),
    },
    returns: v.array(v.object({
        _id: v.id("scheduledPosts"),
        _creationTime: v.number(),
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        socialAccountId: v.id("socialAccounts"),
        platform: v.union(
            v.literal("linkedin"),
            v.literal("x"),
            v.literal("twitter")
        ),
        content: v.string(),
        scheduledFor: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("published"),
            v.literal("failed"),
            v.literal("cancelled")
        ),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Draft not found");
        }

        const schedules = await ctx.db
            .query("scheduledPosts")
            .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
            .collect();

        return schedules;
    },
});

/**
 * Internal action to publish a scheduled post
 */
export const publishScheduledPost = internalAction({
    args: {
        scheduleId: v.id("scheduledPosts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Get the scheduled post
        const schedule = await ctx.runQuery(internal.scheduledPosts.getScheduledPostById, {
            scheduleId: args.scheduleId,
        });

        if (!schedule) {
            console.error(`Scheduled post ${args.scheduleId} not found`);
            return null;
        }

        // Check if still pending
        if (schedule.status !== "pending") {
            console.log(`Scheduled post ${args.scheduleId} is not pending (status: ${schedule.status})`);
            return null;
        }

        try {
            // Publish to the platform using internal actions
            const platformKey = schedule.platform === "twitter" ? "x" : schedule.platform;
            
            let result;
            if (platformKey === "x") {
                result = await ctx.runAction(internal.publish.publishToX, {
                    userId: schedule.userId,
                    accountId: schedule.socialAccountId,
                    content: schedule.content,
                    draftId: schedule.draftId,
                });
            } else if (platformKey === "linkedin") {
                result = await ctx.runAction(internal.publish.publishToLinkedIn, {
                    userId: schedule.userId,
                    accountId: schedule.socialAccountId,
                    content: schedule.content,
                    draftId: schedule.draftId,
                });
            } else {
                await ctx.runMutation(internal.scheduledPosts.markScheduledPostAsFailed, {
                    scheduleId: args.scheduleId,
                    errorMessage: "Unsupported platform",
                });
                return null;
            }

            if (result.success) {
                await ctx.runMutation(internal.scheduledPosts.markScheduledPostAsPublished, {
                    scheduleId: args.scheduleId,
                });
                console.log(`Successfully published scheduled post ${args.scheduleId}`);
            } else {
                await ctx.runMutation(internal.scheduledPosts.markScheduledPostAsFailed, {
                    scheduleId: args.scheduleId,
                    errorMessage: result.error || "Failed to publish",
                });
                console.error(`Failed to publish scheduled post ${args.scheduleId}:`, result.error);
            }
        } catch (error) {
            await ctx.runMutation(internal.scheduledPosts.markScheduledPostAsFailed, {
                scheduleId: args.scheduleId,
                errorMessage: error instanceof Error ? error.message : "Unknown error",
            });
            console.error(`Error processing scheduled post ${args.scheduleId}:`, error);
        }

        return null;
    },
});

/**
 * Internal query to get a scheduled post by ID
 */
export const getScheduledPostById = internalQuery({
    args: {
        scheduleId: v.id("scheduledPosts"),
    },
    returns: v.union(
        v.object({
            _id: v.id("scheduledPosts"),
            _creationTime: v.number(),
            userId: v.id("users"),
            draftId: v.id("contentDrafts"),
            socialAccountId: v.id("socialAccounts"),
            platform: v.union(
                v.literal("linkedin"),
                v.literal("x"),
                v.literal("twitter")
            ),
            content: v.string(),
            scheduledFor: v.number(),
            status: v.union(
                v.literal("pending"),
                v.literal("published"),
                v.literal("failed"),
                v.literal("cancelled")
            ),
            errorMessage: v.optional(v.string()),
            createdAt: v.number(),
            updatedAt: v.number(),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        return await ctx.db.get(args.scheduleId);
    },
});

export const markScheduledPostAsPublished = internalMutation({
    args: {
        scheduleId: v.id("scheduledPosts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.scheduleId, {
            status: "published",
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const markScheduledPostAsFailed = internalMutation({
    args: {
        scheduleId: v.id("scheduledPosts"),
        errorMessage: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.scheduleId, {
            status: "failed",
            errorMessage: args.errorMessage,
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const cancelAccountScheduledPosts = mutation({
    args: {
        userId: v.id("users"),
        socialAccountId: v.id("socialAccounts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const account = await ctx.db.get(args.socialAccountId);
        if (!account) {
            throw new Error("Social account not found");
        }

        if (account.userId !== args.userId) {
            throw new Error("Unauthorized");
        }

        const schedules = await ctx.db
            .query("scheduledPosts")
            .withIndex("by_account", (q) => q.eq("socialAccountId", args.socialAccountId))
            .collect();

        const pendingSchedules = schedules.filter(s => s.status === "pending");

        for (const schedule of pendingSchedules) {
            await ctx.db.patch(schedule._id, {
                status: "cancelled",
                updatedAt: Date.now(),
            });
        }

        return null;
    },
});
