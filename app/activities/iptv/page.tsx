import { randomUUID } from "node:crypto";
import Link from "next/link";
import { createIptvPlan, setIptvPlanStatus } from "@/app/actions/iptv";
import { AppIcon } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { formatMoney } from "@/lib/finance/money";
import {
  getIptvWorkspaceData,
  type IptvLifecycleStatus,
} from "@/lib/iptv/queries";
import { translateStatus } from "@/lib/i18n/status";
import { IptvSubscriptionForm } from "./iptv-subscription-form";

const allowedStatuses = new Set([
  "all",
  "active",
  "expiring",
  "expired",
  "cancelled",
  "suspended",
]);

const errorMessages: Record<string, string> = {
  validation: "Vérifiez les informations du client et du règlement.",
  not_allowed: "Votre rôle ne permet pas d’effectuer cette action.",
  invalid_plan: "La formule choisie est inactive ou n’existe plus.",
  account_currency:
    "Le compte d’encaissement doit utiliser la même devise que la formule.",
  inactive_activity: "Activez l’activité IPTV avant d’ajouter un abonnement.",
  submission_conflict:
    "Cette demande a déjà été envoyée avec d’autres informations. Rechargez la page.",
  duplicate_customer:
    "Cet identifiant IPTV est déjà suivi. Ouvrez sa fiche pour le renouveler.",
  already_renewed:
    "Cette période a déjà été renouvelée. Rechargez la liste avant de continuer.",
  operation_failed:
    "L’activation n’a pas pu être enregistrée. Vérifiez le compte, la formule et le taux.",
  plan_validation: "Vérifiez le nom, la durée, le prix et la devise.",
  duplicate_plan: "Une formule porte déjà ce nom.",
  plan_failed: "La formule n’a pas pu être enregistrée.",
};

const statusLabels: Record<IptvLifecycleStatus, string> = {
  active: "Actif",
  expiring: "Expire bientôt",
  expired: "Expiré",
  scheduled: "Programmé",
  suspended: "Suspendu",
  cancelled: "Annulé",
};

function kinshasaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateLabel(value: string | null) {
  if (!value) return "Aucune";
  return new Intl.DateTimeFormat("fr-CD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kinshasa",
  }).format(new Date(`${value}T12:00:00Z`));
}

function daysUntil(value: string, today: string) {
  const end = Date.parse(`${value}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function filterHref(status: string, search: string, page = 1) {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (search) query.set("q", search);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/activities/iptv${suffix ? `?${suffix}` : ""}`;
}

export const metadata = { title: "Clients IPTV" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const status = allowedStatuses.has(params.status ?? "")
    ? (params.status as string)
    : "all";
  const search = (params.q ?? "").trim().slice(0, 100);
  const pageNumber = Number.parseInt(params.page ?? "1", 10);
  const today = kinshasaToday();
  const data = await getIptvWorkspaceData({
    status,
    search,
    page: Number.isFinite(pageNumber) ? pageNumber : 1,
    asOf: today,
  });
  const canOperate = ["owner", "manager", "operator"].includes(data.role ?? "");
  const canManage = ["owner", "manager"].includes(data.role ?? "");
  const activePlans = data.plans.filter((plan) => plan.active);
  const nextExpiryDays = data.overview.nextExpiration
    ? daysUntil(data.overview.nextExpiration, today)
    : null;

  return (
    <main className="app-page iptv-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Activité IPTV"
          title="Clients et échéances"
          description="Activez, renouvelez et surveillez chaque abonnement sans séparer la vente de son encaissement."
          icon="signal"
          actions={
            <Link
              href="/activities"
              className="secondary-button iptv-back-link"
            >
              <AppIcon name="arrow" /> Activités
            </Link>
          }
        />

        {params.success && (
          <p className="status-banner status-banner-success" role="status">
            <AppIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.success === "renewed"
              ? "Abonnement renouvelé, vente et échéance enregistrées."
              : params.success === "activated"
                ? "Client activé, vente et abonnement enregistrés ensemble."
                : params.success === "plan"
                  ? "Nouvelle formule IPTV créée."
                  : "État de la formule mis à jour."}
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
              Ajoutez les variables d’environnement pour gérer les clients IPTV.
            </p>
          </section>
        ) : !data.authenticated ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="user" />
            </span>
            <strong>Connectez-vous pour continuer</strong>
            <p>Les clients de chaque foyer restent strictement isolés.</p>
            <Link
              href="/login?next=/activities/iptv"
              className="premium-button"
            >
              Se connecter
            </Link>
          </section>
        ) : !data.householdName ? (
          <section className="empty-state surface-card">
            <span>
              <AppIcon name="family" />
            </span>
            <strong>Créez d’abord votre foyer</strong>
            <p>La formule mensuelle initiale sera préparée automatiquement.</p>
            <Link href="/onboarding" className="premium-button">
              Créer le foyer
            </Link>
          </section>
        ) : (
          <>
            {!data.activityActive && (
              <section className="status-banner status-banner-error">
                <AppIcon name="alert" className="h-5 w-5 shrink-0" />
                L’activité IPTV est inactive. Réactivez-la dans les activités
                avant toute vente.
              </section>
            )}

            <section className="iptv-command-hero surface-card animate-enter">
              <div className="iptv-command-copy">
                <span>Centre de renouvellement</span>
                <h2>Ne perdez plus une échéance client.</h2>
                <p>
                  Les abonnements proches de l’expiration remontent
                  automatiquement, avec leur client, leur formule et la vente
                  liée.
                </p>
              </div>
              <div className="iptv-next-expiry">
                <span>
                  <AppIcon name="calendar" />
                </span>
                <small>Prochaine échéance</small>
                <strong>{dateLabel(data.overview.nextExpiration)}</strong>
                <p>
                  {nextExpiryDays === null
                    ? "Ajoutez le premier abonnement"
                    : nextExpiryDays < 0
                      ? "Échéance dépassée"
                      : nextExpiryDays === 0
                        ? "Aujourd’hui"
                        : `Dans ${nextExpiryDays} jour${nextExpiryDays > 1 ? "s" : ""}`}
                </p>
              </div>
            </section>

            <section className="iptv-kpi-grid" aria-label="Résumé IPTV">
              <article>
                <span>
                  <AppIcon name="members" />
                </span>
                <div>
                  <small>Clients suivis</small>
                  <strong>{data.overview.customerCount}</strong>
                </div>
              </article>
              <article>
                <span>
                  <AppIcon name="check" />
                </span>
                <div>
                  <small>Actifs</small>
                  <strong>{data.overview.activeCount}</strong>
                </div>
              </article>
              <article
                data-alert={data.overview.expiringCount > 0 || undefined}
              >
                <span>
                  <AppIcon name="calendar" />
                </span>
                <div>
                  <small>À renouveler</small>
                  <strong>{data.overview.expiringCount}</strong>
                </div>
              </article>
              <article
                data-danger={data.overview.expiredCount > 0 || undefined}
              >
                <span>
                  <AppIcon name="alert" />
                </span>
                <div>
                  <small>Expirés</small>
                  <strong>{data.overview.expiredCount}</strong>
                </div>
              </article>
            </section>

            {canOperate && (
              <details
                className="iptv-action-panel surface-card"
                open={params.open === "activation"}
              >
                <summary>
                  <span>
                    <AppIcon name="plus" />
                  </span>
                  <div>
                    <strong>Activer un nouveau client</strong>
                    <small>
                      Client, vente et échéance en une seule validation
                    </small>
                  </div>
                  <AppIcon name="arrow" />
                </summary>
                {activePlans.length ? (
                  <IptvSubscriptionForm
                    mode="activation"
                    plans={activePlans}
                    cashAccounts={data.cashAccounts}
                    baseCurrency={data.baseCurrency}
                    today={today}
                    idempotencyKey={randomUUID()}
                  />
                ) : (
                  <div className="iptv-inline-empty">
                    <AppIcon name="alert" />
                    <p>
                      Créez ou réactivez une formule avant d’ajouter un client.
                    </p>
                  </div>
                )}
              </details>
            )}

            <section className="iptv-toolbar surface-card">
              <form method="get" className="iptv-search-form">
                <label>
                  <AppIcon name="user" />
                  <span className="sr-only">Rechercher un client</span>
                  <input
                    name="q"
                    defaultValue={search}
                    placeholder="Client, téléphone ou identifiant…"
                  />
                </label>
                {status !== "all" && (
                  <input type="hidden" name="status" value={status} />
                )}
                <button className="secondary-button">Rechercher</button>
              </form>
              <nav
                className="iptv-status-filters"
                aria-label="Filtrer les abonnements"
              >
                {[
                  ["all", "Tous"],
                  ["active", "Actifs"],
                  ["expiring", "Bientôt"],
                  ["expired", "Expirés"],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    href={filterHref(value, search)}
                    data-active={status === value || undefined}
                    aria-current={status === value ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </section>

            <section className="iptv-list-section">
              <div className="iptv-section-heading">
                <div>
                  <span>Portefeuille clients</span>
                  <h2>Abonnements IPTV</h2>
                  <p>
                    {data.pagination.total} résultat
                    {data.pagination.total > 1 ? "s" : ""}
                  </p>
                </div>
                {canManage && (
                  <details className="iptv-plan-manager">
                    <summary>
                      <AppIcon name="settings" /> Formules
                    </summary>
                    <div className="iptv-plan-popover">
                      <header>
                        <strong>Formules IPTV</strong>
                        <small>Prix, durée et disponibilité</small>
                      </header>
                      <ul>
                        {data.plans.map((plan) => (
                          <li key={plan.id}>
                            <div>
                              <strong>{plan.name}</strong>
                              <small>
                                {plan.durationDays} jours ·{" "}
                                {formatMoney(plan.price, plan.currency)}
                              </small>
                            </div>
                            <form action={setIptvPlanStatus}>
                              <input type="hidden" name="id" value={plan.id} />
                              <input
                                type="hidden"
                                name="active"
                                value={String(!plan.active)}
                              />
                              <button className="text-button">
                                {plan.active ? "Désactiver" : "Réactiver"}
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                      <form action={createIptvPlan} className="iptv-plan-form">
                        <label className="field-label">
                          Nom
                          <input
                            className="premium-field"
                            name="name"
                            required
                            placeholder="Ex. Trimestriel"
                          />
                        </label>
                        <div className="iptv-form-grid">
                          <label className="field-label">
                            Durée (jours)
                            <input
                              className="premium-field"
                              name="duration_days"
                              type="number"
                              min="1"
                              max="730"
                              required
                              defaultValue="30"
                            />
                          </label>
                          <label className="field-label">
                            Prix
                            <input
                              className="premium-field"
                              name="price"
                              inputMode="decimal"
                              required
                              placeholder="10.00"
                            />
                          </label>
                        </div>
                        <label className="field-label">
                          Devise
                          <select
                            className="premium-field"
                            name="currency"
                            defaultValue="USD"
                          >
                            <option>USD</option>
                            <option>CDF</option>
                          </select>
                        </label>
                        <button className="premium-button">
                          <AppIcon name="plus" /> Ajouter la formule
                        </button>
                      </form>
                    </div>
                  </details>
                )}
              </div>

              {data.subscriptions.length === 0 ? (
                <div className="empty-state surface-card iptv-empty-state">
                  <span>
                    <AppIcon name="signal" />
                  </span>
                  <strong>
                    {search || status !== "all"
                      ? "Aucun client ne correspond"
                      : "Aucun abonnement IPTV"}
                  </strong>
                  <p>
                    {search || status !== "all"
                      ? "Modifiez la recherche ou le filtre."
                      : "Activez le premier client pour commencer le suivi des échéances."}
                  </p>
                  {search || status !== "all" ? (
                    <Link href="/activities/iptv" className="secondary-button">
                      Effacer les filtres
                    </Link>
                  ) : canOperate ? (
                    <Link
                      href="/activities/iptv?open=activation"
                      className="premium-button"
                    >
                      Activer un client
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="iptv-subscription-grid">
                  {data.subscriptions.map((subscription) => {
                    const remaining = daysUntil(
                      subscription.expirationDate,
                      today,
                    );
                    return (
                      <article
                        key={subscription.id}
                        className="iptv-subscription-card surface-card"
                        data-status={subscription.lifecycleStatus}
                      >
                        <header>
                          <span className="iptv-customer-avatar">
                            {subscription.customerName
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <div>
                            <small>{subscription.customerIdentifier}</small>
                            <h3>{subscription.customerName}</h3>
                            {subscription.customerPhone && (
                              <p>{subscription.customerPhone}</p>
                            )}
                          </div>
                          <span
                            className="iptv-status-badge"
                            data-status={subscription.lifecycleStatus}
                          >
                            <i /> {statusLabels[subscription.lifecycleStatus]}
                          </span>
                        </header>
                        <div className="iptv-term-panel">
                          <div>
                            <small>Formule</small>
                            <strong>{subscription.planName}</strong>
                            <span>
                              {formatMoney(
                                subscription.planPrice,
                                subscription.planCurrency,
                              )}
                            </span>
                          </div>
                          <div>
                            <small>Expiration</small>
                            <strong>
                              {dateLabel(subscription.expirationDate)}
                            </strong>
                            <span>
                              {remaining < 0
                                ? `Expiré depuis ${Math.abs(remaining)} j`
                                : remaining === 0
                                  ? "Expire aujourd’hui"
                                  : `${remaining} jour${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`}
                            </span>
                          </div>
                        </div>
                        <footer className="iptv-card-footer">
                          <div>
                            <small>Vente liée</small>
                            <strong>{subscription.saleNumber}</strong>
                            <span>
                              {translateStatus(subscription.saleStatus)}
                            </span>
                          </div>
                          {canOperate &&
                            subscription.lifecycleStatus !== "cancelled" &&
                            activePlans.length > 0 && (
                              <details className="iptv-renew-panel">
                                <summary>
                                  <AppIcon name="signal" /> Renouveler
                                </summary>
                                <div className="iptv-renew-drawer">
                                  <IptvSubscriptionForm
                                    mode="renewal"
                                    plans={activePlans}
                                    cashAccounts={data.cashAccounts}
                                    baseCurrency={data.baseCurrency}
                                    today={today}
                                    idempotencyKey={randomUUID()}
                                    renewedFromId={subscription.id}
                                    customerName={subscription.customerName}
                                    customerIdentifier={
                                      subscription.customerIdentifier
                                    }
                                    currentPlanId={subscription.planId}
                                  />
                                </div>
                              </details>
                            )}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}

              {data.pagination.totalPages > 1 && (
                <nav
                  className="iptv-pagination"
                  aria-label="Pages des abonnements"
                >
                  {data.pagination.page > 1 ? (
                    <Link
                      className="secondary-button"
                      href={filterHref(
                        status,
                        search,
                        data.pagination.page - 1,
                      )}
                    >
                      Précédent
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>
                    Page {data.pagination.page} sur {data.pagination.totalPages}
                  </span>
                  {data.pagination.page < data.pagination.totalPages && (
                    <Link
                      className="secondary-button"
                      href={filterHref(
                        status,
                        search,
                        data.pagination.page + 1,
                      )}
                    >
                      Suivant
                    </Link>
                  )}
                </nav>
              )}
            </section>
          </>
        )}
      </div>
      <AppNavigation />
    </main>
  );
}
