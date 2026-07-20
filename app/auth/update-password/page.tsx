import { updatePassword } from "@/app/actions/auth";
import { AppIcon, BrandMark } from "@/components/app-icon";
import { APP_BRAND } from "@/lib/brand";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="onboarding-page">
      <section className="auth-form-card password-card">
        <div className="auth-mobile-brand password-brand">
          <BrandMark className="h-11 w-11" />
          <strong>{APP_BRAND.name}</strong>
        </div>
        <p className="auth-eyebrow">Sécurité du compte</p>
        <h1>Nouveau mot de passe</h1>
        <p className="auth-subtitle">
          Choisissez une phrase secrète unique pour protéger les données du
          foyer.
        </p>
        {params.error && (
          <p
            className="status-banner status-banner-error auth-message"
            role="alert"
          >
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            Le mot de passe doit contenir au moins 8 caractères.
          </p>
        )}
        <form action={updatePassword} className="auth-form">
          <label className="field-label">
            Nouveau mot de passe
            <span className="auth-input-wrap">
              <AppIcon name="shield" />
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
                className="premium-field"
                placeholder="8 caractères minimum"
              />
            </span>
          </label>
          <button className="premium-button auth-submit">
            Enregistrer
            <AppIcon name="check" className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
