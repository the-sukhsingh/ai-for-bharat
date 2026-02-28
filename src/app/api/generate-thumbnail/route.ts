import { NextRequest, NextResponse } from "next/server";
import { generateThumbnails } from "@/lib/thumbnail";
import { auth } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from '../../../../convex/_generated/dataModel';

// Opt out of caching; every request should send a new event
export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);


export async function POST(request: NextRequest) {
    try {

        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { prompt, mainImage, referenceImages, selectedTemplate, customTemplate, count } = body;

        // Convert base64 data URLs back to File objects
        const base64ToFile = (dataUrl: string, filename: string): File => {
            const arr = dataUrl.split(",");
            const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        };

        let mainImageFile: File | undefined;
        if (mainImage) {
            mainImageFile = base64ToFile(mainImage, "main-image.jpg");
        }

        let referenceImageFiles: File[] = [];
        if (referenceImages && Array.isArray(referenceImages)) {
            referenceImageFiles = referenceImages.map((img: string, idx: number) =>
                base64ToFile(img, `reference-${idx}.jpg`)
            );
        }

        // Handle custom template from YouTube if provided
        let templateToUse = selectedTemplate;
        if (customTemplate) {
            // Convert custom template to File and add to reference images
            const customTemplateFile = base64ToFile(customTemplate, "custom-template.jpg");
            referenceImageFiles.unshift(customTemplateFile); // Add as first reference
            templateToUse = null; // Don't use preset template
        }

        // Get user ID and credits
        const user = await convex.query(api.users.getUserByEmail, { email: session.user.email });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        if (user.credits < (count || 3)) {
            return NextResponse.json(
                { error: "Insufficient credits" },
                { status: 402 }
            );
        };


        const images = await generateThumbnails(
            prompt,
            mainImageFile,
            referenceImageFiles,
            templateToUse,
            count || 3
        );

        // Save thumbnails metadata to Convex
        for (const imgData of images) {
            await convex.action(api.thumbnails.saveThumbnail, {
                imageData: imgData.data,
                mimeType: imgData.mimeType,
                prompt,
                hasMainImage: !!mainImageFile,
                hasTemplate: !!templateToUse || !!customTemplate,
                referenceCount: referenceImageFiles.length,
                email: session.user.email,
            });
        }

        // Deduct credits from user
        await convex.mutation(api.users.deductCredits, {
            userId: user._id,
            amount: count || 3,
        });

        return NextResponse.json({ images });
    } catch (error) {
        console.error("Error generating thumbnails:", error);
        return NextResponse.json(
            { error: "Failed to generate thumbnails" },
            { status: 500 }
        );
    }
}
