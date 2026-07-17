import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/finance/money";

export default async function Page() {
  const data = await getDashboardData();
  const rows = [
    ["Chiffre d’affaires", data.kpis.revenue],
    ["Bénéfice brut", data.kpis.gross_profit],
    ["Bénéfice net", data.kpis.net_profit],
    ["Dépenses familiales", data.kpis.family_expenses],
    ["Épargne", data.kpis.savings],
    ["Trésorerie hors épargne", data.kpis.cash],
  ];
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Rapports</h1>
      <p className="mt-2 text-slate-600">
        Synthèse calculée côté base sur les écritures validées, avec définitions
        séparant revenu, stock, dépenses familiales, transferts et épargne.
      </p>
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
      <a
        href={`data:text/csv;charset=utf-8,Indicateur,Montant%0A${rows.map(([l, v]) => `${l},${v}`).join("%0A")}`}
        download="synthese.csv"
        className="mt-4 inline-block rounded-xl bg-night px-4 py-3 font-semibold text-white"
      >
        Exporter CSV
      </a>
    </main>
  );
}
