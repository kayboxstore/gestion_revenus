import { requestPasswordReset, signIn, signUp } from "@/app/actions/auth";
import { AppIcon, BrandMark } from "@/components/app-icon";
import { APP_BRAND } from "@/lib/brand";
import Image from "next/image";

const messages: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  invalid_signup:
    "Saisissez un email valide et un mot de passe de 8 caractères minimum.",
  signup_failed: "Le compte n’a pas pu être créé. Réessayez dans un instant.",
  account_exists:
    "Un compte utilise déjà cette adresse. Essayez de vous connecter ou de réinitialiser le mot de passe.",
  email_rate_limited:
    "Trop d’emails ont été demandés. Patientez quelques minutes avant de réessayer.",
  signup_disabled: "La création de comptes est temporairement désactivée.",
  auth_configuration:
    "Le service de connexion est mal configuré. Vérifiez les paramètres Supabase du déploiement.",
  confirmation_sent: "Vérifiez votre boîte email pour confirmer votre compte.",
  invalid_email: "Saisissez une adresse email valide.",
  reset_sent: "Si ce compte existe, un lien de réinitialisation a été envoyé.",
  reset_ready:
    "Vous pouvez maintenant choisir un nouveau mot de passe depuis le lien reçu.",
  callback_failed: "Le lien de connexion est invalide ou a expiré.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const mode =
    params.mode === "signup" || params.mode === "reset" ? params.mode : "login";
  const message = params.message ? messages[params.message] : null;
  const action =
    mode === "signup"
      ? signUp
      : mode === "reset"
        ? requestPasswordReset
        : signIn;
  const title =
    mode === "signup"
      ? "Créer un compte"
      : mode === "reset"
        ? "Mot de passe oublié"
        : "Connexion";
  const subtitle =
    mode === "signup"
      ? "Créez l’espace financier privé de votre famille."
      : mode === "reset"
        ? "Recevez un lien sécurisé pour reprendre la main."
        : "Retrouvez instantanément la situation de votre foyer.";

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <figure className="auth-family-photo">
          <Image
            src="/images/famille-kayembe.webp"
            alt="Portrait du couple Kayembe"
            fill
            priority
            sizes="(min-width: 860px) 55vw, 100vw"
          />
        </figure>
        <div className="auth-brand">
          <BrandMark className="h-12 w-12" />
          <div>
            <strong>{APP_BRAND.name}</strong>
            <small>{APP_BRAND.descriptor}</small>
          </div>
        </div>
        <div className="auth-showcase-copy">
          <span className="auth-kicker">
            <i /> Simple. Fiable. À vous.
          </span>
          <h2>Votre famille mérite une vision claire de son argent.</h2>
          <p>
            Revenus, dépenses, stock et épargne réunis dans une expérience
            pensée pour votre téléphone.
          </p>
        </div>
        <div className="auth-feature-grid">
          <div>
            <span>
              <AppIcon name="trend" />
            </span>
            <strong>Résultat réel</strong>
            <small>Marges et bénéfices exacts</small>
          </div>
          <div>
            <span>
              <AppIcon name="shield" />
            </span>
            <strong>Données privées</strong>
            <small>Isolation stricte du foyer</small>
          </div>
          <div>
            <span>
              <AppIcon name="operations" />
            </span>
            <strong>Saisie éclair</strong>
            <small>Chaque action en quelques gestes</small>
          </div>
        </div>
      </section>

      <section className="auth-form-zone">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <BrandMark className="h-10 w-10" />
            <strong>{APP_BRAND.name}</strong>
          </div>
          <p className="auth-eyebrow">Espace sécurisé</p>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {message && (
            <p
              className="status-banner status-banner-info auth-message"
              role="status"
            >
              <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              {message}
            </p>
          )}
          <form action={action} className="auth-form">
            <label className="field-label">
              Email
              <span className="auth-input-wrap">
                <AppIcon name="user" />
                <input
                  name="email"
                  type="email"
                  required
                  className="premium-field"
                  placeholder="vous@exemple.com"
                />
              </span>
            </label>
            {mode !== "reset" && (
              <label className="field-label">
                Mot de passe
                <span className="auth-input-wrap">
                  <AppIcon name="shield" />
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    className="premium-field"
                    placeholder="8 caractères minimum"
                  />
                </span>
              </label>
            )}
            <input type="hidden" name="next" value={params.next ?? "/"} />
            <button className="premium-button auth-submit">
              {mode === "signup"
                ? "Créer le compte"
                : mode === "reset"
                  ? "Envoyer le lien"
                  : "Se connecter"}
              <AppIcon name="arrow" className="h-4 w-4" />
            </button>
          </form>
          <nav className="auth-links" aria-label="Options de connexion">
            {mode !== "login" && <a href="/login">Se connecter</a>}
            {mode !== "signup" && (
              <a href="/login?mode=signup">Créer un compte</a>
            )}
            {mode !== "reset" && (
              <a href="/login?mode=reset">Mot de passe oublié</a>
            )}
          </nav>
          <p className="auth-trust">
            <AppIcon name="shield" /> Connexion chiffrée et données isolées par
            foyer
          </p>
        </div>
      </section>
    </main>
  );
}
