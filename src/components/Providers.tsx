"use client"
import React from 'react'
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from './theme/ThemeProvider'
import { AuthProvider } from '@/context/AuthContext'
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ContentDraftProvider } from '@/context/ContentDraftContext'
import { SocialScriptProvider } from '@/context/SocialScriptContext'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);


const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <SessionProvider>
                <ConvexProvider client={convex}>
                    <AuthProvider>
                        <ThemeProvider>
                            <ContentDraftProvider>
                                <SocialScriptProvider>
                                    <TooltipProvider>
                                        <main className="">
                                            {children}
                                        </main>
                                    </TooltipProvider>
                                </SocialScriptProvider>
                            </ContentDraftProvider>
                        </ThemeProvider>
                    </AuthProvider>
                </ConvexProvider >
            </SessionProvider >
        </>
    )
}

export default Providers

