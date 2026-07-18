import Link from "next/link";
import {
  cancelInvitation,
  createInvitation,
  createSavingsGoal,
  updateMemberRole,
} from "@/app/actions/administration";
import { signOut } from "@/app/actions/auth";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDashboardData();
  const canManage = data.role === "owner" || data.role === "manager";
  const isOwner = data.role === "owner";
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Plus</h1>
      {params.success && (
        <p className="mt-4 rounded-xl border border-green-300 bg-green-50 p-3 text-green-800">
          {params.success === "member"
            ? "Membre mis à jour avec audit."
            : params.success === "invitation"
              ? "Invitation créée."
              : params.success === "invitation_cancelled"
                ? "Invitation annulée."
                : "Objectif d’épargne créé. Vous pouvez maintenant enregistrer une contribution."}
        </p>
      )}
      {params.error && (
        <p
          className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800"
          role="alert"
        >
          {params.error === "not_allowed"
            ? "Votre rôle ne permet pas de gérer l’épargne."
            : "Vérifiez les informations de l’objectif d’épargne."}
        </p>
      )}
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

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Membres, invitations et rôles</h2>
        <p className="mt-2 text-sm text-slate-600">
          Seul le propriétaire peut changer les rôles, désactiver un membre ou
          annuler une invitation. Les lecteurs restent en consultation seule.
        </p>
        <div className="mt-4 space-y-3">
          {data.members.map((member) => (
            <form
              key={member.user_id}
              action={updateMemberRole}
              className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_150px_150px_auto]"
            >
              <input type="hidden" name="user_id" value={member.user_id} />
              <p className="text-sm">
                <b>{member.display_name ?? "Membre"}</b>
                <br />
                <span className="text-slate-500">{member.user_id}</span>
              </p>
              <label className="text-sm font-medium">
                Rôle
                <select
                  name="role"
                  defaultValue={member.role}
                  disabled={!isOwner}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="owner">Propriétaire</option>
                  <option value="manager">Gestionnaire</option>
                  <option value="operator">Opérateur</option>
                  <option value="reader">Lecteur</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Statut
                <select
                  name="status"
                  defaultValue={member.status}
                  disabled={!isOwner}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </label>
              {isOwner && (
                <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
                  Mettre à jour
                </button>
              )}
            </form>
          ))}
        </div>
        {isOwner && (
          <form
            action={createInvitation}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]"
          >
            <label className="block text-sm font-medium">
              Email invité
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Rôle
              <select name="role" className="mt-1 w-full rounded-xl border p-3">
                <option value="reader">Lecteur</option>
                <option value="operator">Opérateur</option>
                <option value="manager">Gestionnaire</option>
              </select>
            </label>
            <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white">
              Inviter
            </button>
          </form>
        )}
        <ul className="mt-4 space-y-2 text-sm">
          {data.invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <span>
                {invitation.email} · {invitation.role} · {invitation.status}
              </span>
              {isOwner && invitation.status === "pending" && (
                <form action={cancelInvitation}>
                  <input type="hidden" name="id" value={invitation.id} />
                  <button className="font-semibold text-red-700">
                    Annuler
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Objectifs d’épargne</h2>
        {data.savingsGoals.length ? (
          <ul className="mt-3 space-y-2">
            {data.savingsGoals.map((goal) => (
              <li key={goal.id} className="rounded-xl bg-slate-50 p-3">
                <b>{goal.name}</b> · cible {goal.target_amount} {goal.currency}
                {goal.target_date ? ` · ${goal.target_date}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-slate-600">Aucun objectif actif.</p>
        )}
        {canManage && (
          <form
            action={createSavingsGoal}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="block text-sm font-medium sm:col-span-2">
              Nom de l’objectif
              <input
                name="name"
                required
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Montant cible
              <input
                name="target_amount"
                inputMode="decimal"
                required
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Devise
              <select
                name="currency"
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option>USD</option>
                <option>CDF</option>
              </select>
            </label>
            <label className="block text-sm font-medium sm:col-span-2">
              Date cible facultative
              <input
                name="target_date"
                type="date"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button className="rounded-xl bg-night px-4 py-3 font-semibold text-white sm:col-span-2">
              Créer l’objectif
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
