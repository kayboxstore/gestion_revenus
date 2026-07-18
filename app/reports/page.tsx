import Link from "next/link";
import { getDashboardData, type ReportRow } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/finance/money";

function ReportSection({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="mt-3 divide-y text-sm">
          {rows.map((row) => (
            <li key={`${title}-${row.label}-${row.detail}`} className="py-3">
              <div className="flex justify-between gap-3">
                <span>{row.label}</span>
                <strong className="tabular-nums">
                  {formatMoney(row.amount)}
                </strong>
              </div>
              {row.detail && <p className="text-slate-500">{row.detail}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-600">Aucune donnée sur ce filtre.</p>
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
  const rows = [
    ["Chiffre d’affaires", data.kpis.revenue],
    ["Bénéfice brut", data.kpis.gross_profit],
    ["Bénéfice net", data.kpis.net_profit],
    ["Dépenses familiales", data.kpis.family_expenses],
    ["Épargne", data.kpis.savings],
    ["Trésorerie hors épargne", data.kpis.cash],
  ];
  const csvParams = new URLSearchParams();
  if (params.from) csvParams.set("from", params.from);
  if (params.to) csvParams.set("to", params.to);
  if (params.activity_id) csvParams.set("activity_id", params.activity_id);
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Rapports</h1>
      <p className="mt-2 text-slate-600">
        Synthèse calculée côté base sur les écritures validées, avec filtres de
        période et d’activité. Les transferts et l’épargne ne deviennent jamais
        des revenus ou dépenses.
      </p>
      <form className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block text-sm font-medium">
          Début
          <input
            name="from"
            type="date"
            defaultValue={params.from}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Fin
          <input
            name="to"
            type="date"
            defaultValue={params.to}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="block text-sm font-medium">
          Activité
          <select
            name="activity_id"
            defaultValue={params.activity_id ?? ""}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">Toutes</option>
            {data.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white self-end">
          Filtrer
        </button>
      </form>
      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b p-4 last:border-b-0"
          >
            <span>{label}</span>
            <strong>{formatMoney(value)}</strong>
          </div>
        ))}
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ReportSection
          title="Marge par activité"
          rows={data.reports.activityMargins}
        />
        <ReportSection
          title="Dépenses par catégorie"
          rows={data.reports.expensesByCategory}
        />
        <ReportSection
          title="Soldes des comptes"
          rows={data.reports.accountBalances}
        />
        <ReportSection
          title="Stock et valorisation"
          rows={data.reports.stock}
        />
        <ReportSection
          title="Créances clients"
          rows={data.reports.receivables}
        />
        <ReportSection
          title="Progression d’épargne"
          rows={data.reports.savingsProgress}
        />
      </div>
      <a
        href={`/api/reports/export?${csvParams.toString()}`}
        className="mt-4 inline-block rounded-xl bg-night px-4 py-3 font-semibold text-white"
      >
        Exporter CSV côté serveur
      </a>
    </main>
  );
}
