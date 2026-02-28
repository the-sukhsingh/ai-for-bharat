import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new content draft
 */
export const createContentDraft = mutation({
    args: {
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
            v.literal("professional")
        )),
        imageStorageId: v.optional(v.id("_storage")),
    },
    returns: v.id("contentDrafts"),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const draftId = await ctx.db.insert("contentDrafts", {
            userId: args.userId,
            chatId: args.chatId,
            title: args.title,
            originalIdea: args.originalIdea,
            contextSources: args.contextSources,
            platforms: args.platforms,
            tone: args.tone,
            imageStorageId: args.imageStorageId,
            status: "draft",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return draftId;
    },
});

/**
 * Update an existing content draft
 */
export const updateContentDraft = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        title: v.optional(v.string()),
        originalIdea: v.optional(v.string()),
        platforms: v.optional(v.array(v.object({
            platform: v.union(
                v.literal("twitter"),
                v.literal("linkedin"),
                v.literal("blog")
            ),
            content: v.string(),
        }))),
        tone: v.optional(v.union(
            v.literal("casual"),
            v.literal("technical"),
            v.literal("storytelling"),
            v.literal("professional")
        )),
        imageStorageId: v.optional(v.id("_storage")),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized: You can only update your own content drafts");
        }

        const updates: any = {
            updatedAt: Date.now(),
        };

        if (args.title !== undefined) updates.title = args.title;
        if (args.originalIdea !== undefined) updates.originalIdea = args.originalIdea;
        if (args.platforms !== undefined) updates.platforms = args.platforms;
        if (args.tone !== undefined) updates.tone = args.tone;
        if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;

        await ctx.db.patch(args.draftId, updates);
        return null;
    },
});

/**
 * Update content draft status
 */
export const updateContentDraftStatus = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        status: v.union(
            v.literal("draft"),
            v.literal("edited"),
            v.literal("published"),
            v.literal("archived")
        ),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.draftId, {
            status: args.status,
            updatedAt: Date.now(),
        });
        return null;
    },
});


export const addPlatform = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        platform: v.object({
            platform: v.union(
                v.literal("twitter"),
                v.literal("linkedin"),
                v.literal("blog")
            ),
            content: v.string(),
        }),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized: You can only update your own content drafts");
        }

        const updatedPlatforms = draft.platforms ? [...draft.platforms, args.platform] : [args.platform];

        await ctx.db.patch(args.draftId, {
            platforms: updatedPlatforms,
            updatedAt: Date.now(),
        });
        return null;
    }
}
)


export const updateImageStorageId = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
        imageStorageId: v.id("_storage"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized: You can only update your own content drafts");
        }

        // Remove old image from storage if exists
        if (draft.imageStorageId) {
            await ctx.storage.delete(draft.imageStorageId);
        }

        // Update with new image storage ID
        await ctx.db.patch(args.draftId, {
            imageStorageId: args.imageStorageId,
            updatedAt: Date.now(),
        });
        return null;

    }
})

export const removeImage = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized: You can only update your own content drafts");
        }

        if (draft.imageStorageId) {
            await ctx.storage.delete(draft.imageStorageId);
        }

        await ctx.db.patch(args.draftId, {
            imageStorageId: undefined,
            updatedAt: Date.now(),
        });
        return null;
    }
})

/**
 * Delete a content draft
 */
export const deleteContentDraft = mutation({
    args: {
        userId: v.id("users"),
        draftId: v.id("contentDrafts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            throw new Error("Content draft not found");
        }

        if (draft.userId !== args.userId) {
            throw new Error("Unauthorized: You can only delete your own content drafts");
        }

        await ctx.db.delete(args.draftId);
        return null;
    },
});

/**
 * Get a single content draft by ID
 */
export const getContentDraftById = query({
    args: {
        draftId: v.id("contentDrafts"),
        requestingUserId: v.id("users"),
    },
    returns: v.union(
        v.object({
            _id: v.id("contentDrafts"),
            _creationTime: v.number(),
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
                v.literal("professional")
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
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        if (!draft) {
            return null;
        }

        // Only owner can view their drafts
        if (draft.userId !== args.requestingUserId) {
            return null;
        }

        return draft;
    },
});

/**
 * Get content draft by ID (internal version for scheduled posts)
 */
export const getContentDraftByIdInternal = internalQuery({
    args: {
        draftId: v.id("contentDrafts"),
    },
    returns: v.union(
        v.object({
            _id: v.id("contentDrafts"),
            _creationTime: v.number(),
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
                v.literal("professional")
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
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        return await ctx.db.get(args.draftId);
    },
});

/**
 * Get user's content drafts
 */
export const getUserContentDrafts = query({
    args: {
        userId: v.id("users"),
        status: v.optional(v.union(
            v.literal("draft"),
            v.literal("edited"),
            v.literal("published"),
            v.literal("archived")
        )),
    },
    returns: v.array(v.object({
        _id: v.id("contentDrafts"),
        _creationTime: v.number(),
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
            v.literal("professional")
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
    })),
    handler: async (ctx, args) => {
        if (args.status) {
            return await ctx.db
                .query("contentDrafts")
                .withIndex("by_user_status", (q) =>
                    q.eq("userId", args.userId).eq("status", args.status!)
                )
                .order("desc")
                .collect();
        }

        return await ctx.db
            .query("contentDrafts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

/**
 * Get latest content drafts
 */
export const getLatestContentDrafts = query({
    args: {
        userId: v.id("users"),
        limit: v.optional(v.number()),
    },
    returns: v.array(v.object({
        _id: v.id("contentDrafts"),
        _creationTime: v.number(),
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
            v.literal("professional")
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
    })),
    handler: async (ctx, args) => {
        const limit = args.limit || 20;
        const drafts = await ctx.db
            .query("contentDrafts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(limit);
        return drafts;
    },
});
