"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon, BrandMark, type AppIconName } from "./app-icon";

const items: Array<{ href: string; label: string; icon: AppIconName }> = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/operations", label: "Opérations", icon: "operations" },
  { href: "/stock", label: "Stock", icon: "box" },
  { href: "/reports", label: "Rapports", icon: "reports" },
  { href: "/more", label: "Plus", icon: "more" },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="app-navigation" aria-label="Navigation principale">
        <Link
          href="/"
          className="app-navigation-brand"
          aria-label="Gestion des revenus — Accueil"
        >
          <BrandMark className="h-11 w-11" />
          <span>
            <strong>KayBox</strong>
            <small>Finance familiale</small>
          </span>
        </Link>
        <div className="app-navigation-items">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="app-navigation-link"
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="app-navigation-icon">
                  <AppIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {pathname !== "/operations" && pathname !== "/stock" && (
        <Link
          className="app-floating-action"
          href="/operations"
          aria-label="Ajouter une opération"
        >
          <AppIcon name="plus" className="h-6 w-6" />
          <span>Ajouter</span>
        </Link>
      )}
    </>
  );
}
