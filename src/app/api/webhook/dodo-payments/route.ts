import { Webhooks } from '@dodopayments/nextjs'
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from '../../../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const POST = Webhooks({
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_WEBHOOK_SECRET || "",
    onPaymentSucceeded: async (payload) => {
        console.log("Full payment webhook payload:", JSON.stringify(payload, null, 2));

        // The payload structure for Dodo Payments includes metadata
        // We expect userId and plan to be passed in metadata
        const metadata = (payload as any).data.metadata;
        const userId = metadata?.userId as Id<"users"> | undefined;
        const plan = metadata?.plan as "basic" | "pro" | undefined;

        console.log(`Webhook received: Succeeded payment for user ${userId}, plan: ${plan}`);
        console.log("Metadata received:", metadata);

        if (!userId) {
            console.error("No userId found in metadata:", metadata);
            return;
        }

        if (!plan || (plan !== 'basic' && plan !== 'pro')) {
            console.error("Invalid or missing plan:", plan);
            return;
        }

        try {
            console.log(`Upgrading user ${userId} to ${plan} plan`);
            // Use convex mutation API to upgrade user
            await convex.mutation(api.plans.upgradePlan, {
                userId: userId,
                plan: plan
            });
            console.log(`Successfully upgraded user ${userId} to ${plan}`);
        } catch (error) {
            console.error(`Error adding credits to user ${userId}:`, error);
            throw error; // Re-throw to let Dodo Payments know the webhook failed
        }
    },
});

// import { NextRequest, NextResponse } from "next/server";
// import { Webhook } from "standardwebhooks";

// const webhookSecret = process.env.DODOPAYMENTS_WEBHOOK_SECRET!;

// export async function POST(req: NextRequest) {
//     try {
//         // Get webhook headers
//         const webhookId = req.headers.get("webhook-id");
//         const webhookSignature = req.headers.get("webhook-signature");
//         const webhookTimestamp = req.headers.get("webhook-timestamp");

//         if (!webhookId || !webhookSignature || !webhookTimestamp) {
//             return NextResponse.json(
//                 { error: "Missing webhook headers" },
//                 { status: 400 }
//             );
//         }

//         // Get raw body
//         const body = await req.text();

//         // Verify webhook signature
//         const webhook = new Webhook(webhookSecret);

//         try {
//             await webhook.verify(body, {
//                 "webhook-id": webhookId,
//                 "webhook-signature": webhookSignature,
//                 "webhook-timestamp": webhookTimestamp,
//             });
//         } catch (err) {
//             console.error("Webhook verification failed:", err);
//             return NextResponse.json(
//                 { error: "Invalid webhook signature" },
//                 { status: 400 }
//             );
//         }

//         // Parse the verified payload
//         const payload = JSON.parse(body);
//         console.log("WEBHOOK", payload.data);

//         // Handle different webhook events
//         switch (payload.type) {
//             case "payment.succeeded":
//                 console.log("Payment succeeded:", payload.data);
//                 // Handle successful payment
//                 // Update your database, send confirmation email, etc.
//                 break;

//             case "payment.failed":
//                 console.log("Payment failed:", payload.data);
//                 // Handle failed payment
//                 break;

//             case "subscription.created":
//                 console.log("Subscription created:", payload.data);
//                 // Handle new subscription
//                 break;

//             case "subscription.cancelled":
//                 console.log("Subscription cancelled:", payload.data);
//                 // Handle subscription cancellation
//                 break;

//             case "subscription.updated":
//                 console.log("Subscription updated:", payload.data);
//                 // Handle subscription update
//                 break;

//             default:
//                 console.log("Unhandled webhook event:", payload.type);
//         }

//         // Return success response
//         return NextResponse.json(
//             { received: true, type: payload.type },
//             { status: 200 }
//         );
//     } catch (error) {
//         console.error("Webhook processing error:", error);
//         return NextResponse.json(
//             { error: "Webhook processing failed" },
//             { status: 500 }
//         );
//     }
// }