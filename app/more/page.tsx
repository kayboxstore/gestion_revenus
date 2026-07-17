import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function Page() {
  const data = await getDashboardData();
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Plus</h1>
      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Paramètres du foyer</h2>
        <p className="mt-2 text-slate-600">
          {data.householdName ?? "Aucun foyer actif"} · devise USD · locale
          fr-CD · fuseau Africa/Kinshasa.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Membres et invitations protégés par rôles :
            owner/manager/operator/reader.
          </li>
          <li>Audit append-only pour onboarding, validation et annulation.</li>
          <li>
            Pièces jointes prévues sur stockage privé sans binaire dans Git.
          </li>
        </ul>
        {data.authenticated && (
          <form action={signOut} className="mt-4">
            <button className="rounded-xl border px-4 py-3 font-semibold">
              Déconnexion
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
