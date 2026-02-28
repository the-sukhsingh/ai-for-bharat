"use client";

import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// User type based on your schema
export interface User {
    _id: Id<"users">;
    _creationTime: number;
    email: string;
    name: string;
    credits: number;
    imageUrl: string;
    createdAt: number;
}

// Auth context type
interface AuthContextType {
    user: User | null | undefined;
    isLoading: boolean;
    isAuthenticated: boolean;
    session: any;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const upsertUser = useMutation(api.users.upsertUser);

    // Get user from Convex based on session email
    const convexUser = useQuery(
        api.users.getUserByEmail,
        session?.user?.email ? { email: session.user.email } : "skip"
    );

    const isLoading = status === "loading" || (session && convexUser === undefined);

    // Sync user to Convex when session exists but user doesn't
    useEffect(() => {
        if (session?.user?.email && convexUser === null) {
            // User is authenticated but doesn't exist in Convex, create them
            upsertUser({
                email: session.user.email,
                name: session.user.name || session.user.email.split("@")[0],
                imageUrl: session.user.image || undefined,
            }).catch((error) => {
                console.error("Error syncing user to Convex:", error);
            });
        }
    }, [session, convexUser, upsertUser]);



    const value: AuthContextType = {
        user: convexUser as User | null | undefined,
        isLoading: isLoading as boolean,
        isAuthenticated: !!session && !!convexUser,
        session,
    };

    return <AuthContext.Provider value={ value } > { children } </AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
