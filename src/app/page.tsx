"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowRight, Sparkles, Check, Shield, Zap, Layers, PlayCircle, Image as ImageIcon, Twitter, Linkedin } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVideoOpen(false);
    };
    if (videoOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [videoOpen]);

  return (
    <>
      {/* Video Modal */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setVideoOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
          <div
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-border/50"
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="aspect-video w-full">
              <iframe
                src="https://www.youtube.com/embed/E9mT5rrlyhs?autoplay=1"
                title="Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <button
              onClick={() => setVideoOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              aria-label="Close video"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <style>{`
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
    `}</style>
      <div className="min-h-screen w-full bg-background selection:bg-primary/20">

        {/* 1. Hero Section */}
        <section className="relative pt-20 pb-20 md:pt-24 md:pb-12 overflow-hidden">
          {/* Abstract Background Shapes */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-[10%] left-[20%] w-160 h-160 bg-primary/10 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-color-dodge animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute top-[20%] right-[20%] w-140 h-140 bg-secondary/10 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-color-dodge animate-pulse" style={{ animationDuration: '10s' }} />
          </div>

          <div className="max-w-5xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-8 border border-primary/20 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Content Generation</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif tracking-tighter mb-6 text-foreground drop-shadow-sm">
              Create platform-perfect <br />
              <span className="text-primary italic">content in seconds</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Transform your ideas into engaging, tailored posts for X and LinkedIn, and auto-generate eye-catching thumbnails. Train the AI with your unique style and watch it write exactly like you do.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="rounded-full px-8 text-base h-14 shadow-lg shadow-primary/25" onClick={() => !isAuthenticated ? signIn("google") : undefined} asChild={isAuthenticated}>
                {isAuthenticated ? (
                  <Link href="/posts">
                    Start Creating <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                ) : (
                  <>Start Creating <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-8 text-base h-14 bg-background/50 backdrop-blur-sm" asChild>
                <Link href="#how-it-works">
                  See how it works
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 2. How it works */}
        <section id="how-it-works" className="py-16 bg-accent/20 border-y border-border/40 relative">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-serif tracking-tighter mb-4">See It In Action</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Watch how easy it is to generate, edit, and publish content across all your social platforms directly from our studio.</p>
            </div>
            <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-border/50 shadow-2xl bg-muted/40 group w-full max-w-4xl mx-auto backdrop-blur-sm">
              {/* Embedded Youtube link placeholder using an aesthetic visual */}
              <div className="absolute inset-0 bg-linear-to-tr from-primary/10 to-secondary/10" />
              <div className="absolute inset-0 flex items-center justify-center transition-all group-hover:bg-background/20">
                <button onClick={() => setVideoOpen(true)} className="flex flex-col items-center gap-4 transform transition-all duration-300 group-hover:scale-110 cursor-pointer border-none bg-transparent">
                  <div className="h-24 w-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-xl shadow-primary/30 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
                    <PlayCircle className="h-12 w-12 ml-1" />
                  </div>
                  <span className="font-medium text-lg tracking-tight bg-background/80 px-4 py-1.5 rounded-full border border-border/50 backdrop-blur-md">Watch Demo Video</span>
                </button>
              </div>

              {/* Decorative app UI elements scattered behind the play button */}
              <div className="absolute top-8 left-8 p-4 rounded-xl bg-background/80 backdrop-blur-md border border-border/50 shadow-sm opacity-60 group-hover:opacity-40 transition-opacity hidden md:block w-48">
                <div className="h-2 w-1/2 bg-muted rounded-full mb-3" />
                <div className="h-2 w-full bg-muted rounded-full mb-2" />
                <div className="h-2 w-3/4 bg-muted rounded-full" />
              </div>
              <div className="absolute bottom-8 right-8 p-4 rounded-xl bg-background/80 backdrop-blur-md border border-border/50 shadow-sm opacity-60 group-hover:opacity-40 transition-opacity hidden md:block w-48">
                <div className="flex gap-2 mb-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-2 w-full bg-muted rounded-full" />
                    <div className="h-2 w-5/6 bg-muted rounded-full" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 3. Features (Bento Grid) */}
        <section className="py-24 relative">
          <div className="max-w-5xl mx-auto px-4">
            <div className="mb-16">
              <h2 className="text-3xl md:text-5xl font-serif tracking-tighter mb-4">Everything you need</h2>
              <p className="text-muted-foreground text-lg">Powerful AI tools packed into an intuitive, beautiful interface.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <Card className="md:col-span-2 bg-card border-border/40 shadow-sm overflow-hidden flex flex-col justify-between group hover:border-primary/30 transition-colors">
                <CardHeader className="pb-0">
                  <div className="p-3 bg-primary/10 w-fit rounded-xl mb-4">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-serif tracking-tight font-light">AI-Powered Generation</CardTitle>
                  <CardDescription className="text-base text-muted-foreground/80 max-w-md">Generate contextual, high-quality posts tailored for specific platforms with native understanding of character limits, hashtags, and tone.</CardDescription>
                </CardHeader>
                <div className="p-6 pt-0 mt-8 flex justify-end">
                  <div className="w-[85%] h-32 bg-accent/30 rounded-tl-2xl border-t border-l border-border/50 translate-x-6 translate-y-6 flex items-start p-4 relative overflow-hidden group-hover:-translate-y-2 group-hover:-translate-x-2 transition-transform duration-500">
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />
                    <div className="space-y-3 w-full opacity-80">
                      <div className="h-3 w-1/4 bg-primary/20 rounded-full" />
                      <div className="h-3 w-full bg-muted-foreground/10 rounded-full" />
                      <div className="h-3 w-5/6 bg-muted-foreground/10 rounded-full" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Feature 2 */}
              <Card className="border-border/40 shadow-sm overflow-hidden flex flex-col justify-between group hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="p-3 bg-secondary/10 w-fit rounded-xl mb-4">
                    <Layers className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-xl font-serif tracking-tight font-light">Multi-Platform</CardTitle>
                  <CardDescription>Native support for your favorite networks.</CardDescription>
                </CardHeader>
                <div className="flex justify-center gap-6 py-8 pb-10">
                  <div className="p-3 rounded-xl bg-accent group-hover:-translate-y-2 transition-transform duration-300">
                    <Twitter className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="p-3 rounded-xl bg-accent group-hover:-translate-y-2 transition-transform duration-300 delay-75">
                    <Linkedin className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="p-3 rounded-xl bg-accent group-hover:-translate-y-2 transition-transform duration-300 delay-150 relative group/thumbnail">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover/thumbnail:opacity-100 transition-opacity font-medium pointer-events-none">Thumbnails</div>
                    <ImageIcon className="h-6 w-6 text-foreground" />
                  </div>
                </div>
              </Card>

              {/* Feature 3 */}
              <Card className="border-border/40 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-colors overflow-hidden relative">
                <CardHeader className="relative z-10">
                  <div className="p-3 bg-amber-500/10 w-fit rounded-xl mb-4">
                    <Zap className="h-6 w-6 text-amber-500" />
                  </div>
                  <CardTitle className="text-xl font-serif tracking-tight font-light">Lightning Fast</CardTitle>
                  <CardDescription>From idea to draft in seconds. Stop staring at blank screens.</CardDescription>
                </CardHeader>
                <div className="absolute right-0 bottom-0 text-amber-500/5 group-hover:text-amber-500/10 transition-colors translate-x-4 translate-y-4">
                  <Zap className="h-48 w-48" />
                </div>
              </Card>

              {/* Feature 4 */}
              <Card className="md:col-span-2 border-border/40 shadow-sm overflow-hidden flex flex-col justify-between group hover:border-primary/30 transition-colors relative">
                <CardHeader className="relative z-10">
                  <div className="p-3 bg-emerald-500/10 w-fit rounded-xl mb-4">
                    <Shield className="h-6 w-6 text-emerald-500" />
                  </div>
                  <CardTitle className="text-2xl font-serif tracking-tight font-light">Social Scripts</CardTitle>
                  <CardDescription className="text-base max-w-lg">Store your personal scripts, tone guidelines, and templates. The AI reads your unique identity instructions to write exactly like you do.</CardDescription>
                </CardHeader>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 h-32 bg-background border border-border/50 shadow-sm rounded-xl p-4 hidden sm:block rotate-3 group-hover:rotate-0 transition-transform duration-300 z-0 mask-b-from-70%">
                  <div className="text-xs text-muted-foreground font-mono mb-2 border-b pb-2">@tonestyle.md</div>
                  <div className="space-y-2 opacity-50">
                    <div className="h-2 w-full bg-emerald-500/20 rounded-full" />
                    <div className="h-2 w-3/4 bg-emerald-500/20 rounded-full" />
                    <div className="h-2 w-5/6 bg-emerald-500/20 rounded-full" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* 4. User Privacy Section */}
        <section className="py-24 bg-foreground text-background relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <div className="bg-background/10 w-fit p-4 rounded-2xl mx-auto mb-8 backdrop-blur-md">
              <Shield className="h-12 w-12 text-background" />
            </div>
            <h2 className="text-3xl md:text-5xl font-serif tracking-tighter mb-6">Your Privacy is absolute</h2>
            <p className="text-lg text-background/80 mb-8 max-w-2xl mx-auto leading-relaxed">
              We deeply respect your privacy and platform security. We request only the bare minimum permissions necessary to publish your generated content.
            </p>
            <div className="bg-background/5 border border-background/10 rounded-2xl p-6 md:p-8 max-w-3xl mx-auto text-left flex gap-4 items-start backdrop-blur-sm">
              <div className="mt-1">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2 tracking-tight">Immediate Revocation</h3>
                <p className="text-background/70 leading-relaxed text-sm md:text-base">
                  The moment you disconnect your platform account from your profile, our access is revoked instantly and tokens are purged. No lingering access, no background tracking. You remain in complete control of your digital identity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Pricing Reference */}
        <section className="py-24 bg-background">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-serif tracking-tighter mb-4">Simple, transparent pricing</h2>
              <p className="text-muted-foreground text-lg">Choose a plan that fits your content creation needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto items-center">
              {/* Free */}
              <div className="rounded-3xl border border-border/40 bg-accent/20 p-8 flex flex-col hover:border-border transition-colors">
                <h3 className="text-muted-foreground font-medium mb-4 tracking-tight">Free</h3>
                <div className="mb-4">
                  <span className="text-4xl font-serif text-foreground">$0</span><span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8 min-h-[40px]">Perfect for exploring the platform.</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-primary" /> View User Interface</li>
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-muted-foreground/50" /> No Posts Publishing</li>
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-muted-foreground/50" /> No Thumbnail Generation</li>
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-muted-foreground/50" /> No Script Generation</li>
                </ul>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => !isAuthenticated ? signIn("google") : undefined} asChild={isAuthenticated}>
                  {isAuthenticated ? <Link href="/profile">Get Started</Link> : <span>Get Started</span>}
                </Button>
              </div>

              {/* Basic */}
              <div className="rounded-3xl border-2 border-primary bg-card p-8 flex flex-col shadow-2xl md:scale-105 z-10 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-md">
                  Most Popular
                </div>
                <h3 className="text-primary font-medium mb-4 tracking-tight">Basic Plan</h3>
                <div className="mb-4">
                  <span className="text-4xl font-serif text-foreground">$49</span><span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8 min-h-[40px]">Everything you need for active social media presence.</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="h-4 w-4 text-primary" /> Publish up to 1000 posts</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="h-4 w-4 text-primary" /> Generate up to 100 thumbnails</li>
                  <li className="flex items-center gap-3 text-sm font-medium"><Check className="h-4 w-4 text-muted-foreground/50" /> No Script Generation</li>
                </ul>
                <Button className="w-full rounded-xl shadow-md shadow-primary/20" onClick={() => !isAuthenticated ? signIn("google") : undefined} asChild={isAuthenticated}>
                  {isAuthenticated ? <Link href="/profile">Upgrade to Basic</Link> : <span>Subscribe</span>}
                </Button>
              </div>

              {/* Pro */}
              <div className="rounded-3xl border border-border/40 bg-accent/20 p-8 flex flex-col hover:border-border transition-colors">
                <h3 className="text-muted-foreground font-medium mb-4 tracking-tight">Pro Plan</h3>
                <div className="mb-4">
                  <span className="text-4xl font-serif text-foreground">$99</span><span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8 min-h-[40px]">Maximum limits for power users and agencies.</p>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-primary" /> Publish up to 2000 posts</li>
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-primary" /> Generate up to 200 thumbnails</li>
                  <li className="flex items-center gap-3 text-sm text-foreground/80"><Check className="h-4 w-4 text-primary" /> Generate up to 100 scripts</li>
                </ul>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => !isAuthenticated ? signIn("google") : undefined} asChild={isAuthenticated}>
                  {isAuthenticated ? <Link href="/profile">Upgrade to Pro</Link> : <span>Subscribe</span>}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 5. FAQ */}
        <section className="py-24 bg-accent/30 border-t border-border/40">
          <div className="max-w-3xl mx-auto px-4">
            <div className="mb-12 text-center">
              <h2 className="text-3xl md:text-5xl font-serif tracking-tighter mb-4">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border px-6 py-2 rounded-2xl bg-background shadow-sm hover:border-primary/20 transition-colors">
                <AccordionTrigger className="hover:no-underline font-medium text-left text-base">What exactly can I do with this platform?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pt-2">
                  You can generate context-aware content for different social platforms like X and LinkedIn, as well as create eye-catching thumbnails.
                  The AI allows you to create drafts tailored for each network's unique style, refine the text, append thumbnails, and ultimately publish directly to your connected accounts.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border px-6 py-2 rounded-2xl bg-background shadow-sm mt-4 hover:border-primary/20 transition-colors">
                <AccordionTrigger className="hover:no-underline font-medium text-left text-base">How does plan limit work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pt-2">
                  We offer monthly subscription plans. Your feature limits (like posts and thumbnails) reset at the beginning of each billing month.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border px-6 py-2 rounded-2xl bg-background shadow-sm mt-4 hover:border-primary/20 transition-colors">
                <AccordionTrigger className="hover:no-underline font-medium text-left text-base">Can I connect multiple platform accounts?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pt-2">
                  Yes! You can connect your X (Twitter) and LinkedIn accounts right from your profile settings. Once connected, you can build drafts for multiple targets natively and post across them at a single click.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="border px-6 py-2 rounded-2xl bg-background shadow-sm mt-4 hover:border-primary/20 transition-colors">
                <AccordionTrigger className="hover:no-underline font-medium text-left text-base">How does the Social Scripts feature work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pt-2">
                  Social Scripts are your custom guidelines. You can feed the AI examples of your previous writing, tone preferences, or specific formatting rules. When we generate your drafts, the AI reads your scripts to mirror your authentic voice perfectly.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* 7. Footer */}
        <footer className="py-12 border-t border-border/40 bg-background text-sm">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-serif tracking-tighter">Media Platform</span>
            </div>
            <div className="text-muted-foreground">
              &copy; {new Date().getFullYear()} Media Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Terms</Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Privacy</Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Contact</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
