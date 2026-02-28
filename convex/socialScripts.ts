import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { GoogleGenAI, Type } from "@google/genai";
import { api } from "./_generated/api";

const scriptSectionValidator = v.object({
    heading: v.string(),
    content: v.string(),
    duration: v.optional(v.number()),
});

// Create a new social script
export const createSocialScript = mutation({
    args: {
        userId: v.id("users"),
        title: v.string(),
        platform: v.union(v.literal("instagram"), v.literal("youtube")),
        hook: v.string(),
        scriptSections: v.array(scriptSectionValidator),
        cta: v.string(),
        hashtags: v.optional(v.array(v.string())),
    },
    returns: v.id("socialScripts"),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const scriptId = await ctx.db.insert("socialScripts", {
            userId: args.userId,
            title: args.title,
            platform: args.platform,
            hook: args.hook,
            scriptSections: args.scriptSections,
            cta: args.cta,
            hashtags: args.hashtags,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return scriptId;
    },
});

// Update an existing social script
export const updateSocialScript = mutation({
    args: {
        userId: v.id("users"),
        scriptId: v.id("socialScripts"),
        title: v.optional(v.string()),
        platform: v.optional(v.union(v.literal("instagram"), v.literal("youtube"))),
        hook: v.optional(v.string()),
        scriptSections: v.optional(v.array(scriptSectionValidator)),
        cta: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const script = await ctx.db.get(args.scriptId);
        if (!script) {
            throw new Error("Social script not found");
        }

        if (script.userId !== args.userId) {
            throw new Error("Unauthorized: You can only update your own social scripts");
        }

        const updates: Partial<Doc<"socialScripts">> = {
            updatedAt: Date.now(),
        };

        if (args.title !== undefined) updates.title = args.title;
        if (args.platform !== undefined) updates.platform = args.platform;
        if (args.hook !== undefined) updates.hook = args.hook;
        if (args.scriptSections !== undefined) updates.scriptSections = args.scriptSections;
        if (args.cta !== undefined) updates.cta = args.cta;
        if (args.hashtags !== undefined) updates.hashtags = args.hashtags;

        await ctx.db.patch(args.scriptId, updates);
        return null;
    },
});

// Delete a social script
export const deleteSocialScript = mutation({
    args: {
        userId: v.id("users"),
        scriptId: v.id("socialScripts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const script = await ctx.db.get(args.scriptId);
        if (!script) {
            throw new Error("Social script not found");
        }

        if (script.userId !== args.userId) {
            throw new Error("Unauthorized: You can only delete your own social scripts");
        }

        await ctx.db.delete(args.scriptId);
        return null;
    },
});

// Get user's social scripts
export const getUserSocialScripts = query({
    args: {
        userId: v.id("users"),
        platform: v.optional(v.union(v.literal("instagram"), v.literal("youtube"))),
    },
    returns: v.array(
        v.object({
            _id: v.id("socialScripts"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            platform: v.union(v.literal("instagram"), v.literal("youtube")),
            hook: v.string(),
            scriptSections: v.array(scriptSectionValidator),
            cta: v.string(),
            hashtags: v.optional(v.array(v.string())),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        let scripts = await ctx.db
            .query("socialScripts")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();

        // Filter by platform if specified
        if (args.platform) {
            return scripts.filter((script) => script.platform === args.platform);
        }

        return scripts;
    },
});

// Get social scripts by platform
export const getSocialScriptsByPlatform = query({
    args: {
        userId: v.id("users"),
        platform: v.union(v.literal("instagram"), v.literal("youtube")),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("socialScripts"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            platform: v.union(v.literal("instagram"), v.literal("youtube")),
            hook: v.string(),
            scriptSections: v.array(scriptSectionValidator),
            cta: v.string(),
            hashtags: v.optional(v.array(v.string())),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const limit = args.limit || 50;
        const scripts = await ctx.db
            .query("socialScripts")
            .withIndex("by_platform", (q) => q.eq("platform", args.platform))
            .order("desc")
            .take(limit);

        // Filter to only user's scripts
        return scripts.filter((script) => script.userId === args.userId);
    },
});

// Get single social script details
export const getSocialScriptById = query({
    args: {
        scriptId: v.id("socialScripts"),
        requestingUserId: v.id("users"),
    },
    returns: v.union(
        v.object({
            _id: v.id("socialScripts"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            platform: v.union(v.literal("instagram"), v.literal("youtube")),
            hook: v.string(),
            scriptSections: v.array(scriptSectionValidator),
            cta: v.string(),
            hashtags: v.optional(v.array(v.string())),
            createdAt: v.number(),
            updatedAt: v.number(),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const script = await ctx.db.get(args.scriptId);
        if (!script) {
            return null;
        }

        // Only owner can view their scripts
        if (script.userId !== args.requestingUserId) {
            return null;
        }

        return script;
    },
});

// Get latest social scripts
export const getLatestSocialScripts = query({
    args: {
        userId: v.id("users"),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("socialScripts"),
            _creationTime: v.number(),
            userId: v.id("users"),
            title: v.string(),
            platform: v.union(v.literal("instagram"), v.literal("youtube")),
            hook: v.string(),
            scriptSections: v.array(scriptSectionValidator),
            cta: v.string(),
            hashtags: v.optional(v.array(v.string())),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const limit = args.limit || 20;
        const scripts = await ctx.db
            .query("socialScripts")
            .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(limit);
        return scripts;
    },
});

// Action to generate social script using AI
export const generateSocialScript = action({
    args: {
        userId: v.string(), // Email address
        title: v.string(),
        platform: v.union(v.literal("instagram"), v.literal("youtube")),
        prompt: v.string(),
    },
    returns: v.object({
        success: v.boolean(),
        scriptId: v.optional(v.id("socialScripts")),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        try {
            // Get user ID from email
            const user: any = await ctx.runQuery(api.users.getUserByEmail, { email: args.userId });
            if (!user) {
                throw new Error("User not found");
            }
            const userId: Id<"users"> = user._id;

            const sourceContent = args.prompt;
            const sourceTitle = args.title;

            // Generate script using AI
            const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
            
            const platformGuidelines = args.platform === "instagram" 
                ? `Instagram Reel/Post Script (60-90 seconds):
- Start with a strong hook in the first 3 seconds
- Keep it visual and engaging
- Use short, punchy sections
- Include call-to-action
- Add relevant hashtags
- Duration for each section should be 5-15 seconds`
                : `YouTube Video Script:
- Strong opening hook (first 10 seconds)
- Structured sections with clear headings
- Educational and valuable content
- Clear call-to-action
- Duration for each section should be appropriate (30-120 seconds)`;

            const scriptPrompt = `You are a social media script writer for developers and tech creators. Generate a ${args.platform} script based on the following content:

${sourceContent}

${platformGuidelines}

Create 3-5 sections. Make it engaging, authentic, and developer-focused.`;

            // Define structured response schema
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    hook: {
                        type: Type.STRING,
                        description: "Opening hook text (first 3-10 seconds) that grabs attention and makes viewers want to watch more",
                    },
                    sections: {
                        type: Type.ARRAY,
                        description: "Main content sections with clear structure",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                heading: {
                                    type: Type.STRING,
                                    description: "Section title or heading",
                                },
                                content: {
                                    type: Type.STRING,
                                    description: "Section content - what to say in this part",
                                },
                                duration: {
                                    type: Type.NUMBER,
                                    description: "Estimated duration in seconds for this section",
                                },
                            },
                            required: ["heading", "content", "duration"],
                        },
                    },
                    cta: {
                        type: Type.STRING,
                        description: "Call to action text - what you want viewers to do next",
                    },
                    hashtags: {
                        type: Type.ARRAY,
                        description: "5-10 relevant hashtags for the platform",
                        items: {
                            type: Type.STRING,
                        },
                    },
                },
                required: ["hook", "sections", "cta", "hashtags"],
            } as const;

            const result = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: scriptPrompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const generatedText = result.text || "";
            
            // Parse JSON response
            const scriptData: {
                hook: string;
                sections: Array<{ 
                    heading: string; 
                    content: string; 
                    duration: number;
                }>;
                cta: string;
                hashtags: string[];
            } = JSON.parse(generatedText);

            // Create the social script
            const scriptId: Id<"socialScripts"> = await ctx.runMutation(api.socialScripts.createSocialScript, {
                userId: userId,
                title: sourceTitle,
                platform: args.platform,
                hook: scriptData.hook,
                scriptSections: scriptData.sections,
                cta: scriptData.cta,
                hashtags: scriptData.hashtags,
            });

            return {
                success: true,
                scriptId,
            };

        } catch (error: any) {
            console.error("Error generating social script:", error);
            return {
                success: false,
                error: error.message || "Failed to generate script",
            };
        }
    },
});
