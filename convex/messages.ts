import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new message
export const createMessage = mutation({
    args: {
        chatId: v.id("chats"),
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
        draftId: v.optional(v.id("contentDrafts")),
    },
    returns: v.id("messages"),
    handler: async (ctx, args) => {
        const messageId = await ctx.db.insert("messages", {
            chatId: args.chatId,
            role: args.role,
            content: args.content,
            createdAt: Date.now(),
            draftId: args.draftId,
        });
        
        // Update chat's updatedAt timestamp
        await ctx.db.patch(args.chatId, {
            updatedAt: Date.now(),
        });
        
        return messageId;
    },
});

// Get a single message by ID
export const getMessage = query({
    args: { 
        userId: v.id("users"),
        messageId: v.id("messages") 
    },
    returns: v.union(
        v.object({
            _id: v.id("messages"),
            _creationTime: v.number(),
            chatId: v.id("chats"),
            role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
            content: v.string(),
            createdAt: v.number(),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) {
            return null;
        }
        
        // Verify message's chat belongs to user
        const chat = await ctx.db.get(message.chatId);
        if (!chat || chat.userId !== args.userId) {
            return null;
        }
        
        return message;
    },
});

// List all messages for a chat
export const listChatMessages = query({
    args: { 
        userId: v.id("users"),
        chatId: v.id("chats") 
    },
    returns: v.array(
        v.object({
            _id: v.id("messages"),
            _creationTime: v.number(),
            chatId: v.id("chats"),
            role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
            content: v.string(),
            createdAt: v.number(),
            draftId: v.optional(v.id("contentDrafts")),
            draftData: v.optional(v.object({
                title: v.string(),
                originalIdea: v.string(),
                platforms: v.array(v.object({
                    platform: v.union(
                        v.literal("twitter"),
                        v.literal("linkedin"),
                        v.literal("blog")
                    ),
                    content: v.string(),
                    metadata: v.optional(v.object({
                        hook: v.optional(v.string()),
                        cta: v.optional(v.string()),
                        hashtags: v.optional(v.array(v.string())),
                        chapters: v.optional(v.array(v.string())),
                    })),
                })),
                tone: v.optional(v.string()),
                imageStorageId: v.optional(v.id("_storage")),
            })),
        })
    ),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            return [];
        }
        
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .order("asc")
            .collect();
        
        // Fetch draft data for messages that have draftId
        const messagesWithDrafts = await Promise.all(
            messages.map(async (msg) => {
                if (msg.draftId) {
                    const draft = await ctx.db.get(msg.draftId);
                    if (draft) {
                        return {
                            ...msg,
                            draftData: {
                                title: draft.title,
                                originalIdea: draft.originalIdea,
                                platforms: draft.platforms,
                                tone: draft.tone,
                                imageStorageId: draft.imageStorageId,
                            },
                        };
                    }
                }
                return { ...msg, draftData: undefined };
            })
        );
        
        return messagesWithDrafts;
    },
});

// List messages with pagination
export const listChatMessagesPaginated = query({
    args: {
        userId: v.id("users"),
        chatId: v.id("chats"),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("messages"),
            _creationTime: v.number(),
            chatId: v.id("chats"),
            role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
            content: v.string(),
            createdAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            return [];
        }
        
        const limit = args.limit ?? 50;
        return await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .take(limit);
    },
});

// Get the latest messages from a chat
export const getLatestMessages = query({
    args: {
        userId: v.id("users"),
        chatId: v.id("chats"),
        count: v.number(),
    },
    returns: v.array(
        v.object({
            _id: v.id("messages"),
            _creationTime: v.number(),
            chatId: v.id("chats"),
            role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
            content: v.string(),
            createdAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            return [];
        }
        
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .take(args.count);
        
        // Reverse to get chronological order
        return messages.reverse();
    },
});

// Update message content
export const updateMessage = mutation({
    args: {
        userId: v.id("users"),
        messageId: v.id("messages"),
        content: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) {
            throw new Error("Message not found");
        }
        
        // Verify message's chat belongs to user
        const chat = await ctx.db.get(message.chatId);
        if (!chat || chat.userId !== args.userId) {
            throw new Error("Unauthorized");
        }
        
        await ctx.db.patch(args.messageId, {
            content: args.content,
        });
        return null;
    },
});

// Delete a message
export const deleteMessage = mutation({
    args: { 
        userId: v.id("users"),
        messageId: v.id("messages") 
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (!message) {
            throw new Error("Message not found");
        }
        
        // Verify message's chat belongs to user
        const chat = await ctx.db.get(message.chatId);
        if (!chat || chat.userId !== args.userId) {
            throw new Error("Unauthorized");
        }
        
        await ctx.db.delete(args.messageId);
        return null;
    },
});

// Delete all messages in a chat
export const deleteAllChatMessages = mutation({
    args: { 
        userId: v.id("users"),
        chatId: v.id("chats") 
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            throw new Error("Unauthorized");
        }
        
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .collect();
        
        for (const message of messages) {
            await ctx.db.delete(message._id);
        }
        
        return null;
    },
});

// Get message count for a chat
export const getChatMessageCount = query({
    args: { 
        userId: v.id("users"),
        chatId: v.id("chats") 
    },
    returns: v.number(),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            return 0;
        }
        
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .collect();
        return messages.length;
    },
});
