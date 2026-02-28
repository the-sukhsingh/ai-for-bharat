import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createChat = mutation({
    args:{
        userId: v.id("users"),
        message: v.string(),
        type: v.union(v.literal("contentDraft"), v.literal("socialScript"))
    },
    returns: v.id("chats"),
    handler: async (ctx, args)=> {


        // Create Chat
        const chat = await ctx.db.insert("chats",{
            userId: args.userId,
            title: args.message,
            type: args.type,
            createdAt: Date.now(),
            updatedAt: Date.now()
        })

        // Create Message
        await ctx.db.insert("messages",{
            chatId: chat,
            content: args.message,
            role: "user",
            createdAt: Date.now()
        })

        // Evaluate AI engagement badges
        // await ctx.runMutation("badgeDefinitions.evaluateBadgesForUser", { userId: args.userId });

        return chat;
    }
});

export const getChat = query({
    args: { 
        userId: v.id("users"),
        chatId: v.id("chats") 
    },
    returns: v.union(
        v.object({
            _id: v.id("chats"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            type: v.union(v.literal("contentDraft"), v.literal("socialScript")),
            createdAt: v.number(),
            updatedAt: v.number(),
            messages: v.union(
                v.array(v.object({
                    _id: v.id("messages"),
                    _creationTime: v.number(),
                    chatId: v.id("chats"),
                    content: v.string(),
                    role: v.string(),
                    createdAt: v.number(),
                    draftId: v.optional(v.id("contentDrafts"))
                })),
                v.null()
            )
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const chat = await ctx.db.get(args.chatId);

        if (!chat || chat.userId !== args.userId) {
            return null;
        };

        const messages = await ctx.db.query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId)).collect();

        return {
            ...chat,
            messages: messages
        }

    }
})

// Get chat without messages (simpler query for API routes)
export const getChatSimple = query({
    args: { 
        userId: v.id("users"),
        chatId: v.id("chats") 
    },
    returns: v.union(
        v.object({
            _id: v.id("chats"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            type: v.union(v.literal("contentDraft"), v.literal("socialScript")),
            createdAt: v.number(),
            updatedAt: v.number(),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const chat = await ctx.db.get(args.chatId);

        if (!chat || chat.userId !== args.userId) {
            return null;
        }

        return chat;
    }
})

// List all chats for a user
export const listUserChats = query({
    args: { userId: v.id("users") },
    returns: v.array(
        v.object({
            _id: v.id("chats"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            type: v.union(v.literal("contentDraft"), v.literal("socialScript")),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

// List chats by type for a user
export const listUserChatsByType = query({
    args: { 
        userId: v.id("users"),
        type: v.union(v.literal("contentDraft"), v.literal("socialScript"))
    },
    returns: v.array(
        v.object({
            _id: v.id("chats"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            type: v.union(v.literal("contentDraft"), v.literal("socialScript")),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("chats")
            .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
            .order("desc")
            .collect();
    },
});

// Update chat title
export const updateChat = mutation({
    args: {
        userId: v.id("users"),
        chatId: v.id("chats"),
        title: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Verify chat belongs to user
        const chat = await ctx.db.get(args.chatId);
        if (!chat || chat.userId !== args.userId) {
            throw new Error("Unauthorized");
        }
        
        await ctx.db.patch(args.chatId, {
            title: args.title,
            updatedAt: Date.now(),
        });
        return null;
    },
});

// Delete chat and all its messages
export const deleteChat = mutation({
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
        
        // Delete all messages in this chat
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
            .collect();
        
        for (const message of messages) {
            await ctx.db.delete(message._id);
        }
        
        // Delete the chat
        await ctx.db.delete(args.chatId);
        return null;
    },
});

// Get chat count for user
export const getUserChatCount = query({
    args: { userId: v.id("users") },
    returns: v.number(),
    handler: async (ctx, args) => {
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        return chats.length;
    },
});