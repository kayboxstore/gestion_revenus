import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { AppIcon, BrandMark, type AppIconName } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/finance/money";
import { translateStatus } from "@/lib/i18n/status";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const periods = [
  ["today", "Aujourd’hui"],
  ["week", "Semaine"],
  ["month", "Mois"],
  ["quarter", "Trimestre"],
  ["year", "Année"],
  ["all", "Tout"],
] as const;

const operationLabels: Record<string, string> = {
  cash_sale: "Vente encaissée",
  credit_sale: "Vente à crédit",
  payment: "Encaissement",
  opening_stock: "Stock initial",
  stock_purchase: "Achat de stock",
  operating_expense: "Dépense d’activité",
  family_expense: "Dépense familiale",
  transfer: "Transfert",
  family_contribution: "Apport familial",
  family_withdrawal: "Retrait familial",
  savings_contribution: "Épargne",
  reversal: "Annulation",
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(period: string, customFrom?: string, customTo?: string) {
  if (period === "all") return { from: null, to: null };
  if (period === "custom") {
    return {
      from: customFrom && datePattern.test(customFrom) ? customFrom : null,
      to: customTo && datePattern.test(customTo) ? customTo : null,
    };
  }
  const kinshasaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const to = new Date(`${kinshasaToday}T00:00:00Z`);
  const from = new Date(to);
  if (period === "today") return { from: isoDate(from), to: isoDate(to) };
  if (period === "week")
    from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  else if (period === "quarter")
    from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3, 1);
  else if (period === "year") from.setUTCMonth(0, 1);
  else from.setUTCDate(1);
  return { from: isoDate(from), to: isoDate(to) };
}

function activityIcon(code: string): AppIconName {
  if (code === "IPTV") return "signal";
  if (code === "ANDROID_TV_BOX") return "tv";
  if (code === "BILLIARD") return "billiard";
  return "box";
}

function operationIcon(type: string): AppIconName {
  if (type.includes("sale")) return "sale";
  if (type.includes("expense") || type.includes("withdrawal")) return "expense";
  if (type.includes("stock")) return "box";
  if (type.includes("saving")) return "savings";
  if (type === "transfer") return "transfer";
  return "income";
}

function isZeroQuantity(quantity?: string) {
  return !quantity || /^0(?:\.0+)?$/.test(quantity);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = [
    "today",
    "week",
    "month",
    "quarter",
    "year",
    "custom",
    "all",
  ].includes(params.period ?? "")
    ? (params.period as string)
    : "month";
  const range = periodRange(period, params.from, params.to);
  const activityId =
    params.activity && uuidPattern.test(params.activity)
      ? params.activity
      : null;
  const data = await getDashboardData({ ...range, activityId });
  const cards: Array<{
    label: string;
    value: string;
    icon: AppIconName;
    tone: string;
    detail: string;
  }> = [
    {
      label: "Chiffre d’affaires",
      value: data.kpis.revenue,
      icon: "trend",
      tone: "blue",
      detail: "Ventes validées",
    },
    {
      label: "Bénéfice brut",
      value: data.kpis.gross_profit,
      icon: "profit",
      tone: "mint",
      detail: "Après coût des ventes",
    },
    {
      label: "Bénéfice net",
      value: data.kpis.net_profit,
      icon: "wallet",
      tone: "navy",
      detail: "Résultat d’activité",
    },
    {
      label: "Dépenses familiales",
      value: data.kpis.family_expenses,
      icon: "expense",
      tone: "amber",
      detail: "Séparées du résultat",
    },
    {
      label: "Épargne",
      value: data.kpis.savings,
      icon: "savings",
      tone: "violet",
      detail: "Contributions nettes",
    },
  ];
  const activeActivities = data.activities.filter(
    (activity) => activity.active,
  );
  const outOfStockProducts = data.products.filter(
    (product) =>
      product.type === "physical" && isZeroQuantity(product.stock_quantity),
  );
  const quickActions: Array<{
    label: string;
    detail: string;
    href: string;
    icon: AppIconName;
    tone: string;
  }> = [
    {
      label: "Vente",
      detail: "Encaisser maintenant",
      href: "/operations?type=cash_sale",
      icon: "sale",
      tone: "blue",
    },
    {
      label: "Dépense",
      detail: "Activité ou famille",
      href: "/operations?type=operating_expense",
      icon: "expense",
      tone: "coral",
    },
    {
      label: "Stock",
      detail: "Acheter ou initialiser",
      href: "/operations?type=stock_purchase",
      icon: "box",
      tone: "amber",
    },
    {
      label: "Transfert",
      detail: "Entre deux comptes",
      href: "/operations?type=transfer",
      icon: "transfer",
      tone: "cyan",
    },
    {
      label: "Épargner",
      detail: "Faire progresser un objectif",
      href: "/operations?type=savings_contribution",
      icon: "savings",
      tone: "violet",
    },
    {
      label: "À crédit",
      detail: "Créer une créance",
      href: "/operations?type=credit_sale",
      icon: "calendar",
      tone: "navy",
    },
  ];

  function periodHref(value: string) {
    const query = new URLSearchParams({ period: value });
    if (activityId) query.set("activity", activityId);
    return `/?${query.toString()}`;
  }

  return (
    <main className="app-page dashboard-page">
      <div className="app-page-inner">
        <section className="dashboard-hero animate-enter">
          <div className="dashboard-hero-top">
            <div className="dashboard-brand">
              <BrandMark className="h-11 w-11" />
              <div>
                <p>KayBox Family</p>
                <strong>{data.householdName ?? "Gestion des revenus"}</strong>
              </div>
            </div>
            {data.authenticated ? (
              <form action={signOut}>
                <button className="hero-icon-button" aria-label="Déconnexion">
                  <AppIcon name="logout" />
                </button>
              </form>
            ) : (
              <Link className="hero-login-button" href="/login">
                Connexion
              </Link>
            )}
          </div>

          <div className="dashboard-balance">
            <p>Trésorerie disponible</p>
            <h1>{formatMoney(data.kpis.cash)}</h1>
            <span>
              <AppIcon name="shield" className="h-4 w-4" />
              Calculée depuis les écritures validées
            </span>
          </div>

          <div className="dashboard-hero-footer">
            <div>
              <small>Résultat net</small>
              <strong>{formatMoney(data.kpis.net_profit)}</strong>
            </div>
            <div>
              <small>Activités actives</small>
              <strong>{activeActivities.length}</strong>
            </div>
            <div>
              <small>Créances ouvertes</small>
              <strong>{data.openSales.length}</strong>
            </div>
          </div>
          <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        </section>

        {!data.configured && (
          <section className="status-banner status-banner-info mt-4">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            Configurez Supabase avec `.env.local` pour activer les données
            réelles.
          </section>
        )}
        {data.configured && data.authenticated && !data.householdName && (
          <section className="mt-4">
            <Link href="/onboarding" className="onboarding-callout">
              <span className="quick-action-icon" data-tone="blue">
                <AppIcon name="family" />
              </span>
              <span>
                <strong>Créer le premier foyer</strong>
                <small>Deux minutes pour tout initialiser</small>
              </span>
              <AppIcon name="arrow" />
            </Link>
          </section>
        )}

        {data.authenticated && data.householdName && (
          <>
            <section className="dashboard-toolbar animate-enter">
              <nav
                className="period-switcher"
                aria-label="Période du tableau de bord"
              >
                {periods.map(([value, label]) => (
                  <Link
                    key={value}
                    href={periodHref(value)}
                    data-active={period === value || undefined}
                    aria-current={period === value ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <details className="dashboard-filter-panel">
                <summary>
                  <AppIcon name="calendar" className="h-4 w-4" />
                  Filtres
                </summary>
                <form method="get">
                  <input type="hidden" name="period" value="custom" />
                  <label className="field-label">
                    Activité
                    <select
                      name="activity"
                      defaultValue={activityId ?? ""}
                      className="premium-field"
                    >
                      <option value="">Toutes les activités</option>
                      {data.activities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="field-label">
                      Du
                      <input
                        name="from"
                        type="date"
                        defaultValue={params.from ?? ""}
                        className="premium-field"
                      />
                    </label>
                    <label className="field-label">
                      Au
                      <input
                        name="to"
                        type="date"
                        defaultValue={params.to ?? ""}
                        className="premium-field"
                      />
                    </label>
                  </div>
                  <button className="premium-button w-full">
                    Appliquer le filtre
                  </button>
                </form>
              </details>
            </section>

            <section
              className="kpi-grid animate-enter"
              aria-label="Indicateurs financiers"
            >
              {cards.map((card) => (
                <article
                  key={card.label}
                  className="kpi-card"
                  data-tone={card.tone}
                >
                  <span className="kpi-icon">
                    <AppIcon name={card.icon} />
                  </span>
                  <p>{card.label}</p>
                  <strong className="tabular">{formatMoney(card.value)}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </section>

            <section className="dashboard-section surface-card animate-enter">
              <div className="section-title">
                <div>
                  <h2>Ajouter en un geste</h2>
                  <p>
                    Choisissez l’intention, l’application adapte le formulaire.
                  </p>
                </div>
                <Link className="section-link" href="/operations">
                  Tout voir <AppIcon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
              <div className="quick-action-grid">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="quick-action-card"
                  >
                    <span className="quick-action-icon" data-tone={action.tone}>
                      <AppIcon name={action.icon} />
                    </span>
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.detail}</small>
                    </span>
                    <AppIcon name="arrow" className="quick-action-arrow" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="dashboard-content-grid">
              <div className="space-y-4">
                <section className="dashboard-section surface-card animate-enter">
                  <div className="section-title">
                    <div>
                      <h2>À surveiller</h2>
                      <p>Les éléments qui méritent votre attention.</p>
                    </div>
                    <span className="attention-count">
                      {outOfStockProducts.length + data.openSales.length}
                    </span>
                  </div>
                  {outOfStockProducts.length === 0 &&
                  data.openSales.length === 0 ? (
                    <div className="all-clear-state">
                      <span>
                        <AppIcon name="check" />
                      </span>
                      <div>
                        <strong>Tout est sous contrôle</strong>
                        <p>Aucune alerte critique pour le moment.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="attention-list">
                      {outOfStockProducts.slice(0, 3).map((product) => (
                        <Link
                          key={product.id}
                          href="/operations?type=opening_stock"
                          className="attention-item"
                        >
                          <span data-level="warning">
                            <AppIcon name="box" />
                          </span>
                          <div>
                            <strong>{product.name}</strong>
                            <small>
                              Stock à zéro · approvisionner maintenant
                            </small>
                          </div>
                          <AppIcon name="arrow" />
                        </Link>
                      ))}
                      {data.openSales.length > 0 && (
                        <Link href="/reports" className="attention-item">
                          <span data-level="info">
                            <AppIcon name="calendar" />
                          </span>
                          <div>
                            <strong>
                              {data.openSales.length} créance
                              {data.openSales.length > 1 ? "s" : ""} ouverte
                              {data.openSales.length > 1 ? "s" : ""}
                            </strong>
                            <small>Suivre les paiements clients</small>
                          </div>
                          <AppIcon name="arrow" />
                        </Link>
                      )}
                    </div>
                  )}
                </section>

                <section className="dashboard-section surface-card animate-enter">
                  <div className="section-title">
                    <div>
                      <h2>Vos activités</h2>
                      <p>Une vue rapide sur les moteurs du foyer.</p>
                    </div>
                    <Link className="section-link" href="/activities">
                      Gérer <AppIcon name="arrow" className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="activity-strip">
                    {data.activities.map((activity) => (
                      <article
                        key={activity.code}
                        className="activity-mini-card"
                        data-code={activity.code}
                      >
                        <span>
                          <AppIcon name={activityIcon(activity.code)} />
                        </span>
                        <div>
                          <strong>{activity.name}</strong>
                          <small data-active={activity.active || undefined}>
                            {activity.active ? "Active" : "En attente"}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <section className="dashboard-section surface-card recent-section animate-enter">
                <div className="section-title">
                  <div>
                    <h2>Activité récente</h2>
                    <p>Les dernières écritures validées.</p>
                  </div>
                  <Link className="section-link" href="/operations">
                    Historique <AppIcon name="arrow" className="h-4 w-4" />
                  </Link>
                </div>
                {data.operations.length === 0 ? (
                  <div className="empty-state">
                    <span>
                      <AppIcon name="operations" />
                    </span>
                    <strong>Votre journal est prêt</strong>
                    <p>La première opération apparaîtra ici instantanément.</p>
                    <Link className="premium-button" href="/operations">
                      Ajouter une opération
                    </Link>
                  </div>
                ) : (
                  <ul className="recent-list">
                    {data.operations.map((operation) => (
                      <li key={operation.number}>
                        <span className="recent-icon">
                          <AppIcon name={operationIcon(operation.type)} />
                        </span>
                        <div>
                          <strong>
                            {operationLabels[operation.type] ?? operation.type}
                          </strong>
                          <small>{operation.number}</small>
                        </div>
                        <span
                          className="recent-status"
                          data-status={operation.status}
                        >
                          {translateStatus(operation.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          </>
        )}
      </div>
      <AppNavigation />
    </main>
  );
}
