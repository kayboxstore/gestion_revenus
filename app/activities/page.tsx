import { updateActivity } from "@/app/actions/administration";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { getDashboardData } from "@/lib/dashboard/queries";

const activityDescriptions: Record<string, string> = {
  IPTV: "Abonnements, activations et renouvellements clients.",
  MINI_UPS: "Stock, ventes et marge sur les Mini UPS.",
  ANDROID_TV_BOX: "Pilotage des Box Android et de leur rentabilité.",
  BILLIARD: "Parties, durée et encaissements de la table de billard.",
};

function activityIcon(code: string): AppIconName {
  if (code === "IPTV") return "signal";
  if (code === "ANDROID_TV_BOX") return "tv";
  if (code === "BILLIARD") return "billiard";
  return "box";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData();
  const canManage = data.role === "owner" || data.role === "manager";
  const activeCount = data.activities.filter(
    (activity) => activity.active,
  ).length;
  return (
    <main className="app-page activities-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Portefeuille"
          title="Activités"
          description="Chaque source de revenus garde son identité, ses produits et ses performances — dans une seule vision."
          icon="activities"
          actions={
            <span className="activity-summary-pill">
              <span /> {activeCount} active{activeCount > 1 ? "s" : ""}
            </span>
          }
        />

        {params.success && (
          <p className="status-banner status-banner-success" role="status">
            <AppIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            Activité mise à jour.
          </p>
        )}
        {params.error && (
          <p className="status-banner status-banner-error" role="alert">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.error === "not_allowed"
              ? "Votre rôle ne permet pas de gérer les activités."
              : "La modification n’a pas pu être enregistrée."}
          </p>
        )}

        <section className="activity-overview surface-card">
          <div>
            <span className="activity-overview-icon">
              <AppIcon name="trend" />
            </span>
            <div>
              <small>Écosystème familial</small>
              <strong>{data.activities.length} moteurs de revenus</strong>
            </div>
          </div>
          <p>
            Activez le billard le jour du lancement, sans migration ni
            changement de code.
          </p>
        </section>

        <section className="activities-grid">
          {data.activities.length === 0 ? (
            <div className="empty-state surface-card">
              <span>
                <AppIcon name="activities" />
              </span>
              <strong>Aucune activité pour le moment</strong>
              <p>Terminez l’assistant initial pour créer votre portefeuille.</p>
            </div>
          ) : (
            data.activities.map((activity, index) => (
              <article
                key={activity.code}
                className="activity-card surface-card animate-enter"
                data-code={activity.code}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <header className="activity-card-header">
                  <span className="activity-card-icon">
                    <AppIcon
                      name={activityIcon(activity.code)}
                      className="h-7 w-7"
                    />
                  </span>
                  <span
                    className="activity-status"
                    data-active={activity.active || undefined}
                  >
                    <i /> {activity.active ? "Active" : "En attente"}
                  </span>
                </header>
                <p className="activity-code">{activity.code}</p>
                <h2>{activity.name}</h2>
                <p className="activity-description">
                  {activityDescriptions[activity.code] ??
                    "Activité personnalisée du foyer."}
                </p>
                {canManage ? (
                  <form action={updateActivity} className="activity-form">
                    <input type="hidden" name="id" value={activity.id} />
                    <label className="field-label">
                      Nom affiché
                      <input
                        name="name"
                        required
                        defaultValue={activity.name}
                        className="premium-field"
                      />
                    </label>
                    <label className="field-label">
                      État de l’activité
                      <select
                        name="active"
                        defaultValue={String(activity.active)}
                        className="premium-field"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </label>
                    <button className="secondary-button activity-save-button">
                      <AppIcon name="check" className="h-4 w-4" />
                      Enregistrer
                    </button>
                  </form>
                ) : (
                  <div className="activity-readonly">
                    <AppIcon name="shield" className="h-4 w-4" />
                    Consultation seule
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
      <AppNavigation />
    </main>
  );
}
