"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2 } from "lucide-react";

interface BuyCreditsButtonProps {
    productId: string;
    price: string;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export const BuyCreditsButton = ({ productId, price, variant = "default" }: BuyCreditsButtonProps) => {
    const { user, isAuthenticated } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleBuy = async () => {
        if (!isAuthenticated) {
            alert("Please sign in to buy credits.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch("/api/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prodID: productId,
                    userEmail: user?.email || "test@example.com",
                    userName: user?.name || "test",
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to create checkout session");
            }

            const data = await response.json();

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            alert("There was an error creating the checkout session. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant={variant}
            className="w-full rounded-xl py-6 font-bold text-lg group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleBuy}
            disabled={isLoading}
        >
            {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
                <>
                    <Rocket className="h-5 w-5 mr-2 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    Buy for {price}
                </>
            )}
        </Button>
    );
};
