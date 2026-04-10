import { ConvexClientProvider } from "@/components/convex-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-app-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CCIA Land Lease Training",
    template: "%s | CCIA Land Lease Training",
  },
  description:
    "Training for residential land lease community operators — CCIA Land Lease Division (Australia).",
  appleWebApp: {
    capable: true,
    title: "CCIA Training",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#9bc353" },
    { media: "(prefers-color-scheme: dark)", color: "#2c2c2c" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-AU"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-svh">
        <ThemeProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
