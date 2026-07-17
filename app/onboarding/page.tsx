import { onboardHousehold } from "@/app/actions/auth";
export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-bold">Créer le foyer</h1>
      <p className="mt-2 text-slate-600">
        Cette action crée atomiquement le foyer, le propriétaire, les activités,
        catégories, comptes et devises initiales.
      </p>
      <form action={onboardHousehold} className="mt-6 space-y-4">
        <label className="block">
          Votre nom
          <input
            name="display_name"
            required
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="block">
          Nom du foyer
          <input
            name="household_name"
            required
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
          Initialiser
        </button>
      </form>
    </main>
  );
}
