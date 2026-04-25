import type { MetadataRoute } from "next";
import {
  SITE_APP_NAME,
  SITE_META_DESCRIPTION,
  SITE_PWA_SHORT_NAME,
} from "@/lib/site-brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_APP_NAME,
    short_name: SITE_PWA_SHORT_NAME,
    description: SITE_META_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#8ca35b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
