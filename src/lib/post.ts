import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export interface GeneratedImage {
    id: string;
    data: string; // base64 encoded image
    mimeType: string;
}

/**
 * Generate a social media post image with 16:9 aspect ratio
 * @param prompt - Description of the image to generate
 * @param platform - Optional platform context ( twitter, linkedin, blog)
 * @returns Generated image in 16:9 ratio
 */
export async function generatePostImage(
    prompt: string,
    platform?: "twitter" | "linkedin" 
): Promise<GeneratedImage | null> {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY! });

    // Build platform-specific guidance
    let platformGuidance = "";
    switch (platform) {
        case "twitter":
            platformGuidance = "Twitter/X style: clean, informative, easy to digest at a glance. Professional yet approachable.";
            break;
        case "linkedin":
            platformGuidance = "LinkedIn style: professional, polished, business-appropriate. Focus on credibility and expertise.";
            break;
        default:
            platformGuidance = "Generic social media style: engaging, shareable, visually appealing.";
    }

    const imagePrompt = `Create a professional social media post image for this content: ${prompt}

Style guidelines:
- ${platformGuidance}
- Use high-contrast colors and clear visual hierarchy
- Make it eye-catching and shareable
- Aspect ratio must be 16:9 (suitable for most social media platforms)
- Professional quality with modern design aesthetics
- Include relevant visual elements that enhance the message
- Ensure text (if any) is readable and not cluttered`;

    try {
        const result = await generateText({
            model: google("gemini-2.5-flash-image"),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: imagePrompt,
                        },
                    ],
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

        // Extract the first image from result.files
        for (const file of result.files) {
            if (file.mediaType.startsWith("image/")) {
                const uint8Array = await file.uint8Array;
                const base64 = btoa(
                    uint8Array.reduce(
                        (data, byte) => data + String.fromCharCode(byte),
                        "",
                    ),
                );

                return {
                    id: `post-${Date.now()}`,
                    data: base64,
                    mimeType: file.mediaType,
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error generating post image:", error);
        return null;
    }
}
