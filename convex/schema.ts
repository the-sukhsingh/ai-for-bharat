import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Users table - stores user information from Google OAuth
    users: defineTable({
        email: v.string(),
        name: v.string(),
        imageUrl: v.optional(v.string()),
        createdAt: v.number(),
        plan: v.union(v.literal("free"), v.literal("basic"), v.literal("pro")),
        subscriptionEndDate: v.optional(v.number()),
    }).index("by_email", ["email"]),

    chats: defineTable({
        userId: v.id("users"),
        title: v.string(),
        type: v.union(v.literal("contentDraft"), v.literal("socialScript")),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_user_type", ["userId", "type"]),

    messages: defineTable({
        chatId: v.id("chats"),
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
        createdAt: v.number(),
        draftId: v.optional(v.id("contentDrafts")),

    }).index("by_chatId", ["chatId"])
        .index("by_chat_created", ["chatId", "createdAt"]),



    // Social Accounts - stores linked social media accounts for publishing
    socialAccounts: defineTable({
        userId: v.id("users"),
        platform: v.union(
            v.literal("linkedin"),
            v.literal("x")
        ),
        accountId: v.string(), // Platform-specific user/account ID
        username: v.string(),
        displayName: v.optional(v.string()),
        accessToken: v.string(),
        refreshToken: v.optional(v.string()),
        tokenExpiresAt: v.optional(v.number()),
        subType: v.optional(v.string()), // e.g., X subscription type
        isActive: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_user_platform", ["userId", "platform"])
        .index("by_platform", ["platform"]),

    // Content drafts - stores generated content for various platforms
    contentDrafts: defineTable({
        userId: v.id("users"),
        chatId: v.optional(v.id("chats")),
        title: v.string(),
        originalIdea: v.string(),
        contextSources: v.optional(v.array(v.object({
            type: v.union(
                v.literal("github_repo"),
                v.literal("github_commits"),
                v.literal("url"),
                v.literal("text"),
                v.literal("other")
            ),
            data: v.string(),
        }))),
        platforms: v.array(v.object({
            platform: v.union(
                v.literal("twitter"),
                v.literal("linkedin"),
                v.literal("blog")
            ),
            content: v.string(),
        })),
        tone: v.optional(v.union(
            v.literal("casual"),
            v.literal("technical"),
            v.literal("storytelling"),
            v.literal("professional"),
        )),
        imageStorageId: v.optional(v.id("_storage")),
        status: v.union(
            v.literal("draft"),
            v.literal("edited"),
            v.literal("published"),
            v.literal("archived")
        ),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_user_status", ["userId", "status"]),

    // Thumbnails - stores generated thumbnails
    thumbnails: defineTable({
        userId: v.id("users"),
        prompt: v.string(),
        imageStorageId: v.id("_storage"),
        mimeType: v.string(),
        hasMainImage: v.boolean(),
        hasTemplate: v.boolean(),
        referenceCount: v.number(),
        createdAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_user_created", ["userId", "createdAt"]),



    // Social Scripts - generated content for Instagram reels and YouTube videos
    socialScripts: defineTable({
        userId: v.id("users"),
        title: v.string(),
        platform: v.union(v.literal("instagram"), v.literal("youtube")),
        hook: v.string(),
        scriptSections: v.array(v.object({
            heading: v.string(),
            content: v.string(),
            duration: v.optional(v.number()), // in seconds
        })),
        cta: v.string(),
        hashtags: v.optional(v.array(v.string())),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_platform", ["platform"])
        .index("by_user_created", ["userId", "createdAt"]),

    // Publish Logs - tracks publishing activities
    publishLogs: defineTable({
        userId: v.id("users"),
        draftId: v.optional(v.id("contentDrafts")),
        socialAccountId: v.id("socialAccounts"),
        platform: v.union(
            v.literal("linkedin"),
            v.literal("x")
        ),
        status: v.union(
            v.literal("success"),
            v.literal("failed")
        ),
        postId: v.optional(v.string()), // Platform-specific post ID
        postUrl: v.optional(v.string()), // URL to the published post
        errorMessage: v.optional(v.string()),
        publishedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_draft", ["draftId"])
        .index("by_account", ["socialAccountId"])
        .index("by_user_date", ["userId", "publishedAt"]),

    // Scheduled Posts - stores posts scheduled for future publishing
    scheduledPosts: defineTable({
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
        scheduledFor: v.number(), // Unix timestamp
        status: v.union(
            v.literal("pending"),
            v.literal("published"),
            v.literal("failed"),
            v.literal("cancelled")
        ),
        errorMessage: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_user", ["userId"])
        .index("by_draft", ["draftId"])
        .index("by_account", ["socialAccountId"])
        .index("by_status_scheduled", ["status", "scheduledFor"])
        .index("by_user_status", ["userId", "status"]),
});
