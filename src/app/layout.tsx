import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { ModeToggle } from "@/components/theme/ThemeToggle";
import Navbar from "@/components/misc/Navbar";
import { Toaster } from 'sonner'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Media Creator Platform - AI-Powered Content Generation",
    template: "%s | Media Creator Platform",
  },
  description: "Transform your ideas into platform-specific content for X, LinkedIn, and Blog. AI-powered content generation with developer-focused context awareness, thumbnail creation, and multi-platform formatting.",
  keywords: [
    "content creation",
    "AI content generator",
    "social media automation",
    "X threads",
    "LinkedIn articles",
    "YouTube descriptions",
    "thumbnail generator",
    "developer content",
    "technical writing",
    "content marketing",
    "social media tools",
  ],
  authors: [{ name: "Media Creator Platform" }],
  creator: "Media Creator Platform",
  publisher: "Media Creator Platform",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Media Creator Platform",
    title: "Media Creator Platform - AI-Powered Content Generation",
    description: "Transform your ideas into platform-specific content for X, LinkedIn, and Blog with AI-powered tools.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Media Creator Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Media Creator Platform - AI-Powered Content Generation",
    description: "Transform your ideas into platform-specific content for X, LinkedIn, and Blog with AI-powered tools.",
    images: ["/twitter-image.png"],
    creator: "@mediacreator",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://media.plann.site/"),
  alternates: {
    canonical: "/",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="noscrollbar">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <Providers>
      <Toaster position="bottom-right" />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
