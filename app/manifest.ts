import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KayBox Family — Gestion des revenus",
    short_name: "KayBox Family",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6fb",
    theme_color: "#0b1f38",
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
