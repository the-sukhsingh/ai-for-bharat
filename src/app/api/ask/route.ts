import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from '../../../../convex/_generated/dataModel';

// Opt out of caching; every request should send a new event
export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Create a simple async Next.js API route handler
export async function POST(request: Request) {
    try {
        // Get authenticated user
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const question = formData.get('question') as string;
        const chatId = formData.get('chatId') as string | null;
        const chatType = (formData.get('chatType') as 'contentDraft' | 'socialScript') || 'contentDraft';
        const files = formData.getAll('file');
        const contextDataRaw = formData.get('contextData') as string | null;
        // Parse context data if available
        let contextData = null;
        if (contextDataRaw) {
            try {
                contextData = JSON.parse(contextDataRaw);
            } catch (error) {
                console.error('Failed to parse context data:', error);
            }
        }


        if (!question) {
            return NextResponse.json(
                { error: "Question is required" },
                { status: 400 }
            );
        }

        // Get user ID and credits
        const user = await convex.query(api.users.getUserByEmail, { email: session.user.email });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Estimate required credits deterministically before processing
        // We'll estimate tokens based on question length + recent messages (deterministic, adjustable)
        let recentMessages: any[] = [];
        if (chatId) {
            try {
                recentMessages = await convex.query(api.messages.listChatMessages, {
                    userId: user._id,
                    chatId: chatId as Id<"chats">
                });
            } catch (e) {
                recentMessages = [];
            }
        }

        // Build a conservative estimate of input characters
        const historySample = (recentMessages || []).slice(-5).map(m => m.content).join('\n');
        const chars = (historySample + '\n' + question).length;
        const estimatedInputTokens = Math.max(1, Math.ceil(chars / 4));
        // Estimate output tokens conservatively: half of inputTokens + 128, capped
        const estimatedOutputTokens = Math.min(2048, Math.max(64, Math.ceil(estimatedInputTokens * 0.5) + 128));

        const effectiveTokens = estimatedInputTokens + (4 * estimatedOutputTokens);
        const estimatedCredits = Math.min(8, Math.max(1, Math.ceil(effectiveTokens / 2000)));

        if (user.credits < estimatedCredits) {
            return NextResponse.json(
                { error: "Insufficient credits", estimatedCredits },
                { status: 403 }
            );
        }

        // We do NOT deduct here. Charging happens after successful AI response to ensure we only charge for completed work.  


        // Get or create conversation based on chatId
        let conversation: { _id: Id<"chats">; title: string };

        if (chatId) {
            // Convert chatId string to Id<"chats">
            const chatIdTyped = chatId.toString() as Id<"chats">;

            // Get existing conversation
            const existingChat = await convex.query(api.chats.getChatSimple, {
                userId: user._id,
                chatId: chatIdTyped,
            });

            if (!existingChat) {
                return NextResponse.json(
                    { error: "Conversation not found" },
                    { status: 404 }
                );
            }

            // Update conversation timestamp happens automatically in Convex
            conversation = { _id: existingChat._id, title: existingChat.title };
        } else {
            // Create new conversation (this also creates the first message)
            const newChatId = await convex.mutation(api.chats.createChat, {
                userId: user._id,
                message: question,
                type: chatType,
            });

            conversation = {
                _id: newChatId,
                title: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
            };
        }

        // Store user message (only for existing conversations)
        let userMessageId: Id<"messages">;
        if (chatId) {
            userMessageId = await convex.mutation(api.messages.createMessage, {
                chatId: conversation._id,
                role: "user",
                content: question,
            });
        } else {
            // For new chats, get the message ID that was created with the chat
            const chatMessages = await convex.query(api.messages.listChatMessages, {
                userId: user._id,
                chatId: conversation._id,
            });
            userMessageId = chatMessages[0]._id;
        }

        // Process files to get their metadata
        const fileData = await Promise.all(
            files.map(async (file) => {
                if (file instanceof File) {
                    const arrayBuffer = await file.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    return {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: base64,
                    };
                }
                return null;
            })
        );

        const filteredFileData = fileData.filter(f => f !== null);

        // Call the appropriate Convex action based on chat type
        const result = chatType === 'socialScript'
            ? await convex.action(api.ai_socialScripts.generateSocialScript, {
                question,
                files: filteredFileData,
                userEmail: session.user.email,
                conversationId: conversation._id,
                messageId: userMessageId,
                contextData,
            })
            : await convex.action(api.ai.generateContentDraft, {
                question,
                files: filteredFileData,
                userEmail: session.user.email,
                conversationId: conversation._id,
                messageId: userMessageId,
                contextData,
            });
        return NextResponse.json({
            success: true,
            message: result.status === "success" ? "Question processed successfully" : "Error processing question",
            conversationId: conversation._id,
            messageId: userMessageId,
            uploads: filteredFileData,
            estimatedCredits,
            result
        });

    } catch (error) {
        console.error("Error in ask route:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}