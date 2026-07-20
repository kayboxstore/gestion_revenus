import Link from "next/link";
import { reverseOperation } from "@/app/actions/administration";
import { AppIcon } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { getDashboardData } from "@/lib/dashboard/queries";
import { translateStatus } from "@/lib/i18n/status";
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

const operationLabels: Record<string, string> = {
  cash_sale: "Vente encaissée",
  credit_sale: "Vente à crédit",
  payment: "Paiement reçu",
  opening_stock: "Stock initial",
  stock_purchase: "Achat de stock",
  operating_expense: "Dépense activité",
  family_expense: "Dépense familiale",
  transfer: "Transfert",
  family_contribution: "Apport familial",
  family_withdrawal: "Retrait familial",
  savings_contribution: "Épargne",
};

function isZeroQuantity(quantity?: string) {
  return !quantity || /^0(?:\.0+)?$/.test(quantity);
}

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
    <main className="app-page operations-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Centre de saisie"
          title="Opérations"
          description="Une expérience guidée qui transforme chaque action en écriture fiable, équilibrée et traçable."
          icon="operations"
          actions={
            <span className="security-pill">
              <AppIcon name="shield" className="h-4 w-4" />
              Sécurisé par RLS
            </span>
          }
        />

        {params.success && (
          <p className="status-banner status-banner-success" role="status">
            <AppIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.success === "reversed"
              ? "Écriture annulée par une écriture inverse traçable."
              : params.success === "opening_stock"
                ? "Stock initial enregistré sans modifier la caisse ni le résultat."
                : "Opération validée et persistée."}
          </p>
        )}
        {params.error && (
          <p className="status-banner status-banner-error" role="alert">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {errorMessages[params.error] ?? errorMessages.operation_failed}
          </p>
        )}
        {!data.authenticated ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="user" />
            </span>
            <strong>Connectez-vous pour continuer</strong>
            <p>Vos opérations restent isolées dans votre foyer.</p>
            <Link href="/login" className="premium-button">
              Se connecter
            </Link>
          </section>
        ) : !data.householdName ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="family" />
            </span>
            <strong>Créez d’abord votre foyer</strong>
            <p>
              L’assistant prépare les comptes, activités et devises initiales.
            </p>
            <Link href="/onboarding" className="premium-button">
              Créer le foyer
            </Link>
          </section>
        ) : (
          <section className="operations-layout">
            <QuickOperationForm data={data} initialType={params.type} />
            <aside className="operations-sidebar">
              <section className="surface-card sidebar-card stock-card">
                <div className="section-title">
                  <div>
                    <h2>Stock disponible</h2>
                    <p>Quantités en temps réel.</p>
                  </div>
                  <span className="sidebar-card-icon">
                    <AppIcon name="box" />
                  </span>
                </div>
                {physicalProducts.length ? (
                  <ul className="stock-list">
                    {physicalProducts.map((product) => (
                      <li key={product.id}>
                        <span className="stock-product-icon">
                          <AppIcon name="box" />
                        </span>
                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {isZeroQuantity(product.stock_quantity)
                              ? "À approvisionner"
                              : "Disponible"}
                          </small>
                        </div>
                        <strong
                          className="tabular-nums"
                          data-empty={
                            isZeroQuantity(product.stock_quantity) || undefined
                          }
                        >
                          {product.stock_quantity ?? "0.0000"}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sidebar-empty">Aucun produit physique actif.</p>
                )}
              </section>

              <section className="surface-card sidebar-card recent-operations-card">
                <div className="section-title">
                  <div>
                    <h2>Dernières écritures</h2>
                    <p>Validation et annulation tracées.</p>
                  </div>
                  <span className="sidebar-card-icon">
                    <AppIcon name="reports" />
                  </span>
                </div>
                {data.operations.length ? (
                  <ul className="operations-journal-list">
                    {data.operations.map((operation) => (
                      <li key={operation.number}>
                        <div className="journal-row">
                          <span
                            className="journal-status-dot"
                            data-status={operation.status}
                          />
                          <div>
                            <strong>
                              {operationLabels[operation.type] ??
                                operation.type}
                            </strong>
                            <small>{operation.number}</small>
                          </div>
                          <span>{translateStatus(operation.status)}</span>
                        </div>
                        <p>
                          {operation.line_count} lignes comptables équilibrées
                        </p>
                        {canManage && operation.status === "posted" && (
                          <details className="reversal-panel">
                            <summary>Annuler cette écriture</summary>
                            <form action={reverseOperation}>
                              <input
                                type="hidden"
                                name="entry_id"
                                value={operation.id}
                              />
                              <label className="field-label">
                                Motif d’annulation
                                <input
                                  name="reason"
                                  required
                                  minLength={3}
                                  className="premium-field"
                                />
                              </label>
                              <button className="danger-button w-full">
                                Annuler l’écriture
                              </button>
                            </form>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sidebar-empty">
                    Votre première écriture apparaîtra ici.
                  </p>
                )}
              </section>
            </aside>
          </section>
        )}
      </div>
      <AppNavigation />
    </main>
  );
}
