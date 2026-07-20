import { AppIcon, type AppIconName } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { getDashboardData, type ReportRow } from "@/lib/dashboard/queries";
import { decimal, formatMoney } from "@/lib/finance/money";

function ReportSection({
  title,
  subtitle,
  icon,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  icon: AppIconName;
  rows: ReportRow[];
  tone: string;
}) {
  const max = rows.reduce((current, row) => {
    const amount = decimal(row.amount).abs();
    return amount.greaterThan(current) ? amount : current;
  }, decimal("0"));
  return (
    <section className="report-section surface-card" data-tone={tone}>
      <header>
        <span>
          <AppIcon name={icon} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {rows.length ? (
        <ul>
          {rows.map((row) => {
            const percentage = max.isZero()
              ? "0%"
              : `${decimal(row.amount).abs().div(max).times(100).toFixed(2)}%`;
            return (
              <li key={`${title}-${row.label}-${row.detail}`}>
                <div className="report-row-top">
                  <span>{row.label}</span>
                  <strong className="tabular-nums">
                    {formatMoney(row.amount)}
                  </strong>
                </div>
                <div className="report-bar" aria-hidden="true">
                  <span style={{ width: percentage }} />
                </div>
                {row.detail && <p>{row.detail}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="report-empty">
          <AppIcon name="reports" />
          <p>Aucune donnée sur ce filtre.</p>
        </div>
      )}
    </section>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData({
    from: params.from,
    to: params.to,
    activityId: params.activity_id,
  });
  const metrics: Array<{
    label: string;
    value: string;
    icon: AppIconName;
    tone: string;
  }> = [
    {
      label: "Chiffre d’affaires",
      value: data.kpis.revenue,
      icon: "trend",
      tone: "blue",
    },
    {
      label: "Bénéfice brut",
      value: data.kpis.gross_profit,
      icon: "profit",
      tone: "mint",
    },
    {
      label: "Bénéfice net",
      value: data.kpis.net_profit,
      icon: "wallet",
      tone: "navy",
    },
    {
      label: "Dépenses familiales",
      value: data.kpis.family_expenses,
      icon: "family",
      tone: "amber",
    },
    {
      label: "Épargne",
      value: data.kpis.savings,
      icon: "savings",
      tone: "violet",
    },
    {
      label: "Trésorerie hors épargne",
      value: data.kpis.cash,
      icon: "wallet",
      tone: "cyan",
    },
  ];
  const csvParams = new URLSearchParams();
  if (params.from) csvParams.set("from", params.from);
  if (params.to) csvParams.set("to", params.to);
  if (params.activity_id) csvParams.set("activity_id", params.activity_id);
  return (
    <main className="app-page reports-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Intelligence financière"
          title="Rapports"
          description="Comprenez ce qui rapporte, ce qui coûte et où se trouve l’argent — sans jargon comptable."
          icon="reports"
          actions={
            <a
              href={`/api/reports/export?${csvParams.toString()}`}
              className="premium-button report-export-top"
            >
              <AppIcon name="download" className="h-4 w-4" />
              Exporter CSV côté serveur
            </a>
          }
        />

        <section className="report-spotlight animate-enter">
          <div>
            <p>Résultat net de la période</p>
            <h2>{formatMoney(data.kpis.net_profit)}</h2>
            <span>
              <AppIcon name="shield" className="h-4 w-4" /> Données validées
              uniquement
            </span>
          </div>
          <div className="report-spotlight-stats">
            <div>
              <small>Ventes</small>
              <strong>{formatMoney(data.kpis.revenue)}</strong>
            </div>
            <div>
              <small>Trésorerie</small>
              <strong>{formatMoney(data.kpis.cash)}</strong>
            </div>
          </div>
          <div className="report-spotlight-visual" aria-hidden="true">
            {[42, 61, 48, 76, 66, 88, 74, 96].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </section>

        <details
          className="report-filter surface-card"
          open={Boolean(params.from || params.to || params.activity_id)}
        >
          <summary>
            <span>
              <AppIcon name="calendar" />
            </span>
            <div>
              <strong>Affiner la période</strong>
              <small>Dates et activité</small>
            </div>
            <AppIcon name="arrow" className="report-filter-arrow" />
          </summary>
          <form>
            <label className="field-label">
              Début
              <input
                name="from"
                type="date"
                defaultValue={params.from}
                className="premium-field"
              />
            </label>
            <label className="field-label">
              Fin
              <input
                name="to"
                type="date"
                defaultValue={params.to}
                className="premium-field"
              />
            </label>
            <label className="field-label">
              Activité
              <select
                name="activity_id"
                defaultValue={params.activity_id ?? ""}
                className="premium-field"
              >
                <option value="">Toutes</option>
                {data.activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="premium-button">Filtrer</button>
          </form>
        </details>

        <section className="report-metrics" aria-label="Synthèse financière">
          {metrics.map((metric) => (
            <article key={metric.label} data-tone={metric.tone}>
              <span>
                <AppIcon name={metric.icon} />
              </span>
              <div>
                <small>{metric.label}</small>
                <strong className="tabular">{formatMoney(metric.value)}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="reports-grid">
          <ReportSection
            title="Marge par activité"
            subtitle="Les activités qui créent le plus de valeur."
            icon="trend"
            tone="blue"
            rows={data.reports.activityMargins}
          />
          <ReportSection
            title="Dépenses par catégorie"
            subtitle="Comprendre où part chaque montant."
            icon="expense"
            tone="coral"
            rows={data.reports.expensesByCategory}
          />
          <ReportSection
            title="Soldes des comptes"
            subtitle="Caisse, mobile money, banque et épargne."
            icon="wallet"
            tone="navy"
            rows={data.reports.accountBalances}
          />
          <ReportSection
            title="Stock et valorisation"
            subtitle="Quantités et valeur des produits physiques."
            icon="box"
            tone="amber"
            rows={data.reports.stock}
          />
          <ReportSection
            title="Créances clients"
            subtitle="Les ventes qui restent à encaisser."
            icon="calendar"
            tone="violet"
            rows={data.reports.receivables}
          />
          <ReportSection
            title="Progression d’épargne"
            subtitle="Distance restante avant chaque objectif."
            icon="target"
            tone="mint"
            rows={data.reports.savingsProgress}
          />
        </section>

        <a
          href={`/api/reports/export?${csvParams.toString()}`}
          className="premium-button report-export-bottom"
        >
          <AppIcon name="download" />
          Exporter CSV côté serveur
        </a>
      </div>
      <AppNavigation />
    </main>
  );
}
