import { signIn } from "@/app/actions/auth";
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-bold">Connexion</h1>
      <form action={signIn} className="mt-6 space-y-4">
        <label className="block">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="block">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
          Se connecter
        </button>
      </form>
    </main>
  );
}
