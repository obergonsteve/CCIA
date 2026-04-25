import { ConvexClientProvider } from "@/components/convex-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import {
  SITE_APP_NAME,
  SITE_META_DESCRIPTION,
  SITE_PWA_SHORT_NAME,
} from "@/lib/site-brand";
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
    default: SITE_APP_NAME,
    template: `%s | ${SITE_APP_NAME}`,
  },
  description: SITE_META_DESCRIPTION,
  /** Redundant with `app/icon.png` + `app/favicon.ico` file conventions; explicit for hosts/browsers that ignore one path. */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/app-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/app-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/app-icon-192.png", type: "image/png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    title: SITE_PWA_SHORT_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8ca35b" },
    { media: "(prefers-color-scheme: dark)", color: "#222222" },
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
