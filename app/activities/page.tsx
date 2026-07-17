import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function Page() {
  const data = await getDashboardData();
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Activités</h1>
      <p className="mt-2 text-slate-600">
        IPTV, Mini UPS, Android TV Box et Billard sont lus depuis le foyer
        connecté. Le billard reste disponible mais inactif par défaut.
      </p>
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {data.activities.length === 0 ? (
          <p className="rounded-2xl border bg-white p-4">
            Aucune activité : terminez l’onboarding.
          </p>
        ) : (
          data.activities.map((activity) => (
            <article
              key={activity.code}
              className="rounded-2xl border bg-white p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {activity.code}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{activity.name}</h2>
              <p
                className={
                  activity.active
                    ? "mt-2 text-green-700"
                    : "mt-2 text-amber-700"
                }
              >
                {activity.active ? "Active" : "Inactive"}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
