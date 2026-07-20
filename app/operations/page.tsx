import Link from "next/link";
import { reverseOperation } from "@/app/actions/administration";
import { getDashboardData } from "@/lib/dashboard/queries";
import { QuickOperationForm } from "./quick-operation-form";

const errorMessages: Record<string, string> = {
  validation: "Vérifiez les champs obligatoires et les formats saisis.",
  not_allowed: "Votre rôle ne permet pas d’enregistrer cette opération.",
  insufficient_stock:
    "Stock insuffisant. Enregistrez d’abord « Stock initial » si vous possédiez déjà l’article, ou « Achat de stock » si vous venez de l’acheter.",
  invalid_opening_product:
    "Le stock initial s’applique uniquement à un produit physique actif.",
  invalid_opening_stock:
    "La quantité, la valeur totale et le taux doivent être supérieurs à zéro.",
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
  const physicalProducts = data.products.filter(
    (product) => product.type === "physical",
  );
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
            : params.success === "opening_stock"
              ? "Stock initial enregistré sans modifier la caisse ni le résultat."
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
          <QuickOperationForm data={data} />
          <aside className="space-y-4">
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="text-xl font-semibold">Stock disponible</h2>
              {physicalProducts.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {physicalProducts.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                    >
                      <span>{product.name}</span>
                      <strong className="tabular-nums">
                        {product.stock_quantity ?? "0.0000"}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Aucun produit physique actif.
                </p>
              )}
            </section>
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="text-xl font-semibold">Dernières écritures</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.operations.map((op) => (
                  <li key={op.number} className="rounded-xl bg-slate-50 p-3">
                    <b>{op.number}</b> · {op.type}
                    <br />
                    {op.status} · {op.line_count} lignes
                    {canManage && op.status === "posted" && (
                      <form
                        action={reverseOperation}
                        className="mt-3 space-y-2"
                      >
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
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}
