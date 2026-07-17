import Link from "next/link";
import { reverseOperation } from "@/app/actions/administration";
import { createQuickOperation } from "@/app/actions/operations";
import { getDashboardData } from "@/lib/dashboard/queries";
import { SubmitButton } from "./submit-button";

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

const errorMessages: Record<string, string> = {
  validation: "Vérifiez les champs obligatoires et les formats saisis.",
  not_allowed: "Votre rôle ne permet pas d’enregistrer cette opération.",
  insufficient_stock: "Le stock disponible est insuffisant.",
  payment_exceeds_sale_balance: "Le paiement dépasse le solde de la vente.",
  idempotency_key_conflict_for_household:
    "Cette soumission existe déjà avec des données différentes.",
  operation_failed:
    "L’opération n’a pas pu être validée. Vérifiez les comptes, devises et références choisis.",
  reversal_validation:
    "Indiquez un motif d’annulation d’au moins trois caractères.",
  reversal_failed: "L’écriture n’a pas pu être annulée.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData();
  const canManage = data.role === "owner" || data.role === "manager";
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
          {params.success === "reversed"
            ? "Écriture annulée par une écriture inverse traçable."
            : "Opération validée et persistée."}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
          {errorMessages[params.error] ?? errorMessages.operation_failed}
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

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">
                Champs métier obligatoires selon le type choisi
              </p>
              <label className="block text-sm font-medium">
                Date d’opération
                <input
                  name="operation_date"
                  type="date"
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Produit / offre IPTV
                <select
                  name="product_id"
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choisir explicitement un produit</option>
                  {data.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Quantité
                <input
                  name="quantity"
                  inputMode="decimal"
                  placeholder="1"
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Vente à régler
                <select
                  name="sale_id"
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choisir une vente ouverte</option>
                  {data.openSales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.number} · {sale.total_source} · {sale.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Échéance crédit
                <input
                  name="due_date"
                  type="date"
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Compte source / encaissement
                  <select
                    name="source_cash_account_id"
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option value="">Choisir le compte source</option>
                    {data.cashAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Compte destination
                  <select
                    name="destination_cash_account_id"
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option value="">Choisir le compte destination</option>
                    {data.cashAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Montant reçu (transfert)
                  <input
                    name="destination_amount"
                    inputMode="decimal"
                    placeholder="Même montant"
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Devise reçue
                  <select
                    name="destination_currency"
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option value="">Même devise</option>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Taux reçu vers USD
                  <input
                    name="destination_exchange_rate"
                    inputMode="decimal"
                    placeholder="Même taux"
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Catégorie de dépense
                <select
                  name="category_id"
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choisir une catégorie</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} · {category.type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Objectif d’épargne
                <select
                  name="savings_goal_id"
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Choisir un objectif</option>
                  {data.savingsGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name} · {goal.currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Frais de transfert / achat
                <input
                  name="fees_source"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>
            </div>
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
            <input
              name="idempotency_key"
              type="hidden"
              value={crypto.randomUUID()}
            />
            <SubmitButton />
          </form>
          <aside className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Dernières écritures</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.operations.map((op) => (
                <li key={op.number} className="rounded-xl bg-slate-50 p-3">
                  <b>{op.number}</b> · {op.type}
                  <br />
                  {op.status} · {op.line_count} lignes
                  {canManage && op.status === "posted" && (
                    <form action={reverseOperation} className="mt-3 space-y-2">
                      <input type="hidden" name="entry_id" value={op.id} />
                      <label className="block font-medium text-red-800">
                        Motif d’annulation
                        <input
                          name="reason"
                          required
                          minLength={3}
                          className="mt-1 w-full rounded-lg border border-red-200 bg-white p-2 text-slate-900"
                        />
                      </label>
                      <button className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-800">
                        Annuler l’écriture
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        </section>
      )}
    </main>
  );
}
