import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { getStockWorkspaceData } from "@/lib/stock/queries";
import { StockWorkspace } from "./stock-workspace";

const errorMessages: Record<string, string> = {
  not_allowed: "Votre rôle ne permet pas d’effectuer cette action.",
  invalid_count: "Vérifiez la quantité comptée et la date de l’inventaire.",
  count_conflict:
    "Ce comptage a déjà été envoyé avec d’autres données. Rechargez la page.",
  count_failed: "Le comptage n’a pas pu être enregistré.",
  invalid_settings: "Vérifiez le SKU, le prix conseillé et le seuil d’alerte.",
  duplicate_sku: "Ce SKU est déjà utilisé par un autre produit.",
  settings_failed: "Les réglages du produit n’ont pas pu être enregistrés.",
  insufficient_stock:
    "Stock insuffisant : approvisionnez le produit ou vérifiez le comptage avant de vendre.",
  operation_failed:
    "L’opération de stock n’a pas pu être validée. Vérifiez les informations saisies.",
};

export const metadata = { title: "Stock" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getStockWorkspaceData();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <main className="app-page stock-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Pilotage quotidien"
          title="Stock"
          description="Quantités, valorisation, alertes et inventaires physiques dans un poste de contrôle unique."
          icon="box"
          actions={
            <span className="stock-live-pill">
              <span aria-hidden="true" />
              Données validées
            </span>
          }
        />

        {params.success && (
          <p className="status-banner status-banner-success" role="status">
            <AppIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.success === "count"
              ? "Comptage physique enregistré. L’écart est tracé sans modifier silencieusement le stock comptable."
              : params.success === "settings"
                ? "Fiche produit et seuil d’alerte mis à jour."
                : "Opération de stock validée et inventaire recalculé."}
          </p>
        )}
        {params.error && (
          <p className="status-banner status-banner-error" role="alert">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {errorMessages[params.error] ?? errorMessages.operation_failed}
          </p>
        )}

        {!data.configured ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="settings" />
            </span>
            <strong>Supabase doit être configuré</strong>
            <p>
              Ajoutez les variables d’environnement avant de gérer le stock.
            </p>
          </section>
        ) : !data.authenticated ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="user" />
            </span>
            <strong>Connectez-vous pour voir le stock</strong>
            <p>Les données de chaque foyer restent strictement isolées.</p>
            <Link href="/login?next=/stock" className="premium-button">
              Se connecter
            </Link>
          </section>
        ) : !data.householdName ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="family" />
            </span>
            <strong>Créez d’abord votre foyer</strong>
            <p>Les produits et l’emplacement principal seront préparés.</p>
            <Link href="/onboarding" className="premium-button">
              Créer le foyer
            </Link>
          </section>
        ) : (
          <StockWorkspace data={data} today={today} />
        )}
      </div>
      <AppNavigation />
    </main>
  );
}
