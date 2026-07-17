import Link from "next/link";
import { updateActivity } from "@/app/actions/administration";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData();
  const canManage = data.role === "owner" || data.role === "manager";
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
      {params.success && (
        <p className="mt-4 rounded-xl border border-green-300 bg-green-50 p-3 text-green-800">
          Activité mise à jour.
        </p>
      )}
      {params.error && (
        <p
          className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800"
          role="alert"
        >
          {params.error === "not_allowed"
            ? "Votre rôle ne permet pas de gérer les activités."
            : "La modification n’a pas pu être enregistrée."}
        </p>
      )}
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
              {canManage ? (
                <form action={updateActivity} className="mt-2 space-y-3">
                  <input type="hidden" name="id" value={activity.id} />
                  <label className="block text-sm font-medium">
                    Nom
                    <input
                      name="name"
                      required
                      defaultValue={activity.name}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    État
                    <select
                      name="active"
                      defaultValue={String(activity.active)}
                      className="mt-1 w-full rounded-xl border p-3"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>
                  <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
                    Enregistrer
                  </button>
                </form>
              ) : (
                <h2 className="mt-1 text-xl font-semibold">{activity.name}</h2>
              )}
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
