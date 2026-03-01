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
