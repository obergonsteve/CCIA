import { ConvexClientProvider } from "@/components/convex-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CCIA Land Lease Training",
    template: "%s | CCIA Land Lease Training",
  },
  description:
    "Training portal for residential land lease community operators — CCIA Land Lease Division (Australia).",
  appleWebApp: {
    capable: true,
    title: "CCIA Training",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#115e59" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-svh`}
      >
        <ThemeProvider>
          <ConvexClientProvider>
            {children}
            <Toaster richColors position="top-center" />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
