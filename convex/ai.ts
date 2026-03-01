import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { GoogleGenAI, Type } from '@google/genai';
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// Helper to fetch GitHub data
async function fetchGitHubData(repoUrl: string, type: 'repo' | 'commits' | 'readme') {
    try {
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) return null;

        const [, owner, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, '');

        if (type === 'commits') {
            const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=10`);
            if (!response.ok) return null;
            const commits = await response.json();
            return commits.map((c: any) => ({
                message: c.commit.message,
                date: c.commit.author.date,
                sha: c.sha.substring(0, 7)
            }));
        } else if (type === 'readme') {
            const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/readme`, {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            if (!response.ok) return null;
            const content = await response.text();
            return content.substring(0, 3000); // Limit to 3000 chars
        } else {
            const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`);
            if (!response.ok) return null;
            const data = await response.json();
            return {
                name: data.name,
                description: data.description,
                topics: data.topics || [],
                language: data.language,
                stars: data.stargazers_count
            };
        }
    } catch (error) {
        console.error('GitHub fetch error:', error);
        return null;
    }
}


// Helper to fetch URL content
async function fetchUrlContent(url: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const html = await response.text();

        // Basic content extraction (remove tags, get text)
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000); // Limit to 3000 chars

        return text;
    } catch (error) {
        console.error('URL fetch error:', error);
        return null;
    }
}



// Tool handlers for AI functions
const createToolHandlers = (ctx: any, xAccountSubType: string = 'None') => {
    const twitterCharLimit = xAccountSubType === 'None' ? 280 : 25000;

    return {

        generate_content: async ({ userId, chatId, title, idea, platforms, tone, githubRepo, githubCommits, websiteUrl, additionalContext }: any): Promise<any> => {
            try {
                const contextSources = [];
                let enrichedContext = idea;

                // Fetch GitHub repo data
                if (githubRepo) {
                    const readmeData = await fetchGitHubData(githubRepo, 'readme');
                    if (readmeData) {
                        contextSources.push({ type: 'github_readme' as const, data: readmeData });
                        enrichedContext += `\n\nGitHub Readme:\n${readmeData}`;
                    }

                    const commitsData = await fetchGitHubData(githubRepo, 'commits');
                    if (commitsData) {
                        contextSources.push({ type: 'github_commits' as const, data: JSON.stringify(commitsData) });
                        enrichedContext += `\n\nRecent Commits:\n${commitsData.map((c: any) => `- [${c.sha}] ${c.message}`).join('\n')}`;
                    }

                    const repoData = await fetchGitHubData(githubRepo, 'repo');
                    if (repoData) {
                        contextSources.push({ type: 'github_repo' as const, data: JSON.stringify(repoData) });
                        enrichedContext += `\n\nGitHub Repo Context:\n- Name: ${repoData.name}\n- Description: ${repoData.description}\n- Language: ${repoData.language}\n- Stars: ${repoData.stars}`;
                    }
                }

                // Fetch GitHub commits
                if (githubCommits && githubCommits !== githubRepo) {
                    const commitsData = await fetchGitHubData(githubCommits, 'commits');
                    if (commitsData) {
                        contextSources.push({ type: 'github_commits' as const, data: JSON.stringify(commitsData) });
                        enrichedContext += `\n\nRecent Commits:\n${commitsData.map((c: any) => `- [${c.sha}] ${c.message}`).join('\n')}`;
                    }
                }

                // Fetch website content
                if (websiteUrl) {
                    const urlContent = await fetchUrlContent(websiteUrl);
                    if (urlContent) {
                        contextSources.push({ type: 'url' as const, data: urlContent });
                        enrichedContext += `\n\nWebsite Context:\n${urlContent}`;
                    }
                }

                // Add additional context
                if (additionalContext) {
                    contextSources.push({ type: 'text' as const, data: additionalContext });
                    enrichedContext += `\n\nAdditional Context:\n${additionalContext}`;
                }

                // Generate content using Gemini
                const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
                const selectedPlatforms = platforms || ['linkedin', 'twitter', 'blog'];
                const selectedTone = tone || 'technical';
                // twitterCharLimit is available from closure




                const contentPrompt = `Generate platform-specific social media content for developers.

            **Idea:** ${idea}

            **Context:** ${enrichedContext}

            **Tone:** ${selectedTone}

            **Target Platforms:** ${selectedPlatforms.join(', ')}

            IMPORTANT: You MUST generate content for ALL ${selectedPlatforms.length} requested platforms: ${selectedPlatforms.join(', ')}.

            Create content for each platform with these specifications:

            ${selectedPlatforms.includes('twitter') ? `
            **Twitter/X:** ${twitterCharLimit === 280 ? 'Threaded format, concise per-tweet (280 chars max), conversational. Separate tweets with a double newline instead of numbering them.' : `Extended post format (up to ${twitterCharLimit} chars), can be longer and more detailed while remaining conversational.`}` : ''}
            ${selectedPlatforms.includes('linkedin') ? `
            **LinkedIn:** Professional tone, storytelling angle, ${selectedTone === 'technical' ? 'technical insights' : 'thought leadership'}, 3000 chars max.` : ''}
            ${selectedPlatforms.includes('blog') ? `
            **Blog:** Structured article, headers, actionable insights, 500+ words.` : ''}

            Generate structured content for ALL requested platforms. Do not skip any platform.`;

                const result = await genAI.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: [{ role: 'user', parts: [{ text: contentPrompt }] }],
                    config: {
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                platforms: {
                                    type: Type.OBJECT,
                                    properties: {
                                        ...(selectedPlatforms.includes('blog') && {
                                            blog: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    title: { type: Type.STRING },
                                                    text: { type: Type.STRING, description: "Full post" }
                                                },
                                                required: ["title", "text"]
                                            }
                                        }),
                                        ...(selectedPlatforms.includes('twitter') && {
                                            twitter: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    title: { type: Type.STRING, description: "Thread Hook" },
                                                    text: { type: Type.STRING, description: "Full thread/post content" }
                                                },
                                                required: ["title", "text"]
                                            }
                                        }),
                                        ...(selectedPlatforms.includes('linkedin') && {
                                            linkedin: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    title: { type: Type.STRING },
                                                    text: { type: Type.STRING, description: "Professional tone, max 3000 chars" }
                                                },
                                                required: ["title", "text"]
                                            }
                                        })
                                    },
                                    required: selectedPlatforms // Require all selected platforms
                                }
                            },
                            required: ["platforms"]
                        },
                        responseMimeType: "application/json",
                    }
                });

                // Parse the structured JSON response
                let platformContents: any[] = [];
                try {
                    const generatedContent = result.text || '';

                    const parsedResponse = JSON.parse(generatedContent);
                    const platforms = parsedResponse.platforms || {};


                    // Check if all requested platforms are present
                    const missingPlatforms = selectedPlatforms.filter((platform: any) => !platforms[platform]);
                    if (missingPlatforms.length > 0) {
                        console.warn('Missing platforms:', missingPlatforms);
                        console.warn('This may indicate an AI generation issue');
                    }

                    platformContents = selectedPlatforms.map((platform: string) => {
                        const platformData = platforms[platform];
                        if (!platformData) {
                            console.warn(`No data found for platform: ${platform}. Available platforms:`, Object.keys(platforms));
                            // Create placeholder content for missing platforms
                            return {
                                platform: platform,
                                content: `Content for ${platform} was not generated. Please try again.`,
                            };
                        }


                        // Handle different platform formats based on schema
                        switch (platform) {
                            case 'twitter':
                                return {
                                    platform: 'twitter',
                                    content: platformData.text || '',
                                };
                            case 'linkedin':
                                return {
                                    platform: 'linkedin',
                                    content: platformData.text || '',
                                };

                            case 'blog':
                                return {
                                    platform: 'blog',
                                    content: platformData.text || '',
                                };

                            default:
                                return {
                                    platform: platform,
                                    content: platformData.text || platformData.content || '',
                                };
                        }
                    }).filter((content: any) => content !== null); // Keep all content, including placeholders

                } catch (parseError) {
                    console.error('Failed to parse JSON response:', parseError);

                    // If structured parsing fails, return error
                    const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
                    throw new Error(`Failed to generate structured content: ${errorMessage}`);
                }



                // Generate an image for the content (16:9 ratio for social media)
                let imageStorageId: Id<"_storage"> | undefined;
                try {
                    const imagePrompt = `Create a professional, eye-catching social media post image for: "${title}". 
                
Context: ${idea}

Style requirements:
- Modern, clean, and professional design
- High contrast and vibrant colors
- Suitable for ${selectedPlatforms.join(', ')} platforms
- ${selectedTone} tone
- Eye-catching and shareable
- 16:9 aspect ratio optimized for social media

Make it visually appealing and on-brand for developer/tech content.`;

                    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY! });

                    const result = await generateText({
                        model: google("gemini-2.5-flash-image"),
                        messages: [
                            {
                                role: "user",
                                content: imagePrompt,
                            },
                        ],
                        providerOptions: {
                            google: {
                                responseModalities: ["TEXT", "IMAGE"],
                                imageConfig: {
                                    aspectRatio: "16:9",
                                },
                            },
                        },
                    });

                    // Extract images from result.files (same pattern as thumbnail.ts)
                    for (const file of result.files) {
                        if (file.mediaType.startsWith("image/")) {
                            // Convert Uint8Array to blob for Convex storage
                            const uint8Array = await file.uint8Array;
                            const buffer = new Uint8Array(uint8Array);
                            const blob = new Blob([buffer], { type: file.mediaType });
                            imageStorageId = await ctx.storage.store(blob);
                            break; // Only take the first image
                        }
                    }
                } catch (imageError) {
                    console.error('Image generation error:', imageError);
                    // Continue without image if generation fails
                }

                // Save to database
                const draftId: any = await ctx.runMutation(api.contentDrafts.createContentDraft, {
                    userId: userId as Id<"users">,
                    chatId: chatId as Id<"chats"> | undefined,
                    title,
                    originalIdea: idea,
                    contextSources,
                    platforms: platformContents,
                    tone: selectedTone as any,
                    imageStorageId,
                });

                return {
                    success: true,
                    draftId,
                    content: platformContents,
                    message: `Generated content for ${selectedPlatforms.length} platform(s)`
                };
            } catch (error: any) {
                console.error('Content generation error:', error);
                return { success: false, error: error.message || 'Failed to generate content' };
            }
        },
        get_content_drafts: async ({ userId, status }: any): Promise<any> => {
            try {
                const drafts: any = await ctx.runQuery(api.contentDrafts.getUserContentDrafts, {
                    userId: userId as Id<"users">,
                    status: status as any
                });

                return { success: true, drafts };
            } catch (error: any) {
                return { success: false, error: 'Failed to retrieve content drafts' };
            }
        },
        get_draft_details: async ({ draftId, userId }: any): Promise<any> => {
            try {
                const draft: any = await ctx.runQuery(api.contentDrafts.getContentDraftById, {
                    draftId: draftId as Id<"contentDrafts">,
                    requestingUserId: userId as Id<"users">
                });

                if (!draft) {
                    return { success: false, error: 'Draft not found or access denied' };
                }

                return { success: true, draft };
            } catch (error: any) {
                console.error('Get draft details error:', error);
                return { success: false, error: error.message || 'Failed to retrieve draft details' };
            }
        },
        edit_content_draft: async ({ draftId, userId, updates }: any): Promise<any> => {
            try {
                // First verify the draft exists and belongs to the user
                const draft: any = await ctx.runQuery(api.contentDrafts.getContentDraftById, {
                    draftId: draftId as Id<"contentDrafts">,
                    requestingUserId: userId as Id<"users">
                });

                if (!draft) {
                    return { success: false, error: 'Draft not found or access denied' };
                }

                // Update the draft
                await ctx.runMutation(api.contentDrafts.updateContentDraft, {
                    draftId: draftId as Id<"contentDrafts">,
                    userId: userId as Id<"users">,
                    ...updates
                });

                return {
                    success: true,
                    message: `Draft "${draft.title}" updated successfully`,
                    draftId
                };
            } catch (error: any) {
                console.error('Edit draft error:', error);
                return { success: false, error: error.message || 'Failed to update draft' };
            }
        },
        delete_content_draft: async ({ draftId, userId }: any): Promise<any> => {
            try {
                // First verify the draft exists and belongs to the user
                const draft: any = await ctx.runQuery(api.contentDrafts.getContentDraftById, {
                    draftId: draftId as Id<"contentDrafts">,
                    requestingUserId: userId as Id<"users">
                });

                if (!draft) {
                    return { success: false, error: 'Draft not found or access denied' };
                }

                // Delete the draft
                await ctx.runMutation(api.contentDrafts.deleteContentDraft, {
                    draftId: draftId as Id<"contentDrafts">,
                    userId: userId as Id<"users">
                });

                return {
                    success: true,
                    message: `Draft "${draft.title}" deleted successfully`,
                    deletedDraftId: draftId
                };
            } catch (error: any) {
                console.error('Delete draft error:', error);
                return { success: false, error: error.message || 'Failed to delete draft' };
            }
        },
        update_platform_content: async ({ draftId, userId, platform, content }: any): Promise<any> => {
            try {
                // First verify the draft exists and belongs to the user
                const draft: any = await ctx.runQuery(api.contentDrafts.getContentDraftById, {
                    draftId: draftId as Id<"contentDrafts">,
                    requestingUserId: userId as Id<"users">
                });

                if (!draft) {
                    return { success: false, error: 'Draft not found or access denied' };
                }

                // Find and update the specific platform, preserving others
                const updatedPlatforms = draft.platforms.map((p: any) => {
                    if (p.platform === platform) {
                        return {
                            platform: p.platform,
                            content: content !== undefined ? content : p.content,
                        };
                    }
                    return p;
                });

                // Update the draft with the modified platforms array
                await ctx.runMutation(api.contentDrafts.updateContentDraft, {
                    draftId: draftId as Id<"contentDrafts">,
                    userId: userId as Id<"users">,
                    platforms: updatedPlatforms
                });

                return {
                    success: true,
                    message: `${platform} content updated successfully`,
                    draftId,
                    platform
                };
            } catch (error: any) {
                console.error('Update platform content error:', error);
                return { success: false, error: error.message || 'Failed to update platform content' };
            }
        },
        update_image_for_draft: async ({ draftId, userId, prompt }: any): Promise<any> => {
            try {
                // First verify the draft exists and belongs to the user
                const draft: any = await ctx.runQuery(api.contentDrafts.getContentDraftById, {
                    draftId: draftId as Id<"contentDrafts">,
                    requestingUserId: userId as Id<"users">
                });

                if (!draft) {
                    return { success: false, error: 'Draft not found or access denied' };
                }

                // Create a new image using Google Generative AI
                let imageStorageId: Id<"_storage"> | undefined;
                try {
                    const imagePrompt = `Create a professional, eye-catching social media post image based on this prompt: "${prompt}".`;

                    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY! });

                    const result = await generateText({
                        model: google("gemini-2.5-flash-image"),
                        messages: [
                            {
                                role: "user",
                                content: imagePrompt,
                            },
                        ],
                        providerOptions: {
                            google: {
                                responseModalities: ["TEXT", "IMAGE"],
                                imageConfig: {
                                    aspectRatio: "16:9",
                                },
                            },
                        },
                    });

                    // Extract images from result.files (same pattern as thumbnail.ts)
                    for (const file of result.files) {
                        if (file.mediaType.startsWith("image/")) {
                            // Convert Uint8Array to blob for Convex storage
                            const uint8Array = await file.uint8Array;
                            const buffer = new Uint8Array(uint8Array);
                            const blob = new Blob([buffer], { type: file.mediaType });
                            imageStorageId = await ctx.storage.store(blob);
                            break; // Only take the first image
                        }
                    }

                    // Remove the old image from storage if it exists
                    if (draft.imageStorageId) {
                        await ctx.storage.delete(draft.imageStorageId);
                    }

                    // Update the draft with the new imageStorageId
                    await ctx.runMutation(api.contentDrafts.updateContentDraft, {
                        draftId: draftId as Id<"contentDrafts">,
                        userId: userId as Id<"users">,
                        imageStorageId
                    });

                    return {
                        success: true,
                        message: `Draft image updated successfully`,
                        draftId
                    }

                } catch (imageError) {
                    console.error('Image generation error:', imageError);
                    // Continue without image if generation fails
                }
            } catch (error) {
                console.error('Error updating image for draft:', error);
                throw error;
            }
        }
    };
};

// Tool declarations for Gemini - Content Draft Generation
const toolDeclarations = [
    {
        name: "generate_content",
        description: "Generate platform-specific social media content from an idea with context sources. ONLY call this AFTER the user has responded to ask_content_preferences with their platform and tone selections. Parse the user's selections from their message (e.g., 'Choose Platforms: linkedin' and 'Select Tone: professional'). Creates content for Twitter/X, LinkedIn and Blog with proper formatting for each platform.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user creating content",
                },
                chatId: {
                    type: Type.STRING,
                    description: "Optional chat ID to associate with the content",
                },
                title: {
                    type: Type.STRING,
                    description: "Title/name for this content draft",
                },
                idea: {
                    type: Type.STRING,
                    description: "The core idea or rough draft for the content",
                },
                platforms: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array of platforms to generate content for: ['twitter', 'linkedin', 'blog'].",
                },
                tone: {
                    type: Type.STRING,
                    description: "Content tone: 'casual', 'technical', 'storytelling', or 'professional'.",
                },
                githubRepo: {
                    type: Type.STRING,
                    description: "Optional GitHub repository URL for context (e.g., 'https://github.com/user/repo')",
                },
                githubCommits: {
                    type: Type.STRING,
                    description: "Optional GitHub repository URL to fetch recent commits",
                },
                websiteUrl: {
                    type: Type.STRING,
                    description: "Optional website URL to fetch content for context (e.g., project website or blog)",
                },
                additionalContext: {
                    type: Type.STRING,
                    description: "Optional additional text context (changelog, notes, bullets, etc.)",
                },
            },
            required: ["userId", "title", "idea"],
        },
    } as const,
    {
        name: "get_content_drafts",
        description: "Retrieve user's saved content drafts, optionally filtered by status.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user whose drafts to retrieve",
                },
                status: {
                    type: Type.STRING,
                    description: "Optional status filter: 'draft', 'edited', 'published', or 'archived'",
                },
            },
            required: ["userId"],
        },
    } as const,
    {
        name: "get_draft_details",
        description: "Get detailed information about a specific content draft.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                draftId: {
                    type: Type.STRING,
                    description: "The ID of the draft to retrieve",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the draft",
                },
            },
            required: ["draftId", "userId"],
        },
    } as const,
    {
        name: "edit_content_draft",
        description: "Edit an existing content draft. Can update title, platforms, content.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                draftId: {
                    type: Type.STRING,
                    description: "The ID of the draft to edit",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the draft",
                },
                updates: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "New title for the draft",
                        },
                        originalIdea: {
                            type: Type.STRING,
                            description: "Updated original idea",
                        },
                        platforms: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    platform: { type: Type.STRING },
                                    content: { type: Type.STRING },
                                }
                            },
                            description: "Updated platforms array with content",
                        },
                    },
                    required: [],
                },
            },
            required: ["draftId", "userId", "updates"],
        },
    } as const,
    {
        name: "delete_content_draft",
        description: "Delete a content draft permanently.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                draftId: {
                    type: Type.STRING,
                    description: "The ID of the draft to delete",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the draft",
                },
            },
            required: ["draftId", "userId"],
        },
    } as const,
    {
        name: "update_platform_content",
        description: "Update content for a SPECIFIC platform within a draft WITHOUT affecting other platforms. Use this when the user wants to rewrite, edit, or improve content for one platform (e.g., 'rewrite the X post', 'improve the LinkedIn content'). This preserves all other platform content.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                draftId: {
                    type: Type.STRING,
                    description: "The ID of the draft to update",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the draft",
                },
                platform: {
                    type: Type.STRING,
                    description: "The platform to update: 'twitter', 'linkedin' or 'blog'",
                },
                content: {
                    type: Type.STRING,
                    description: "The new content for this specific platform",
                }
            },
            required: ["draftId", "userId", "platform", "content"],
        },
    } as const,
    {
        name: "update_image_for_draft",
        description: "Generate a new image for the content draft based on a prompt and update the draft with the new image. This can be used when the user wants to refresh or change the image associated with their content draft.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                draftId: {
                    type: Type.STRING,
                    description: "The ID of the draft to update the image for",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the draft",
                },
                prompt: {
                    type: Type.STRING,
                    description: "The prompt to generate the new image (e.g., 'Create a professional social media post image for my React project')",
                },
            },
            required: ["draftId", "userId", "prompt"],
        },
    } as const,
];

export const generateContentDraft = action({
    args: {
        question: v.string(),
        files: v.optional(v.array(v.object({
            name: v.string(),
            type: v.string(),
            size: v.number(),
            data: v.string(),
        }))),
        userEmail: v.string(),
        conversationId: v.id("chats"),
        messageId: v.id("messages"),
        contextData: v.optional(v.any())
    },
    returns: v.object({
        status: v.string(),
        message: v.optional(v.string()),
        output: v.optional(v.string()),
        hasDraft: v.optional(v.boolean()),
        draftId: v.optional(v.union(v.string(), v.null())),
    }),
    handler: async (ctx, args) => {
        const { question, files, userEmail, conversationId, messageId, contextData } = args;

        try {
            // Get user ID
            const user = await ctx.runQuery(api.users.getUserByEmail, { email: userEmail });
            if (!user) {
                throw new Error(`User not found with email: ${userEmail}`);
            }
            const userId = user._id;

            // Validate chat type
            const chat: any = await ctx.runQuery(api.chats.getChatSimple, {
                userId,
                chatId: conversationId
            });

            if (!chat || chat.type !== "contentDraft") {
                throw new Error("Invalid chat or wrong chat type for content draft generation");
            }

            // Get conversation history
            const messages = await ctx.runQuery(api.messages.listChatMessages, {
                userId,
                chatId: conversationId
            });

            const history = messages.map((msg: any) => ({
                role: msg.role,
                content: msg.content
            })).slice(-5, -1); // exclude the last message



            // Generate AI content
            const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
            const TodayDate = new Date();

            const systemInstruction = `You are a helpful AI assistant specializing in content generation for developers.

**Content Generation for Developers**: Transform developer activities (code commits, projects, ideas) into engaging social media content. You understand developer context and create platform-specific content for:
   - Twitter/X (threaded, punchy, concise)
   - LinkedIn (professional, storytelling, technical depth)
   - Blog (structured, insightful articles)

## Available Tools

**Content Creation:**
- \`generate_content\`: Create new content drafts

**Content Management:**
- \`get_content_drafts\`: List user's saved drafts (optionally filter by status)
- \`get_draft_details\`: Get detailed info about a specific draft
- \`edit_content_draft\`: Modify existing drafts (title, original idea, etc.)
- \`update_platform_content\`: Update content for a SPECIFIC platform without affecting others (USE THIS for rewriting/editing platform content)
- \`delete_content_draft\`: Delete drafts permanently
- \`update_image_for_draft\`: Generate a new image for a draft based on a prompt and update the draft with the new image

## Content Generation Workflow

When a user wants to generate content, follow this workflow:

- User: "Create a post about my React project" or similar
- You: Call ONLY the \`generate_content\` tool with their idea and required fields ['platforms','tone'] if user preferences are not yet known. By default pass ['linkedin', 'twitter', 'blog'] for platforms and 'technical' for tone.


**Important Notes:**
- If user asks to generate content for all platforms, include all four: twitter, linkedin, blog.
- Always ensure the content matches the selected tone and platform style if provided by user.

**Context Sources:**
You can enhance content with:
- GitHub repositories (extract repo URL from user message)
- GitHub commits (same repo URL)
- Website URLs (if user provides)
- Additional text context

## Draft Management

When users want to manage their existing drafts:
- **View drafts**: Use \`get_content_drafts\` (optionally filter by status)
- **View details**: Use \`get_draft_details\` for a specific draft
- **Edit draft metadata**: Use \`edit_content_draft\` to modify title or original idea
- **Update platform content**: Use \`update_platform_content\` when user wants to rewrite/edit content for a SPECIFIC platform (e.g., "rewrite the Twitter post", "improve LinkedIn content"). This preserves all other platforms.
- **Update draft image**: Use \`update_image_for_draft\` when user wants to generate a new image for their draft based on a prompt.
- **Delete**: Use \`delete_content_draft\` to permanently remove a draft

**CRITICAL**: When a user asks to rewrite/edit content for ONE platform (e.g., "rewrite the Twitter post"), ALWAYS use \`update_platform_content\` NOT \`edit_content_draft\`. This ensures other platform content is preserved.

Always adapt tone and style to the platform and avoid generic marketing language. Focus on authentic developer storytelling.

Current Date: ${TodayDate}`;

            let prompt = `User query is- ${question}`;
            prompt += `\n\nThe user ID is: ${userId}. Use this where needed.`;

            // Get X account subscription type for character limit
            const xAccountSubType = contextData?.xAccountSubType || 'None';
            const twitterCharLimit = xAccountSubType === 'None' ? 280 : 25000;
            prompt += `\n\nIMPORTANT - Twitter/X Character Limit: The user's X account subscription type is "${xAccountSubType}". ${xAccountSubType === 'None' ? 'They can only post up to 280 characters per tweet (free tier).' : `They have a premium subscription and can post up to ${twitterCharLimit} characters per post.`}`;

            // Add context data if available
            if (contextData) {
                if (contextData.post) {
                    const { title, activeTab, originalIdea, id } = contextData.post;
                    prompt += `\n\nContext: The user is currently viewing a post titled "${title}".`;
                    if (activeTab) {
                        prompt += ` They are currently on the ${activeTab} tab.`;
                    }
                    if (originalIdea) {
                        prompt += `\nOriginal post idea: ${originalIdea}`;
                    }
                    if (id) {
                        prompt += `\n\nPost ID: ${id}`;
                    }

                }

                if (contextData.script) {
                    const { title, hook, id } = contextData.script;
                    prompt += `\n\nContext: The user is currently viewing a script titled "${title}".`;
                    if (hook) {
                        prompt += `\nScript hook: ${hook}`;
                    }
                    if (id) {
                        prompt += `\n\nScript ID: ${id}`;
                    }
                }

                prompt += '\n\nPlease consider this context when helping me only when I ask you to edit, delete or take reference from the currently opened post. If I ask you to generate a new post, use the context only when I explicitly ask you to take reference from the currently opened post. Otherwise, you can ignore the context and generate a new post based on the new prompt.';
            }

            // Initialize contents with history and current prompt
            const contents: any[] = [];

            // Map history to proper Gemini format
            if (history && history.length > 0) {
                history.forEach((entry: any) => {
                    contents.push({
                        role: entry.role === 'user' ? 'user' : 'model',
                        parts: [{ text: entry.content }]
                    });
                });
            }

            // Add current user prompt
            const userParts: any[] = [{ text: prompt }];

            if (files && files.length > 0) {
                files.forEach((file) => {
                    userParts.push({
                        inlineData: {
                            data: file.data,
                            mimeType: file.type
                        }
                    });
                });
            }

            contents.push({
                role: 'user',
                parts: userParts
            });

            const modelConfig = {
                model: "gemini-2.0-flash",
                config: {
                    tools: [{
                        functionDeclarations: toolDeclarations as any,
                    }],
                    systemInstruction: systemInstruction,
                    automaticFunctionCalling: { disable: false },
                }
            };

            // Generate content with tool calling loop
            const toolHandlers = createToolHandlers(ctx, xAccountSubType);
            let result = await genAI.models.generateContent({
                ...modelConfig,
                contents: contents
            });

            // Tool Loop: Handle multiple function calls until Gemini provides a text response
            let loopCount = 0;
            const MAX_LOOPS = 10;
            let lastDraftId: string | null = null;

            while (result.functionCalls && result.functionCalls.length > 0 && loopCount < MAX_LOOPS) {
                loopCount++;

                // Add the model's response (with function calls) to history
                const modelContent = result.candidates?.[0]?.content;
                if (!modelContent) break;
                contents.push(modelContent);

                const toolResponses = [];

                for (const call of result.functionCalls) {
                    if (!call.name) continue;
                    const handler = toolHandlers[call.name as keyof typeof toolHandlers];

                    const output = handler
                        ? await handler(call.args)
                        : { error: `Tool ${call.name} not found` };

                    // Track draft ID if content was generated
                    if (call.name === 'generate_content' && 'success' in output && output.success && 'draftId' in output && output.draftId) {
                        lastDraftId = output.draftId as string;
                    }

                    // If tool requires user input, break the loop and return the message
                    if (typeof output === 'object' && output !== null && 'requiresUserInput' in output && output.requiresUserInput && 'message' in output) {
                        const messageContent = String(output.message);

                        // Store the message asking for user preferences
                        await ctx.runMutation(api.messages.createMessage, {
                            chatId: conversationId,
                            role: "assistant",
                            content: messageContent,
                        });

                        return {
                            status: "success",
                            message: "Awaiting user input",
                            output: messageContent,
                        };
                    }

                    toolResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: output
                        }
                    });
                }

                // Add tool responses to history
                contents.push({
                    role: 'function',
                    parts: toolResponses
                });

                // Send structured history back to the model
                result = await genAI.models.generateContent({
                    ...modelConfig,
                    contents: contents,
                });
            }

            // Extract token usage
            let inputTokens: number | null = null;
            let outputTokens: number | null = null;

            try {
                const rAny = result as any;
                const candidates = result?.candidates || [];
                const cAny = candidates[0] as any;

                if (rAny && rAny.metadata && rAny.metadata.tokenUsage) {
                    const meta = rAny.metadata.tokenUsage;
                    inputTokens = meta?.promptTokens ?? null;
                    outputTokens = meta?.completionTokens ?? null;
                } else if (cAny && cAny.metadata && cAny.metadata.tokenUsage) {
                    const meta = cAny.metadata.tokenUsage;
                    inputTokens = meta?.promptTokens ?? null;
                    outputTokens = meta?.completionTokens ?? null;
                }
            } catch (e) {
                // ignore parsing errors
                console.error("Error extracting token usage:", e);
            }

            // Fallback: estimate based on characters
            const fullPrompt = contents.map(c => (c.parts || []).map((p: any) => p.text).join('\n')).join('\n');
            const estimatedInput = Math.max(1, Math.ceil((fullPrompt.length || 0) / 4));
            const estimatedOutput = Math.max(1, Math.ceil(((result.text || "").length || 0) / 4));

            inputTokens = inputTokens || estimatedInput;
            outputTokens = outputTokens || estimatedOutput;

            // Fetch draft data if a draft was created
            let draftDataForMessage = null;
            if (lastDraftId) {
                try {
                    const drafts = await ctx.runQuery(api.contentDrafts.getUserContentDrafts, {
                        userId,
                    });
                    const createdDraft = drafts.find((d: any) => d._id === lastDraftId);
                    if (createdDraft) {
                        draftDataForMessage = {
                            title: createdDraft.title,
                            originalIdea: createdDraft.originalIdea,
                            platforms: createdDraft.platforms,
                            tone: createdDraft.tone,
                            imageStorageId: createdDraft.imageStorageId,
                        };
                    }
                } catch (err) {
                    console.error('Failed to fetch draft data:', err);
                }
            }

            // Store assistant response with draft ID if content was generated
            await ctx.runMutation(api.messages.createMessage, {
                chatId: conversationId,
                role: "assistant",
                content: String(result.text ?? "Content generated successfully."),
                draftId: lastDraftId ? (lastDraftId as any) : undefined,
            });

            // Credits tracking removed

            return {
                status: "success",
                message: lastDraftId ? "Content generated successfully" : "Response completed",
                output: result.text,
                hasDraft: !!lastDraftId,
                draftId: lastDraftId,
            };

        } catch (error: any) {
            console.error("Error in generate action:", error);

            // Store error message
            await ctx.runMutation(api.messages.createMessage, {
                chatId: conversationId,
                role: "assistant",
                content: `I encountered an error while processing your request: ${String(error.message)}. Please try again.`,
            });

            return {
                status: "error",
                message: error.message
            };
        }
    }
})