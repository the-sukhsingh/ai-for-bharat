import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const saveThumbnail = action({
    args: {
        prompt: v.string(),
        imageData: v.string(), // base64 encoded image
        mimeType: v.string(),
        hasMainImage: v.boolean(),
        hasTemplate: v.boolean(),
        referenceCount: v.number(),
        email: v.string(),
    },
    returns: v.id("thumbnails"),
    handler: async (ctx, args) => {
       

        // Get user by email
        const user = await ctx.runQuery(internal.thumbnails.getUserByEmail, {
            email: args.email,
        });

        if (!user) {
            throw new Error("User not found");
        }

        // Convert base64 to blob and store in Convex storage
        const base64Data = args.imageData;
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const blob = new Blob([binaryData], { type: args.mimeType });

        const storageId = await ctx.storage.store(blob);

        // Save thumbnail metadata to database via mutation
        const thumbnailId: Id<"thumbnails"> = await ctx.runMutation(
            internal.thumbnails.saveThumbnailMetadata,
            {
                userId: user._id,
                prompt: args.prompt,
                imageStorageId: storageId,
                mimeType: args.mimeType,
                hasMainImage: args.hasMainImage,
                hasTemplate: args.hasTemplate,
                referenceCount: args.referenceCount,
            }
        );

        return thumbnailId;
    },
});

export const getUserByEmail = internalQuery({
    args: {
        email: v.string(),
    },
    returns: v.union(
        v.object({
            _id: v.id("users"),
            _creationTime: v.number(),
            email: v.string(),
            name: v.string(),
            imageUrl: v.optional(v.string()),
            createdAt: v.number(),
            credits: v.number(),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();
        
        return user || null;
    },
});

export const saveThumbnailMetadata = internalMutation({
    args: {
        userId: v.id("users"),
        prompt: v.string(),
        imageStorageId: v.id("_storage"),
        mimeType: v.string(),
        hasMainImage: v.boolean(),
        hasTemplate: v.boolean(),
        referenceCount: v.number(),
    },
    returns: v.id("thumbnails"),
    handler: async (ctx, args) => {
        const thumbnailId = await ctx.db.insert("thumbnails", {
            userId: args.userId,
            prompt: args.prompt,
            imageStorageId: args.imageStorageId,
            mimeType: args.mimeType,
            hasMainImage: args.hasMainImage,
            hasTemplate: args.hasTemplate,
            referenceCount: args.referenceCount,
            createdAt: Date.now(),
        });

        return thumbnailId;
    },
});

export const getUserThumbnails = query({
    args: {
        id: v.id("users"),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("thumbnails"),
            _creationTime: v.number(),
            userId: v.id("users"),
            prompt: v.string(),
            imageStorageId: v.id("_storage"),
            mimeType: v.string(),
            hasMainImage: v.boolean(),
            hasTemplate: v.boolean(),
            referenceCount: v.number(),
            createdAt: v.number(),
            imageUrl: v.union(v.string(), v.null()),
        })
    ),
    handler: async (ctx, args) => {


        const user = await ctx.db
            .query("users")
            .withIndex("by_id", (q) => q.eq("_id", args.id))
            .first();

        if (!user) {
            return [];
        }

        const thumbnails = await ctx.db
            .query("thumbnails")
            .withIndex("by_user_created", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(args.limit || 50);

        // Get image URLs from storage
        const thumbnailsWithUrls = await Promise.all(
            thumbnails.map(async (thumbnail) => {
                const imageUrl = await ctx.storage.getUrl(thumbnail.imageStorageId);
                return {
                    ...thumbnail,
                    imageUrl,
                };
            })
        );

        return thumbnailsWithUrls;
    },
});

export const getThumbnail = query({
    args: {
        thumbnailId: v.id("thumbnails"),
    },
    returns: v.union(
        v.object({
            _id: v.id("thumbnails"),
            _creationTime: v.number(),
            userId: v.id("users"),
            prompt: v.string(),
            imageStorageId: v.id("_storage"),
            mimeType: v.string(),
            hasMainImage: v.boolean(),
            hasTemplate: v.boolean(),
            referenceCount: v.number(),
            createdAt: v.number(),
            imageUrl: v.union(v.string(), v.null()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const thumbnail = await ctx.db.get(args.thumbnailId);
        if (!thumbnail) {
            return null;
        }

        const imageUrl = await ctx.storage.getUrl(thumbnail.imageStorageId);
        return {
            ...thumbnail,
            imageUrl,
        };
    },
});

export const deleteThumbnail = mutation({
    args: {
        id: v.id("users"),
        thumbnailId: v.id("thumbnails"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {



        const thumbnail = await ctx.db.get(args.thumbnailId);
        if (!thumbnail) {
            throw new Error("Thumbnail not found");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_id", (q) => q.eq("_id", args.id))
            .first();

        if (!user || thumbnail.userId !== user._id) {
            throw new Error("Not authorized");
        }

        // Delete from storage
        await ctx.storage.delete(thumbnail.imageStorageId);

        // Delete from database
        await ctx.db.delete(args.thumbnailId);

        return null;
    },
});
