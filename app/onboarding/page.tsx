import { onboardHousehold } from "@/app/actions/auth";
import { AppIcon, BrandMark } from "@/components/app-icon";
import { APP_BRAND } from "@/lib/brand";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="onboarding-page">
      <section className="onboarding-card surface-card">
        <header className="onboarding-header">
          <BrandMark className="h-12 w-12" />
          <p>Bienvenue dans {APP_BRAND.name}</p>
          <h1>Créons votre espace financier</h1>
          <span>Deux informations suffisent pour commencer.</span>
        </header>

        <ol className="onboarding-steps" aria-label="Étapes de configuration">
          <li data-active="true">
            <span>1</span>
            <small>Votre foyer</small>
          </li>
          <li>
            <span>2</span>
            <small>Comptes</small>
          </li>
          <li>
            <span>3</span>
            <small>Prêt</small>
          </li>
        </ol>

        {params.error && (
          <p className="status-banner status-banner-error" role="alert">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.error === "validation"
              ? "Vérifiez les informations saisies."
              : "L’initialisation a échoué. Réessayez ou contactez le support."}
          </p>
        )}

        <form action={onboardHousehold} className="onboarding-form">
          <label className="field-label">
            Votre nom
            <span className="auth-input-wrap">
              <AppIcon name="user" />
              <input
                name="display_name"
                required
                className="premium-field"
                placeholder="Ex. Kayembe"
              />
            </span>
          </label>
          <label className="field-label">
            Nom du foyer
            <span className="auth-input-wrap">
              <AppIcon name="family" />
              <input
                name="household_name"
                required
                className="premium-field"
                placeholder="Ex. Famille Kayembe"
              />
            </span>
          </label>
          <div className="onboarding-assurance">
            <span>
              <AppIcon name="check" />
            </span>
            <div>
              <strong>Configuration automatique</strong>
              <p>
                Activités, catégories, comptes USD/CDF et protections seront
                créés pour vous.
              </p>
            </div>
          </div>
          <button className="premium-button onboarding-submit">
            Initialiser
            <AppIcon name="arrow" className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
