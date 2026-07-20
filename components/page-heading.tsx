import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "./app-icon";

export function PageHeading({
  eyebrow,
  title,
  description,
  icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: AppIconName;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        <span className="page-heading-icon">
          <AppIcon name={icon} className="h-6 w-6" />
        </span>
        <div>
          <p className="page-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
