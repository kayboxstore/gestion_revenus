import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/finance/money";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(period: string, customFrom?: string, customTo?: string) {
  if (period === "all") return { from: null, to: null };
  if (period === "custom") {
    return {
      from: customFrom && datePattern.test(customFrom) ? customFrom : null,
      to: customTo && datePattern.test(customTo) ? customTo : null,
    };
  }
  const kinshasaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const to = new Date(`${kinshasaToday}T00:00:00Z`);
  const from = new Date(to);
  if (period === "today") return { from: isoDate(from), to: isoDate(to) };
  if (period === "week")
    from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  else if (period === "quarter")
    from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3, 1);
  else if (period === "year") from.setUTCMonth(0, 1);
  else from.setUTCDate(1);
  return { from: isoDate(from), to: isoDate(to) };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = [
    "today",
    "week",
    "month",
    "quarter",
    "year",
    "custom",
    "all",
  ].includes(params.period ?? "")
    ? (params.period as string)
    : "month";
  const range = periodRange(period, params.from, params.to);
  const activityId =
    params.activity && uuidPattern.test(params.activity)
      ? params.activity
      : null;
  const data = await getDashboardData({ ...range, activityId });
  const cards = [
    ["Chiffre d’affaires", data.kpis.revenue],
    ["Bénéfice brut", data.kpis.gross_profit],
    ["Bénéfice net", data.kpis.net_profit],
    ["Dépenses familiales", data.kpis.family_expenses],
    ["Épargne", data.kpis.savings],
    ["Trésorerie", data.kpis.cash],
  ];
  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <section className="bg-night px-5 py-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-80">
              {data.householdName ?? "Foyer non initialisé"} · Africa/Kinshasa ·
              USD/CDF
            </p>
            <h1 className="mt-2 text-3xl font-bold">Tableau de bord</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              Les indicateurs sont lus depuis Supabase et calculés par RPC à
              partir des écritures validées du foyer connecté.
            </p>
          </div>
          {data.authenticated ? (
            <form action={signOut}>
              <button className="rounded-xl border border-white/40 px-3 py-2 text-sm">
                Déconnexion
              </button>
            </form>
          ) : (
            <Link
              className="rounded-xl border border-white/40 px-3 py-2 text-sm"
              href="/login"
            >
              Connexion
            </Link>
          )}
        </div>
      </section>

      {!data.configured && (
        <section className="px-4 py-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            Configurez Supabase avec `.env.local` pour activer les données
            réelles.
          </div>
        </section>
      )}
      {data.configured && data.authenticated && !data.householdName && (
        <section className="px-4 py-4">
          <Link
            href="/onboarding"
            className="block rounded-2xl border bg-white p-4 font-semibold text-electric"
          >
            Créer le premier foyer
          </Link>
        </section>
      )}

      {data.authenticated && data.householdName && (
        <section className="px-4 pt-5">
          <form
            className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
            method="get"
          >
            <label className="text-sm font-medium">
              Période
              <select
                name="period"
                defaultValue={period}
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="today">Aujourd’hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
                <option value="custom">Intervalle personnalisé</option>
                <option value="all">Toute la période</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Activité
              <select
                name="activity"
                defaultValue={activityId ?? ""}
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="">Toutes les activités</option>
                {data.activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Du
              <input
                name="from"
                type="date"
                defaultValue={params.from ?? ""}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="text-sm font-medium">
              Au
              <input
                name="to"
                type="date"
                defaultValue={params.to ?? ""}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button className="self-end rounded-xl bg-night px-4 py-3 font-semibold text-white">
              Appliquer
            </button>
          </form>
        </section>
      )}

      <section className="grid gap-3 px-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <article
            key={label}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-600">{label}</p>
            <strong className="tabular mt-2 block text-2xl">
              {formatMoney(value)}
            </strong>
          </article>
        ))}
      </section>

      <section className="px-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Ajouter rapidement</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              "Vente",
              "Entrée",
              "Dépense",
              "Achat",
              "Transfert",
              "Apport",
              "Retrait",
              "Épargne",
            ].map((x) => (
              <Link
                className="focus-ring rounded-xl border border-slate-300 px-3 py-3 text-left font-medium hover:bg-slate-50"
                key={x}
                href="/operations"
              >
                {x}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 px-4 py-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Activités</h2>
          {data.activities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Aucune activité. Lancez l’onboarding pour créer IPTV, Mini UPS,
              Android TV Box et Billard inactif.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.activities.map((a) => (
                <li
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                  key={a.code}
                >
                  <span>{a.name}</span>
                  <span
                    className={a.active ? "text-green-700" : "text-amber-700"}
                  >
                    {a.active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-semibold">Dernières opérations</h2>
          {data.operations.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Aucune écriture validée pour cette période.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.operations.map((e) => (
                <li className="rounded-xl bg-slate-50 p-3" key={e.number}>
                  <span className="font-medium">
                    {e.number} · {e.type}
                  </span>
                  <span className="ml-2 text-green-700">{e.status}</span>
                  <span className="block text-slate-600">
                    {e.line_count} lignes équilibrées
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t bg-white text-center text-xs shadow-lg"
      >
        <Link className="p-3 font-semibold text-electric" href="/">
          Accueil
        </Link>
        <Link className="p-3" href="/operations">
          Opérations
        </Link>
        <Link className="p-3" href="/activities">
          Activités
        </Link>
        <Link className="p-3" href="/reports">
          Rapports
        </Link>
        <Link className="p-3" href="/more">
          Plus
        </Link>
      </nav>
    </main>
  );
}
