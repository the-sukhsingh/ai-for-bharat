import DodoPayments from 'dodopayments';
import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const client = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'your-default-api-key-here',
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT as 'live_mode' | 'test_mode' || 'live_mode', // defaults to 'live_mode'
});



export const POST = async (req: Request) => {

    try {
        const { prodID, userEmail, userName } = await req.json();

        const user = await convex.query(api.users.getUserByEmail, { email: userEmail });
        if (!user) {
            console.error("User not found for email:", userEmail);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }


        const session = await client.checkoutSessions.create({
            product_cart: [{ product_id: prodID, quantity: 1 }],
            customer: { email: userEmail, name: userName },
            return_url: process.env.DODO_PAYMENTS_RETURN_URL || 'https://media.plann.site/profile#pricing',
            metadata: {
                userId: user._id,
                plan: getPlanName(prodID)
            }
        });
        return NextResponse.json(session);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
};

const PLAN_MAP: Record<string, string> = {
    // These will be replaced by actual product IDs
    pdt_0NVkfbJeSIbqQxDZFZpQA: "basic",
    pdt_0NVlZtyWjflp2R1yZP0H7: "pro"
};

export const getPlanName = (prodId: string): string => {
    return PLAN_MAP[prodId] || "basic";
};
