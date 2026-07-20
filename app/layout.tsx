import "./globals.css";
import "./olive-future.css";
import "./dashboard-editorial.css";
import "./stock.css";
import "./kayembe-signature.css";
import type { Metadata, Viewport } from "next";
import { APP_BRAND } from "@/lib/brand";
import { PwaRegister } from "./pwa-register";
export const metadata: Metadata = {
  title: {
    default: APP_BRAND.name,
    template: `%s · ${APP_BRAND.name}`,
  },
  description:
    "Pilotage familial fiable des revenus, dépenses, stock et épargne",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3e8",
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
