import { AppConvexProviders } from "@/components/app-convex-providers";
import { ThemeProvider } from "@/components/theme-provider";
import { getEffectiveAuthModeForEdge } from "@/lib/auth-mode";
import { cookies } from "next/headers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const authMode = getEffectiveAuthModeForEdge({
    getCookie: (name) => cookieStore.get(name)?.value,
  });

  const appTree = (
    <ThemeProvider>
      <AppConvexProviders authMode={authMode}>{children}</AppConvexProviders>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );

  return (
    <html
      lang="en-AU"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
         First-paint: static `public/favicon.ico` (no `app/icon` or `app/favicon` so Next
         does not stream extra icon resources after a placeholder).
        */}
        <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="32x32" />
        <link
          rel="icon"
          href="/icons/app-icon-192.png"
          type="image/png"
          sizes="192x192"
        />
        <link
          rel="icon"
          href="/icons/app-icon-512.png"
          type="image/png"
          sizes="512x512"
        />
        <link
          rel="apple-touch-icon"
          href="/icons/app-icon-192.png"
        />
      </head>
      <body className="font-sans antialiased min-h-svh">
        {authMode === "convex" ? (
          <ConvexAuthNextjsServerProvider>{appTree}</ConvexAuthNextjsServerProvider>
        ) : (
          appTree
        )}
      </body>
    </html>
  );
}
