import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CCIA Land Lease Training",
    short_name: "CCIA Training",
    description:
      "Training portal for residential land lease community operators (Australia).",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#9bc353",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
