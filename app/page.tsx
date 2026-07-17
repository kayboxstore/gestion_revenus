import Link from "next/link";
import {
  defaultActivities,
  familyExpense,
  saleCash,
  savingsContribution,
  summarize,
  transfer,
} from "@/lib/finance/domain";
import { formatMoney } from "@/lib/finance/money";
const entries = [
  saleCash("120", "40", "USD", "1"),
  saleCash("150000", "60000", "CDF", "0.00035"),
  familyExpense("18"),
  transfer("25"),
  savingsContribution("15"),
];
const totals = summarize(entries);
const cards = [
  ["Chiffre d’affaires", totals.revenue],
  ["Bénéfice brut", totals.grossProfit],
  ["Bénéfice net", totals.netProfit],
  ["Dépenses familiales", totals.familyExpenses],
  ["Épargne", totals.savings],
  ["Trésorerie", totals.cash],
];
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <section className="bg-night px-5 py-6 text-white">
        <p className="text-sm opacity-80">
          Foyer Kay · Africa/Kinshasa · USD/CDF
        </p>
        <h1 className="mt-2 text-3xl font-bold">Tableau de bord</h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          Application réelle de démonstration locale: les calculs financiers
          sont dérivés du grand livre équilibré, sans confondre revenus,
          transferts, dépenses familiales et épargne.
        </p>
      </section>
      <section className="grid gap-3 px-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <article
            key={label}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-600">{label}</p>
            <strong className="tabular mt-2 block text-2xl">
              {formatMoney(value)}
            </strong>
          </article>
        ))}
      </section>
      <section className="px-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Ajouter rapidement</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              "Vente",
              "Dépense",
              "Transfert",
              "Apport",
              "Épargne",
              "Achat stock",
            ].map((x) => (
              <button
                className="focus-ring rounded-xl border border-slate-300 px-3 py-3 text-left font-medium hover:bg-slate-50"
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-4 px-4 py-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Activités</h2>
          <ul className="mt-3 space-y-2">
            {defaultActivities.map((a) => (
              <li
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                key={a.code}
              >
                <span>{a.name}</span>
                <span
                  className={a.active ? "text-green-700" : "text-amber-700"}
                >
                  {a.active ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Dernières opérations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {entries.map((e, index) => (
              <li
                className="rounded-xl bg-slate-50 p-3"
                key={`${e.id}-${index}`}
              >
                <span className="font-medium">{e.type}</span>
                <span className="ml-2 text-green-700">{e.status}</span>
                <span className="block text-slate-600">
                  {e.lines.length} lignes équilibrées
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white text-center text-xs shadow-lg"
      >
        <Link className="p-3 font-semibold text-electric" href="/">
          Accueil
        </Link>
        <Link className="p-3" href="/operations">
          Opérations
        </Link>
        <Link className="p-3" href="/activities">
          Activités
        </Link>
        <Link className="p-3" href="/reports">
          Rapports
        </Link>
        <Link className="p-3" href="/more">
          Plus
        </Link>
      </nav>
    </main>
  );
}
