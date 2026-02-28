import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            try {
                // Upsert user in Convex
                await convex.mutation(api.users.upsertUser, {
                    email: user.email,
                    name: user.name || "Unknown",
                    imageUrl: user.image || undefined,
                });
                return true;
            } catch (error) {
                console.error("Error saving user to Convex:", error);
                return false;
            }
        },
        async session({ session, token }) {
            if (session.user && session.user.email) {
                // Fetch user from Convex to get the user ID and credits
                const convexUser = await convex.query(api.users.getUserByEmail, {
                    email: session.user.email,
                });
                if (convexUser) {
                    session.user.id = convexUser._id;
                }
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    pages: {
        signIn: "/",
    },
});
