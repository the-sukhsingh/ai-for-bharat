import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Create or update user (upsert pattern for OAuth)
export const upsertUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        imageUrl: args.imageUrl,
      });


      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      createdAt: Date.now(),
      plan: "free"
    });


    return userId;
  },
});

// Get user by email
export const getUserByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
      imageUrl: v.optional(v.string()),
      createdAt: v.number(),
      plan: v.union(v.literal("free"), v.literal("basic"), v.literal("pro")),
      subscriptionEndDate: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();


  },
});

// Get user by ID
export const getUserById = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
      imageUrl: v.optional(v.string()),
      createdAt: v.number(),
      plan: v.union(v.literal("free"), v.literal("basic"), v.literal("pro")),
      subscriptionEndDate: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});



// Update user profile
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;

    await ctx.db.patch(args.userId, updates);
    return null;
  },
});



// Delete user
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.userId);
    return null;
  },
});

// Link a social media account
export const linkSocialAccount = mutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("linkedin"), v.literal("x")),
    accountId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    subType: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  returns: v.id("socialAccounts"),
  handler: async (ctx, args) => {
    // Check if account already exists for this user and platform
    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", args.platform)
      )
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing account
      await ctx.db.patch(existing._id, {
        username: args.username,
        displayName: args.displayName,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        subType: args.subType,
        isActive: true,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new social account link
    const accountId = await ctx.db.insert("socialAccounts", {
      userId: args.userId,
      platform: args.platform,
      accountId: args.accountId,
      username: args.username,
      displayName: args.displayName,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      isActive: true,
      subType: args.subType,
      createdAt: now,
      updatedAt: now,
    });

    return accountId;
  },
});

// Unlink a social media account
export const unlinkSocialAccount = mutation({
  args: {
    accountId: v.id("socialAccounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.accountId);
    return null;
  },
});

// Update social account status (activate/deactivate)
export const updateSocialAccountStatus = mutation({
  args: {
    userId: v.id("users"),
    accountId: v.id("socialAccounts"),
    isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Social account not found");
    }

    if (account.userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.accountId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    // If deactivating, cancel all pending scheduled posts for this account
    if (!args.isActive) {
      const schedules = await ctx.db
        .query("scheduledPosts")
        .withIndex("by_account", (q) => q.eq("socialAccountId", args.accountId))
        .collect();

      const pendingSchedules = schedules.filter(s => s.status === "pending");

      for (const schedule of pendingSchedules) {
        await ctx.db.patch(schedule._id, {
          status: "cancelled",
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

// Update social account tokens (for token refresh)
export const updateSocialAccountTokens = mutation({
  args: {
    accountId: v.id("socialAccounts"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {
      accessToken: args.accessToken,
      updatedAt: Date.now(),
    };

    if (args.refreshToken !== undefined) {
      updates.refreshToken = args.refreshToken;
    }
    if (args.tokenExpiresAt !== undefined) {
      updates.tokenExpiresAt = args.tokenExpiresAt;
    }

    await ctx.db.patch(args.accountId, updates);
    return null;
  },
});

// Internal version for use in actions
export const updateSocialAccountTokensInternal = internalMutation({
  args: {
    accountId: v.id("socialAccounts"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {
      accessToken: args.accessToken,
      updatedAt: Date.now(),
    };

    if (args.refreshToken !== undefined) {
      updates.refreshToken = args.refreshToken;
    }
    if (args.tokenExpiresAt !== undefined) {
      updates.tokenExpiresAt = args.tokenExpiresAt;
    }

    await ctx.db.patch(args.accountId, updates);
    return null;
  },
});

// Get all social accounts for a user
export const getSocialAccounts = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("socialAccounts"),
      _creationTime: v.number(),
      userId: v.id("users"),
      platform: v.union(
        v.literal("linkedin"),
        v.literal("x")
      ),
      accountId: v.string(),
      username: v.string(),
      displayName: v.optional(v.string()),
      isActive: v.boolean(),
      tokenExpiresAt: v.optional(v.number()),
      subType: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Return accounts without sensitive tokens
    return accounts.map(account => ({
      _id: account._id,
      _creationTime: account._creationTime,
      userId: account.userId,
      platform: account.platform,
      accountId: account.accountId,
      username: account.username,
      displayName: account.displayName,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      subType: account.subType,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  },
});

// Get a specific social account with tokens (internal use for publishing)
export const getSocialAccountWithTokens = query({
  args: { accountId: v.id("socialAccounts") },
  returns: v.union(
    v.object({
      _id: v.id("socialAccounts"),
      _creationTime: v.number(),
      userId: v.id("users"),
      platform: v.union(
        v.literal("linkedin"),
        v.literal("x")
      ),
      accountId: v.string(),
      username: v.string(),
      displayName: v.optional(v.string()),
      accessToken: v.string(),
      refreshToken: v.optional(v.string()),
      tokenExpiresAt: v.optional(v.number()),
      subType: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

// Get a social account by ID (internal use for cron jobs)
export const getSocialAccountById = internalQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.union(
    v.object({
      _id: v.id("socialAccounts"),
      _creationTime: v.number(),
      userId: v.id("users"),
      platform: v.union(
        v.literal("linkedin"),
        v.literal("x")
      ),
      accountId: v.string(),
      username: v.string(),
      displayName: v.optional(v.string()),
      accessToken: v.string(),
      refreshToken: v.optional(v.string()),
      tokenExpiresAt: v.optional(v.number()),
      subType: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});



// Get X (Twitter) connection status for a user
export const getXConnection = query({
  args: { userId: v.id("users") },
  returns: v.object({
    connected: v.boolean(),
    accountName: v.optional(v.string()),
    subType: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", "x")
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      accountName: account.username,
      subType: account.subType,
    };
  },
});

// Get LinkedIn connection status for a user
export const getLinkedInConnection = query({
  args: { userId: v.id("users") },
  returns: v.object({
    connected: v.boolean(),
    accountName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", "linkedin")
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      accountName: account.displayName || account.username,
    };
  },
});
