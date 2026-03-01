import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { GoogleGenAI, Type } from '@google/genai';
import { internal } from "./_generated/api";
const MAX_LOOPS = 5;

// Helper to extract sections from generated script
function extractSection(marker: string, text: string): string {
    const startIndex = text.indexOf(marker);
    if (startIndex === -1) return '';
    const contentStart = startIndex + marker.length;
    const remainingText = text.substring(contentStart);
    const nextMarkerIndex = remainingText.search(/---[A-Z]+/);
    return (nextMarkerIndex > 0
        ? remainingText.substring(0, nextMarkerIndex)
        : remainingText).trim();
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

// Tool handlers for social script AI functions
const createSocialScriptToolHandlers = (ctx: any) => ({
    generate_social_script: async ({ userId, title, platform, idea, duration, style, websiteUrl, additionalContext }: any): Promise<any> => {
        try {
            // Check plan limits
            const planCheck: any = await ctx.runQuery(api.plans.checkPlanLimits, {
                userId: userId as Id<"users">,
                feature: "scripts"
            });
            if (!planCheck.allowed) {
                return { success: false, error: `Plan limit reached. Your ${planCheck.plan} plan allows up to ${planCheck.limit} scripts this month. Please upgrade your plan.` };
            }

            let enrichedContext = idea;

            // Fetch website content if provided
            if (websiteUrl) {
                const urlContent = await fetchUrlContent(websiteUrl);
                if (urlContent) {
                    enrichedContext += `\n\nWebsite Context:\n${urlContent}`;
                }
            }

            // Add additional context
            if (additionalContext) {
                enrichedContext += `\n\nAdditional Context:\n${additionalContext}`;
            }

            // Generate script using Gemini
            const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
            const targetDuration = duration || 60;
            const contentStyle = style || 'tutorial';

            const scriptPrompt = `You are a social media script writer AI specializing in ${platform} content. Generate a complete video script based on the following:

Title: ${title}
Platform: ${platform}
Duration: ${targetDuration} seconds
Style: ${contentStyle}

Idea: ${idea}

Context: ${enrichedContext}

IMPORTANT: Format your response EXACTLY as follows:

---HOOK---
[Write an attention-grabbing hook (3-5 seconds) that makes viewers stop scrolling]

---SECTION: Introduction---
[Write the introduction section here with timing guidance]

---SECTION: Main Point 1---
[Write main point 1 content here]

---SECTION: Main Point 2---
[Write main point 2 content here]

---SECTION: Main Point 3---
[Write main point 3 content here (if applicable)]

---SECTION: Conclusion---
[Write the conclusion section here]

---CTA---
[Write a clear call-to-action that encourages engagement]

---HASHTAGS---
#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5

Guidelines for ${platform}:
${platform === 'instagram' ? `
- Keep it punchy and fast-paced
- Use trending audio references
- Include visual cues for editing
- Optimize for vertical video (16:9)
- Max 90 seconds duration
` : `
- Include timestamps for chapters
- Detailed explanations
- Viewer retention focus
- SEO-optimized language
- Include links/resources mentions
`}

Style Guidelines for ${contentStyle}:
${contentStyle === 'tutorial' ? '- Step-by-step instructions\n- Clear, actionable advice\n- "How to" format' : ''}
${contentStyle === 'story' ? '- Narrative arc\n- Personal experience\n- Emotional connection' : ''}
${contentStyle === 'tips' ? '- Quick, actionable tips\n- Numbered list format\n- High value density' : ''}
${contentStyle === 'explainer' ? '- Educational content\n- Complex → Simple\n- Use analogies' : ''}

Target duration: ${targetDuration} seconds
Write naturally and conversationally. Include visual suggestions in [brackets]. DO NOT add commentary - just output the structured script.`;

            const result = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: 'user', parts: [{ text: scriptPrompt }] }],
            });

            const generatedScript = result.text || '';

            // Extract hook
            const hook = extractSection('---HOOK---', generatedScript);

            // Extract script sections using regex exec loop
            const scriptSections = [];
            const sectionRegex = /---SECTION: ([^-]+)---/g;
            let match;
            while ((match = sectionRegex.exec(generatedScript)) !== null) {
                const heading = match[1].trim();
                const marker = `---SECTION: ${heading}---`;
                const content = extractSection(marker, generatedScript);

                // Estimate duration based on word count (average speaking rate: 150 words/minute)
                const wordCount = content.split(/\s+/).length;
                const estimatedDuration = Math.ceil((wordCount / 150) * 60);

                scriptSections.push({
                    heading,
                    content,
                    duration: estimatedDuration
                });
            }

            // Extract CTA
            const cta = extractSection('---CTA---', generatedScript);

            // Extract hashtags
            const hashtagsSection = extractSection('---HASHTAGS---', generatedScript);
            const hashtags = hashtagsSection.match(/#\w+/g) || [];

            // Save to database
            const scriptId: any = await ctx.runMutation(api.socialScripts.createSocialScript, {
                userId: userId as Id<"users">,
                title,
                platform: platform as any,
                hook,
                scriptSections,
                cta,
                hashtags,
            });

            return {
                success: true,
                scriptId,
                script: {
                    hook,
                    sections: scriptSections,
                    cta,
                    hashtags
                },
                message: `Generated ${platform} script with ${scriptSections.length} sections`
            };
        } catch (error: any) {
            console.error('Script generation error:', error);
            return { success: false, error: error.message || 'Failed to generate script' };
        }
    },
    get_social_scripts: async ({ userId, platform }: any): Promise<any> => {
        try {
            const scripts: any = await ctx.runQuery(api.socialScripts.getUserSocialScripts, {
                userId: userId as Id<"users">,
                platform: platform as any
            });

            return { success: true, scripts };
        } catch (error: any) {
            return { success: false, error: 'Failed to retrieve scripts' };
        }
    },
    edit_social_script: async ({ scriptId, userId, updates }: any): Promise<any> => {
        try {
            // Validate inputs
            if (!scriptId || !userId) {
                return { success: false, error: 'Missing required parameters: scriptId and userId' };
            }

            // Check if scriptId looks like a Convex ID (starts with appropriate prefix)
            if (typeof scriptId !== 'string' || !scriptId.includes('_')) {
                return { success: false, error: 'Invalid script ID format' };
            }
            console.log(`Editing script ${scriptId} for user ${userId} with updates:`, updates);
            // First verify the script exists and belongs to the user
            const script: any = await ctx.runQuery(api.socialScripts.getSocialScriptById, {
                scriptId: scriptId as Id<"socialScripts">,
                requestingUserId: userId as Id<"users">
            });

            if (!script) {
                return { success: false, error: 'Script not found or access denied' };
            }

            // Update the script
            await ctx.runMutation(api.socialScripts.updateSocialScript, {
                scriptId: scriptId as Id<"socialScripts">,
                userId: userId as Id<"users">,
                ...updates
            });

            return {
                success: true,
                message: `Script "${script.title}" updated successfully`,
                scriptId
            };
        } catch (error: any) {
            console.error('Edit script error:', error);
            return { success: false, error: error.message || 'Failed to update script' };
        }
    },
    remove_social_script: async ({ scriptId, userId }: any): Promise<any> => {
        try {
            // Validate inputs
            if (!scriptId || !userId) {
                return { success: false, error: 'Missing required parameters: scriptId and userId' };
            }

            // Check if scriptId looks like a Convex ID (starts with appropriate prefix)
            if (typeof scriptId !== 'string' || !scriptId.includes('_')) {
                return { success: false, error: 'Invalid script ID format' };
            }

            // First verify the script exists and belongs to the user
            const script: any = await ctx.runQuery(api.socialScripts.getSocialScriptById, {
                scriptId: scriptId as Id<"socialScripts">,
                requestingUserId: userId as Id<"users">
            });

            if (!script) {
                return { success: false, error: 'Script not found or access denied' };
            }

            // Delete the script
            await ctx.runMutation(api.socialScripts.deleteSocialScript, {
                scriptId: scriptId as Id<"socialScripts">,
                userId: userId as Id<"users">
            });

            return {
                success: true,
                message: `Script "${script.title}" deleted successfully`,
                deletedScriptId: scriptId
            };
        } catch (error: any) {
            console.error('Remove script error:', error);
            return { success: false, error: error.message || 'Failed to delete script' };
        }
    },
    get_script_details: async ({ scriptId, userId }: any): Promise<any> => {
        try {
            // Validate inputs
            if (!scriptId || !userId) {
                return { success: false, error: 'Missing required parameters: scriptId and userId' };
            }

            // Check if scriptId looks like a Convex ID (starts with appropriate prefix)
            if (typeof scriptId !== 'string' || !scriptId.includes('_')) {
                return { success: false, error: 'Invalid script ID format' };
            }

            const script: any = await ctx.runQuery(api.socialScripts.getSocialScriptById, {
                scriptId: scriptId as Id<"socialScripts">,
                requestingUserId: userId as Id<"users">
            });

            if (!script) {
                return { success: false, error: 'Script not found or access denied' };
            }

            return { success: true, script };
        } catch (error: any) {
            console.error('Get script details error:', error);
            return { success: false, error: error.message || 'Failed to retrieve script details' };
        }
    },
});

// Tool declarations for social script generation
const socialScriptToolDeclarations = [
    {
        name: "generate_social_script",
        description: "Generate a structured video script for social media platforms (Instagram Reel or YouTube). Creates a complete script with hook, sections, CTA, and hashtags.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user creating the script",
                },
                title: {
                    type: Type.STRING,
                    description: "Title/name for this video script",
                },
                platform: {
                    type: Type.STRING,
                    description: "Platform for the script: 'instagram' or 'youtube'.",
                },
                idea: {
                    type: Type.STRING,
                    description: "The core idea or topic for the video",
                },
                duration: {
                    type: Type.NUMBER,
                    description: "Target duration in seconds (30, 60, 90, 150).",
                },
                style: {
                    type: Type.STRING,
                    description: "Content style: 'tutorial', 'story', 'tips', or 'explainer'.",
                },
                websiteUrl: {
                    type: Type.STRING,
                    description: "Optional website URL to fetch content for context",
                },
                additionalContext: {
                    type: Type.STRING,
                    description: "Optional additional text context (notes, bullets, etc.)",
                },
            },
            required: ["userId", "title", "platform", "idea"],
        },
    } as const,
    {
        name: "get_social_scripts",
        description: "Retrieve user's saved video scripts, optionally filtered by platform.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user whose scripts to retrieve",
                },
                platform: {
                    type: Type.STRING,
                    description: "Optional platform filter: 'instagram' or 'youtube'",
                },
            },
            required: ["userId"],
        },
    } as const,
    {
        name: "edit_social_script",
        description: "Edit an existing video script. Can update title, hook, sections, CTA, hashtags, or platform.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                scriptId: {
                    type: Type.STRING,
                    description: "The ID of the script to edit",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the script",
                },
                updates: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "New title for the script",
                        },
                        platform: {
                            type: Type.STRING,
                            description: "New platform: 'instagram' or 'youtube'",
                        },
                        hook: {
                            type: Type.STRING,
                            description: "New hook content",
                        },
                        scriptSections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    heading: { type: Type.STRING },
                                    content: { type: Type.STRING },
                                    duration: { type: Type.NUMBER },
                                }
                            },
                            description: "New script sections array",
                        },
                        cta: {
                            type: Type.STRING,
                            description: "New call-to-action content",
                        },
                        hashtags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "New hashtags array",
                        },
                    },
                    required: [],
                },
            },
            required: ["scriptId", "userId", "updates"],
        },
    } as const,
    {
        name: "remove_social_script",
        description: "Delete a video script permanently.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                scriptId: {
                    type: Type.STRING,
                    description: "The ID of the script to delete",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the script",
                },
            },
            required: ["scriptId", "userId"],
        },
    } as const,
    {
        name: "get_script_details",
        description: "Get detailed information about a specific script.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                scriptId: {
                    type: Type.STRING,
                    description: "The ID of the script to retrieve",
                },
                userId: {
                    type: Type.STRING,
                    description: "The ID of the user who owns the script",
                },
            },
            required: ["scriptId", "userId"],
        },
    } as const,
];

export const generateSocialScript = action({
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
        hasScript: v.optional(v.boolean()),
        scriptId: v.optional(v.union(v.string(), v.null())),
    }),
    handler: async (ctx, args) => {
        const { question, files, userEmail, conversationId, messageId, contextData } = args;

        try {
            // Get user from email
            const user: any = await ctx.runQuery(api.users.getUserByEmail, { email: userEmail });
            if (!user) {
                throw new Error("User not found");
            }

            // Get chat history for context
            const chat: any = await ctx.runQuery(api.chats.getChat, {
                userId: user._id,
                chatId: conversationId
            });

            if (!chat || chat.type !== "socialScript") {
                throw new Error("Invalid chat or wrong chat type for social script generation");
            }

            // Build conversation history for Gemini (latest 10 messages)
            const conversationHistory = chat.messages
                .slice(-10)
                .map((msg: any) => ({
                    role: msg.role === 'user' ? 'user' as const : 'model' as const,
                    parts: [{ text: msg.content }]
                }));

            let userPrompt = question;

            // Add context data if available
            if (contextData) {
                if (contextData.post) {
                    const { title, activeTab, id } = contextData.post;
                    userPrompt += `\n\nContext: I'm currently viewing a post titled "${title}".`;
                    if (activeTab) {
                        userPrompt += ` I'm currently on the ${activeTab} tab.`;
                    }
                    if (id) {
                        userPrompt += `\nPost ID: ${id}`;
                    }
                }

                if (contextData.script) {
                    const { title, hook, id } = contextData.script;
                    userPrompt += `\n\nContext: I'm currently viewing a script titled "${title}".`;
                    if (hook) {
                        userPrompt += `\nScript hook: ${hook}`;
                    }
                    if (id) {
                        userPrompt += `\nScript ID: ${id}`;
                    }
                }

                userPrompt += '\n\nPlease consider this context when helping me only when I ask you to edit, delete or take reference from the currently opened script. If I ask you to generate a new script, use the context only when I explicitly ask you to take reference from the currently opened script. Otherwise, you can ignore the context and generate a new script based on the new prompt.';
            }

            const userParts: any[] = [{ text: userPrompt }];

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

            conversationHistory.push({
                role: 'user' as const,
                parts: userParts
            });

            // Initialize Gemini
            const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });
            const toolHandlers = createSocialScriptToolHandlers(ctx);

            // Start generation with tools
            let result: any = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: conversationHistory,
                config: {
                    tools: [{
                        functionDeclarations: socialScriptToolDeclarations as any,

                    }],
                    systemInstruction: `You are a specialized AI assistant for generating video scripts for Instagram Reels and YouTube videos.

Your workflow:
1. For NEW scripts: Ask for preferences first using ask_script_preferences, then generate_social_script
2. For EDITING scripts: Use edit_social_script to modify existing scripts
3. For DELETING scripts: Use remove_social_script to delete scripts
4. For VIEWING scripts: Use get_social_scripts to list scripts or get_script_details for specific scripts

Available tools:
- ask_script_preferences: Gather user preferences for new scripts
- generate_social_script: Create new video scripts 
- get_social_scripts: List user's saved scripts
- get_script_details: Get detailed info about a specific script
- edit_social_script: Modify existing scripts (title, content, platform, etc.)
- remove_social_script: Delete scripts permanently


Be conversational, helpful, and focused on creating engaging video content. Ask clarifying questions if needed.
User Id is ${user._id}, use it when calling any script functions.`,
                },
            });

            let loopCount = 0;

            while (result.functionCalls && result.functionCalls.length > 0 && loopCount < MAX_LOOPS) {
                loopCount++;
                // Execute all function calls
                const functionResults = await Promise.all(
                    result.functionCalls.map(async (call: any) => {
                        try {
                            const handler = toolHandlers[call.name as keyof typeof toolHandlers];
                            if (!handler) {
                                return { name: call.name, response: { error: 'Unknown function' } };
                            }

                            const response = await handler(call.args);
                            return { name: call.name, response };
                        } catch (error: any) {
                            console.error(`Error executing function ${call.name}:`, error);
                            return {
                                name: call.name,
                                response: {
                                    error: error.message || 'Function execution failed'
                                }
                            };
                        }
                    })
                );


                // Check if a script was generated
                const scriptResult = functionResults.find((r: any) => r.name === 'generate_social_script');
                if (scriptResult && scriptResult.response?.success) {
                    // Update the message with the script ID
                    await ctx.runMutation(api.messages.updateMessage, {
                        userId: user._id,
                        messageId: messageId,
                        content: question,
                    });

                    const successMessage = `✅ Script generated successfully!\n\n**${scriptResult.response.message}**\n\n${result.text || 'Your video script is ready. You can view it in the Scripts section.'}`;

                    // Save the AI success message to the database
                    await ctx.runMutation(api.messages.createMessage, {
                        chatId: conversationId,
                        role: "assistant",
                        content: successMessage,
                    });

                    return {
                        status: 'success',
                        output: successMessage,
                        hasScript: true,
                        scriptId: scriptResult.response.scriptId
                    };
                }

                // Continue the conversation with function results
                const modelParts = [];
                if (result.text) {
                    modelParts.push({ text: result.text });
                }
                if (result.functionCalls && result.functionCalls.length > 0) {
                    modelParts.push(...result.functionCalls.map((call: any) => ({ functionCall: call })));
                }

                conversationHistory.push({
                    role: 'model' as const,
                    parts: modelParts
                });

                conversationHistory.push({
                    role: 'user' as const,
                    parts: functionResults.map(r => ({
                        functionResponse: {
                            name: r.name,
                            response: r.response
                        }
                    }))
                });

                result = await genAI.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: conversationHistory,
                    config: {
                        tools: [{
                            functionDeclarations: socialScriptToolDeclarations as any,

                        }],
                        systemInstruction: `You are a specialized AI assistant for generating video scripts for Instagram Reels and YouTube videos.

Your workflow:
1. For NEW scripts: Use generate_social_script directly to generate the script. Infer platform, duration, and style from context, or select a sensible default.
2. For EDITING scripts: Use edit_social_script to modify existing scripts
3. For DELETING scripts: Use remove_social_script to delete scripts
4. For VIEWING scripts: Use get_social_scripts to list scripts or get_script_details for specific scripts

Available tools:
- generate_social_script: Create new video scripts 
- get_social_scripts: List user's saved scripts
- get_script_details: Get detailed info about a specific script
- edit_social_script: Modify existing scripts (title, content, platform, etc.)
- remove_social_script: Delete scripts permanently


Be conversational, helpful, and focused on creating engaging video content. Ask clarifying questions if needed.
User Id is ${user._id}, use it when calling any script functions.`,
                    },
                });
            }

            // Save the final AI response to the database
            const finalMessage = result.text || 'Script generation completed';
            await ctx.runMutation(api.messages.createMessage, {
                chatId: conversationId,
                role: "assistant",
                content: finalMessage,
            });

            // Return final response
            return {
                status: 'success',
                output: finalMessage,
                message: 'Response generated'
            };

        } catch (error: any) {
            console.error('Social script generation error:', error);
            return {
                status: 'error',
                message: error.message || 'An error occurred during script generation'
            };
        }
    }
});
