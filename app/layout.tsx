import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PwaRegister } from "./pwa-register";
export const metadata: Metadata = {
  title: "Gestion des revenus",
  description:
    "Pilotage familial fiable des revenus, dépenses, stock et épargne",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2742",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-CD">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
