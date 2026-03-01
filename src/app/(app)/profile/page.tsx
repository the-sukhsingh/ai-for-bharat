"use client"
import React, { use, useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Check, User, Mail, Calendar, TrendingUp, Sparkles, Instagram, Linkedin, Twitter, Link2, Unlink, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import XConnectButton from '@/components/XConnectButton'
import LinkedinConnectButton from '@/components/LinkedinConnectButton';


const Page = () => {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; accountId?: string; platform?: string }>({ open: false })

  // Get user's social media accounts
  const socialAccounts = useQuery(
    api.users.getSocialAccounts,
    user ? { userId: user._id as Id<"users"> } : "skip"
  )

  const usage = useQuery(
    api.plans.getUserUsage,
    user ? { userId: user._id as Id<"users"> } : "skip"
  );

  // Mutations
  const unlinkAccount = useMutation(api.users.unlinkSocialAccount)

  // Handle OAuth callback messages
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    const reason = params.get('reason')

    if (success === 'x_connected') {
      toast.success('X (Twitter) account connected successfully!')
      window.history.replaceState({}, '', '/profile')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        x_auth_failed: 'Failed to connect X (Twitter) account',
        missing_parameters: 'Invalid OAuth response',
        invalid_state: 'Security validation failed',
        session_mismatch: 'Session validation failed',
        oauth_not_configured: 'OAuth is not configured',
        token_exchange_failed: 'Failed to exchange authorization code',
        profile_fetch_failed: 'Failed to fetch profile',
        user_not_found: 'User not found',
        unexpected_error: 'An unexpected error occurred',
        missing_code_verifier: 'Security validation failed (missing code verifier)',
      }
      toast.error(errorMessages[error] || 'Failed to connect account')
      window.history.replaceState({}, '', '/profile')
    }
  }, [])

  const handleUpgrade = async (planName: "basic" | "pro") => {
    if (!user?._id) return;

    const productId = planName === "basic"
      ? "pdt_0NVkfbJeSIbqQxDZFZpQA"
      : "pdt_0NVlZtyWjflp2R1yZP0H7";

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

      console.log(response)

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Failed to retrieve payment link.");
      }
    } catch (e: any) {
      toast.error(`Upgrade failed: ${e.message}`);
    }
  };

  const tiers = [
    {
      name: "Basic Plan",
      id: "basic" as const,
      price: "$49",
      description: "Everything you need for active social media presence.",
      features: [
        "Publish up to 1000 posts",
        "Generate up to 100 thumbnails",
        "No Script Generation"
      ],
      popular: true,
    },
    {
      name: "Pro Plan",
      id: "pro" as const,
      price: "$99",
      description: "Maximum limits for power users and agencies.",
      features: [
        "Publish up to 2000 posts",
        "Generate up to 200 thumbnails",
        "Generate up to 100 scripts"
      ],
      popular: false,
    },
  ]

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Not Authenticated</CardTitle>
            <CardDescription>Please sign in to view your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Social media platform configuration
  const platforms = [
    {
      id: 'linkedin' as const,
      name: 'LinkedIn',
      icon: Linkedin,
      bgColor: 'bg-muted/50',
      textColor: 'text-foreground',
    },
    {
      id: 'x' as const,
      name: 'X (Twitter)',
      icon: Twitter,
      bgColor: 'bg-muted/50',
      textColor: 'text-foreground',
    },
  ]

  const handleConnect = async (platformId: string, platformName: string) => {
    if (platformId === 'instagram') {
      window.location.href = '/api/auth/instagram/connect'
    } else {
      toast.info(`${platformName} integration coming soon`, {
        description: 'We are working on adding support for this platform.'
      })
    }
  }

  const handleDisconnect = async () => {
    if (!disconnectDialog.accountId) return

    try {
      await unlinkAccount({ accountId: disconnectDialog.accountId as any })
      setDisconnectDialog({ open: false })
    } catch (error) {
      console.error(error)
    }
  }

  const getConnectedAccount = (platformId: string) => {
    return socialAccounts?.find(account => account.platform === platformId && account.isActive)
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl selection:bg-neutral-200 dark:selection:bg-neutral-800">

      <div className="mb-12 space-y-2">
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account and connected platforms.</p>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-8 items-start mb-16 pb-12 border-b border-border/40">
        <Avatar className="h-32 w-32 rounded-full border border-border/50">
          <AvatarImage src={user.imageUrl} alt={user.name} />
          <AvatarFallback className="text-4xl font-serif font-light bg-muted/30">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-6 pt-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight mb-2">{user.name}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {formatDate(user.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-4 py-1.5 font-medium rounded-full shadow-none bg-background text-foreground border-border/60 capitalize">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              {user.plan || 'Free'} Plan
            </Badge>
          </div>
        </div>
      </div>


      {/* Social Media Accounts */}
      <div className="mb-16">
        <div className="mb-6">
          <h2 className="font-serif text-2xl tracking-tight mb-1">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Link your social media to publish directly from the platform.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((platform) => {
            const connectedAccount = getConnectedAccount(platform.id)
            const Icon = platform.icon

            return (
              <div key={platform.id} className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card hover:border-foreground/20 transition-colors">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${platform.bgColor}`}>
                      <Icon className={`h-5 w-5 ${platform.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="font-medium text-sm mb-2">{platform.name}</h3>
                      {connectedAccount ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-foreground text-background">
                              Connected
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            @{connectedAccount.username}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs w-fit rounded-full shadow-none"
                            onClick={() => setDisconnectDialog({
                              open: true,
                              accountId: connectedAccount._id,
                              platform: platform.name
                            })}
                          >
                            <Unlink className="h-3 w-3 mr-1.5" />
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                            Not Connected
                          </span>

                          <div className="pt-1">
                            {platform.id === 'x' && (
                              <XConnectButton userId={user._id} userEmail={user.email} />
                            )}
                            {platform.id === 'linkedin' && (
                              <LinkedinConnectButton userId={user._id} userEmail={user.email} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Usage Section */}
      {usage && (
        <div className="mb-16">
          <div className="mb-6">
            <h2 className="font-serif text-2xl tracking-tight mb-1">Monthly Usage</h2>
            <p className="text-sm text-muted-foreground">
              Track your feature usage for the current billing month.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/40 bg-card p-6">
              <h3 className="font-medium text-sm mb-2 text-muted-foreground">Posts</h3>
              <p className="text-2xl font-serif">{usage.posts} <span className="text-sm text-muted-foreground font-sans tracking-normal">published</span></p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-6">
              <h3 className="font-medium text-sm mb-2 text-muted-foreground">Thumbnails</h3>
              <p className="text-2xl font-serif">{usage.thumbnails} <span className="text-sm text-muted-foreground font-sans tracking-normal">generated</span></p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-6">
              <h3 className="font-medium text-sm mb-2 text-muted-foreground">Scripts</h3>
              <p className="text-2xl font-serif">{usage.scripts} <span className="text-sm text-muted-foreground font-sans tracking-normal">generated</span></p>
            </div>
          </div>
        </div>
      )}


      {/* Plan Upgrade Section */}
      <section id="pricing" className="mb-8 pt-8 border-t border-border/40">
        <div className="mb-6">
          <h2 className="font-serif text-2xl tracking-tight mb-1">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan to unlock more features and higher limits.
          </p>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 border ${tier.popular ? 'border-primary shadow-sm bg-card' : 'border-border/40 bg-background hover:border-border'}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-wider font-semibold">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="mb-6 text-center">
                <h3 className="text-sm font-medium tracking-tight mb-2 text-muted-foreground">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-1.5 mb-2">
                  <span className="font-serif text-4xl">{tier.price}</span><span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">{tier.description}</p>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-foreground/70 shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto">
                <Button
                  className="w-full rounded-xl"
                  variant={user.plan === tier.id ? "outline" : (tier.popular ? "default" : "outline")}
                  disabled={user.plan === tier.id}
                  onClick={() => handleUpgrade(tier.id)}
                >
                  {user.plan === tier.id ? "Current Plan" : "Upgrade"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialog.open} onOpenChange={(open) => setDisconnectDialog({ open })}>
        <AlertDialogContent className="rounded-2xl border-border/40 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl font-light">Disconnect {disconnectDialog.platform}?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will remove your {disconnectDialog.platform} account connection. You won't be able to publish to this account until you reconnect it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-full shadow-none border-border/60">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="rounded-full shadow-none bg-foreground text-background hover:bg-foreground/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Page