import Link from "next/link";
import { createQuickOperation } from "@/app/actions/operations";
import { getDashboardData } from "@/lib/dashboard/queries";

const types = [
  ["cash_sale", "Vente encaissée"],
  ["credit_sale", "Vente à crédit"],
  ["payment", "Encaissement créance"],
  ["stock_purchase", "Achat de stock"],
  ["operating_expense", "Dépense activité"],
  ["family_expense", "Dépense familiale"],
  ["transfer", "Transfert caisse → M-Pesa"],
  ["family_contribution", "Apport familial"],
  ["family_withdrawal", "Retrait familial"],
  ["savings_contribution", "Contribution épargne"],
] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData();
  return (
    <main className="min-h-screen bg-slate-50 p-5 pb-24 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Opérations</h1>
      <p className="mt-2 text-slate-600">
        Saisissez une opération réelle. La validation passe par une RPC
        PostgreSQL atomique qui crée une écriture équilibrée.
      </p>
      {params.success && (
        <p className="mt-4 rounded-xl border border-green-300 bg-green-50 p-3 text-green-800">
          Opération validée et persistée.
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
          Erreur : {params.error}
        </p>
      )}
      {!data.authenticated ? (
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-night px-4 py-3 font-semibold text-white"
        >
          Se connecter
        </Link>
      ) : !data.householdName ? (
        <Link
          href="/onboarding"
          className="mt-6 inline-block rounded-xl bg-night px-4 py-3 font-semibold text-white"
        >
          Créer le foyer
        </Link>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <form
            action={createQuickOperation}
            className="rounded-2xl border bg-white p-4 shadow-sm space-y-4"
          >
            <label className="block text-sm font-medium">
              Type d’opération
              <select
                name="operation_type"
                required
                className="mt-1 w-full rounded-xl border p-3"
              >
                {types.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Activité
              <select
                name="activity_code"
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="">Aucune / foyer</option>
                {data.activities.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Montant source
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue="10.00"
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Devise
                <select
                  name="currency"
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option>USD</option>
                  <option>CDF</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Taux vers USD
              <input
                name="exchange_rate"
                inputMode="decimal"
                required
                defaultValue="1"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <input
                name="description"
                required
                minLength={3}
                defaultValue="Opération rapide"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white disabled:opacity-60">
              Valider l’opération
            </button>
          </form>
          <aside className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Dernières écritures</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.operations.map((op) => (
                <li key={op.number} className="rounded-xl bg-slate-50 p-3">
                  <b>{op.number}</b> · {op.type}
                  <br />
                  {op.status} · {op.line_count} lignes
                </li>
              ))}
            </ul>
          </aside>
        </section>
      )}
    </main>
  );
}
