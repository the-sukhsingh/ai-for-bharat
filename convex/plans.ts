import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

export const PLAN_LIMITS = {
    free: {
        posts: 0,
        thumbnails: 0,
        scripts: 0,
    },
    basic: {
        posts: 1000,
        thumbnails: 100,
        scripts: 0,
    },
    pro: {
        posts: 2000,
        thumbnails: 200,
        scripts: 100,
    },
};

// Start of current month in UTC
function getStartOfMonth() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

// Internal function to get usage stats for a user
async function getUserUsageLogic(ctx: any, userId: Id<"users">) {
    const startOfMonth = getStartOfMonth();

    // Posts published this month
    const publishLogs = await ctx.db
        .query("publishLogs")
        .withIndex("by_user_date", (q: any) =>
            q.eq("userId", userId).gte("publishedAt", startOfMonth)
        )
        .collect();

    const postsCount = publishLogs.filter((log: any) => log.status === "success").length;

    // Thumbnails generated this month
    const thumbnails = await ctx.db
        .query("thumbnails")
        .withIndex("by_user_created", (q: any) =>
            q.eq("userId", userId).gte("createdAt", startOfMonth)
        )
        .collect();
    const thumbnailsCount = thumbnails.length;

    // Scripts generated this month
    const scripts = await ctx.db
        .query("socialScripts")
        .withIndex("by_user_created", (q: any) =>
            q.eq("userId", userId).gte("createdAt", startOfMonth)
        )
        .collect();
    const scriptsCount = scripts.length;

    return {
        posts: postsCount,
        thumbnails: thumbnailsCount,
        scripts: scriptsCount,
    };
}

// Query to get usage stats for a user
export const getUserUsage = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return getUserUsageLogic(ctx, args.userId);
    },
});

export const checkPlanLimits = query({
    args: {
        userId: v.id("users"),
        feature: v.union(v.literal("posts"), v.literal("thumbnails"), v.literal("scripts")),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        const plan = user.plan || "free";
        const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

        const usage = await getUserUsageLogic(ctx, args.userId);

        const limit = limits[args.feature];
        const currentUsage = usage[args.feature];

        if (currentUsage >= limit) {
            return { allowed: false, limit, currentUsage, plan };
        }

        return { allowed: true, limit, currentUsage, plan };
    },
});

export const upgradePlan = mutation({
    args: { userId: v.id("users"), plan: v.union(v.literal("basic"), v.literal("pro")) },
    handler: async (ctx, args) => {
        // Here you would integrate with Stripe or another payment provider
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        await ctx.db.patch(args.userId, {
            plan: args.plan,
            subscriptionEndDate: now + thirtyDays
        });
    }
});

export const expirePlans = internalMutation({
    handler: async (ctx) => {
        const now = Date.now();
        // Since we don't have an index on plan or subscriptionEndDate, we filter.
        // In a production app with many users, you'd add an index for this.
        const users = await ctx.db
            .query("users")
            .filter((q) => q.neq(q.field("plan"), "free"))
            .collect();

        let expiredCount = 0;
        for (const user of users) {
            if (user.subscriptionEndDate && user.subscriptionEndDate < now) {
                await ctx.db.patch(user._id, {
                    plan: "free",
                    subscriptionEndDate: undefined
                });
                expiredCount++;
            }
        }
        console.log(`Expired ${expiredCount} plans at ${new Date(now).toISOString()}`);
    }
});
