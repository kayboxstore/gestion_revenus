import "./globals.css";
import "./olive-future.css";
import "./dashboard-editorial.css";
import "./stock.css";
import type { Metadata, Viewport } from "next";
import { PwaRegister } from "./pwa-register";
export const metadata: Metadata = {
  title: {
    default: "KayBox Family",
    template: "%s · KayBox Family",
  },
  description:
    "Pilotage familial fiable des revenus, dépenses, stock et épargne",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c1209",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-CD" data-scroll-behavior="smooth">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
