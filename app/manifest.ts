import type { MetadataRoute } from "next";
import { APP_BRAND } from "@/lib/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_BRAND.name} — Gestion des revenus`,
    short_name: APP_BRAND.shortName,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#f4f1e9",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
