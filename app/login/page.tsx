import { requestPasswordReset, signIn, signUp } from "@/app/actions/auth";

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

  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-bold">
        {mode === "signup"
          ? "Créer un compte"
          : mode === "reset"
            ? "Mot de passe oublié"
            : "Connexion"}
      </h1>
      {message && (
        <p
          className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
          role="status"
        >
          {message}
        </p>
      )}
      <form action={action} className="mt-6 space-y-4">
        <label className="block">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        {mode !== "reset" && (
          <label className="block">
            Mot de passe
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="mt-1 w-full rounded-xl border p-3"
            />
          </label>
        )}
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
          {mode === "signup"
            ? "Créer le compte"
            : mode === "reset"
              ? "Envoyer le lien"
              : "Se connecter"}
        </button>
      </form>
      <nav
        className="mt-6 flex flex-wrap gap-4 text-sm text-blue-700"
        aria-label="Options de connexion"
      >
        {mode !== "login" && <a href="/login">Se connecter</a>}
        {mode !== "signup" && <a href="/login?mode=signup">Créer un compte</a>}
        {mode !== "reset" && (
          <a href="/login?mode=reset">Mot de passe oublié</a>
        )}
      </nav>
    </main>
  );
}
