import type { SVGProps } from "react";

export type AppIconName =
  | "home"
  | "operations"
  | "activities"
  | "reports"
  | "more"
  | "plus"
  | "wallet"
  | "trend"
  | "profit"
  | "expense"
  | "savings"
  | "sale"
  | "income"
  | "purchase"
  | "transfer"
  | "family"
  | "box"
  | "tv"
  | "signal"
  | "billiard"
  | "alert"
  | "calendar"
  | "download"
  | "check"
  | "arrow"
  | "user"
  | "logout"
  | "shield"
  | "members"
  | "settings"
  | "target";

const paths: Record<AppIconName, React.ReactNode> = {
  home: (
    <path d="M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
  ),
  operations: (
    <>
      <path d="M4 7h16M4 17h16" />
      <path d="m8 3-4 4 4 4M16 13l4 4-4 4" />
    </>
  ),
  activities: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="m3 7 6-4 6 5 6-5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  wallet: (
    <>
      <path d="M3 7a3 3 0 0 1 3-3h12a2 2 0 0 1 2 2v15H6a3 3 0 0 1-3-3Z" />
      <path d="M3 8h17M15 13h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  profit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14.5c.8 1.3 2 2 4 2 2.2 0 3.5-1 3.5-2.6 0-4-7-1.8-7-5.2 0-1.5 1.3-2.7 3.5-2.7 1.7 0 2.9.6 3.6 1.7M12 4v16" />
    </>
  ),
  expense: (
    <>
      <path d="M12 3v14" />
      <path d="m7 12 5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  savings: (
    <>
      <path d="M5 10a7 7 0 0 1 13.5-2.5c1.6.3 2.5 1.2 2.5 2.5v6l-3 1-1 3h-3l-.7-2H9l-.7 2h-3l-1.1-3A6.8 6.8 0 0 1 3 13c0-1.2.7-2 2-2Z" />
      <path d="M9 8h5M16 10h.01" />
    </>
  ),
  sale: (
    <>
      <path d="M4 5h16l-2 8H7Z" />
      <path d="M7 13 5 3H2M8 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </>
  ),
  income: (
    <>
      <path d="M12 21V7" />
      <path d="m7 12 5-5 5 5M4 3h16" />
    </>
  ),
  purchase: (
    <>
      <path d="M6 8h12l1 13H5Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  transfer: (
    <>
      <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />
    </>
  ),
  family: (
    <>
      <path d="M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 4.5a4 4 0 0 1 0 7M17 14a5 5 0 0 1 4 4.9V21" />
    </>
  ),
  box: (
    <>
      <path d="m4 7 8-4 8 4-8 4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="m8 22 4-4 4 4M8 10h8" />
    </>
  ),
  signal: (
    <>
      <path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 18a2 2 0 0 1 2 0" />
      <circle cx="12" cy="21" r=".5" />
    </>
  ),
  billiard: (
    <>
      <circle cx="9" cy="9" r="5" />
      <circle cx="16" cy="16" r="5" />
      <path d="m4 20 16-16" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13M7 11l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M16 4.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
};

export function AppIcon({
  name,
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: AppIconName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path
          d="M10 28V18l10-7 10 7v10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 27.5h12M16 22l3 2 5-6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
