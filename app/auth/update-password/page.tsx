import { updatePassword } from "@/app/actions/auth";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>
      {params.error && (
        <p
          className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800"
          role="alert"
        >
          Le mot de passe doit contenir au moins 8 caractères.
        </p>
      )}
      <form action={updatePassword} className="mt-6 space-y-4">
        <label className="block">
          Nouveau mot de passe
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
          Enregistrer
        </button>
      </form>
    </main>
  );
}
