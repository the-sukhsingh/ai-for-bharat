import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get storage URL for an image
 */
export const getStorageUrl = query({
    args: {
        storageId: v.id("_storage"),
    },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/**
 * Get storage URL for an image (internal version for scheduled posts)
 */
export const getStorageUrlInternal = internalQuery({
    args: {
        storageId: v.id("_storage"),
    },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});

/**
 * Generate an upload URL for file storage
 */
export const generateUploadUrl = mutation({
    args: {},
    returns: v.string(),
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

