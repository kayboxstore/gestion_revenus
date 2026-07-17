import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestion des revenus",
    short_name: "Revenus",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fafc",
    theme_color: "#0f2742",
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
