import Link from "next/link";
import {
  cancelInvitation,
  createInvitation,
  createSavingsGoal,
  updateMemberRole,
} from "@/app/actions/administration";
import { signOut } from "@/app/actions/auth";
import { AppIcon } from "@/components/app-icon";
import { AppNavigation } from "@/components/app-navigation";
import { PageHeading } from "@/components/page-heading";
import { getDashboardData } from "@/lib/dashboard/queries";

const roleLabels: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  operator: "Opérateur",
  reader: "Lecteur",
};

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
    <main className="app-page more-page">
      <div className="app-page-inner">
        <PageHeading
          eyebrow="Espace du foyer"
          title="Plus"
          description="Membres, objectifs et paramètres essentiels réunis dans un espace simple et sécurisé."
          icon="more"
          actions={
            <span className="role-pill">
              <AppIcon name="shield" className="h-4 w-4" />
              {data.role ? roleLabels[data.role] : "Non connecté"}
            </span>
          }
        />

        {params.success && (
          <p className="status-banner status-banner-success" role="status">
            <AppIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
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
          <p className="status-banner status-banner-error" role="alert">
            <AppIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {params.error === "not_allowed"
              ? "Votre rôle ne permet pas de gérer cet élément."
              : "Vérifiez les informations saisies puis réessayez."}
          </p>
        )}

        <section className="household-profile">
          <div className="household-profile-main">
            <span className="household-avatar">
              {(data.householdName ?? "F").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <small>Foyer actif</small>
              <h2>{data.householdName ?? "Aucun foyer actif"}</h2>
              <p>USD · fr-CD · Africa/Kinshasa</p>
            </div>
          </div>
          <div className="household-profile-stats">
            <div>
              <strong>{data.members.length}</strong>
              <small>Membres</small>
            </div>
            <div>
              <strong>
                {data.activities.filter((item) => item.active).length}
              </strong>
              <small>Activités</small>
            </div>
            <div>
              <strong>{data.savingsGoals.length}</strong>
              <small>Objectifs</small>
            </div>
          </div>
        </section>

        <nav className="management-shortcuts" aria-label="Outils de gestion">
          <Link href="/activities">
            <span>
              <AppIcon name="activities" />
            </span>
            <div>
              <strong>Activités</strong>
              <small>Services, commerce et billard</small>
            </div>
            <AppIcon name="arrow" />
          </Link>
          <Link href="/stock">
            <span>
              <AppIcon name="box" />
            </span>
            <div>
              <strong>Gestion du stock</strong>
              <small>Quantités, alertes et comptages</small>
            </div>
            <AppIcon name="arrow" />
          </Link>
        </nav>

        <section className="more-grid">
          <section className="surface-card settings-card">
            <div className="section-title">
              <div>
                <h2>Paramètres du foyer</h2>
                <p>Configuration générale et sécurité.</p>
              </div>
              <span className="sidebar-card-icon">
                <AppIcon name="settings" />
              </span>
            </div>
            <div className="settings-list">
              <div>
                <span>
                  <AppIcon name="wallet" />
                </span>
                <div>
                  <strong>Devise de base</strong>
                  <small>Dollar américain (USD)</small>
                </div>
                <b>USD</b>
              </div>
              <div>
                <span>
                  <AppIcon name="calendar" />
                </span>
                <div>
                  <strong>Fuseau horaire</strong>
                  <small>Heure locale du foyer</small>
                </div>
                <b>Kinshasa</b>
              </div>
              <div>
                <span>
                  <AppIcon name="shield" />
                </span>
                <div>
                  <strong>Protection des données</strong>
                  <small>Isolation RLS et audit actif</small>
                </div>
                <b className="setting-ok">Activée</b>
              </div>
            </div>
            {data.authenticated && (
              <form action={signOut} className="settings-signout">
                <button className="secondary-button w-full">
                  <AppIcon name="logout" className="h-4 w-4" />
                  Déconnexion
                </button>
              </form>
            )}
          </section>

          <section className="surface-card savings-card">
            <div className="section-title">
              <div>
                <h2>Objectifs d’épargne</h2>
                <p>Transformez les projets en progrès visibles.</p>
              </div>
              <span className="sidebar-card-icon savings-icon">
                <AppIcon name="target" />
              </span>
            </div>
            {data.savingsGoals.length ? (
              <ul className="savings-goal-list">
                {data.savingsGoals.map((goal) => (
                  <li key={goal.id}>
                    <span>
                      <AppIcon name="savings" />
                    </span>
                    <div>
                      <strong>{goal.name}</strong>
                      <small>
                        Cible {goal.target_amount} {goal.currency}
                        {goal.target_date ? ` · ${goal.target_date}` : ""}
                      </small>
                    </div>
                    <AppIcon name="arrow" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="compact-empty">
                <AppIcon name="target" />
                <div>
                  <strong>Aucun objectif actif</strong>
                  <p>Créez votre premier cap d’épargne.</p>
                </div>
              </div>
            )}
            {canManage && (
              <details className="inline-creator">
                <summary>
                  <AppIcon name="plus" /> Créer un objectif
                </summary>
                <form action={createSavingsGoal}>
                  <label className="field-label inline-creator-wide">
                    Nom de l’objectif
                    <input
                      name="name"
                      required
                      className="premium-field"
                      placeholder="Ex. Fonds d’urgence"
                    />
                  </label>
                  <label className="field-label">
                    Montant cible
                    <input
                      name="target_amount"
                      inputMode="decimal"
                      required
                      className="premium-field"
                    />
                  </label>
                  <label className="field-label">
                    Devise
                    <select name="currency" className="premium-field">
                      <option>USD</option>
                      <option>CDF</option>
                    </select>
                  </label>
                  <label className="field-label inline-creator-wide">
                    Date cible facultative
                    <input
                      name="target_date"
                      type="date"
                      className="premium-field"
                    />
                  </label>
                  <button className="premium-button inline-creator-wide">
                    Créer l’objectif
                  </button>
                </form>
              </details>
            )}
          </section>
        </section>

        <section className="surface-card members-card">
          <div className="section-title">
            <div>
              <h2>Membres, invitations et rôles</h2>
              <p>Chacun voit et fait uniquement ce que son rôle autorise.</p>
            </div>
            <span className="sidebar-card-icon members-icon">
              <AppIcon name="members" />
            </span>
          </div>

          <div className="member-list">
            {data.members.map((member) => (
              <form
                key={member.user_id}
                action={updateMemberRole}
                className="member-card"
              >
                <input type="hidden" name="user_id" value={member.user_id} />
                <div className="member-identity">
                  <span>
                    {(member.display_name ?? "M").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{member.display_name ?? "Membre"}</strong>
                    <small>{member.user_id}</small>
                  </div>
                </div>
                <label className="field-label">
                  Rôle
                  <select
                    name="role"
                    defaultValue={member.role}
                    disabled={!isOwner}
                    className="premium-field"
                  >
                    <option value="owner">Propriétaire</option>
                    <option value="manager">Gestionnaire</option>
                    <option value="operator">Opérateur</option>
                    <option value="reader">Lecteur</option>
                  </select>
                </label>
                <label className="field-label">
                  Statut
                  <select
                    name="status"
                    defaultValue={member.status}
                    disabled={!isOwner}
                    className="premium-field"
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </label>
                {isOwner && (
                  <button className="secondary-button">Mettre à jour</button>
                )}
              </form>
            ))}
          </div>

          {isOwner && (
            <form action={createInvitation} className="invitation-form">
              <div className="invitation-heading">
                <span>
                  <AppIcon name="plus" />
                </span>
                <div>
                  <strong>Inviter une personne</strong>
                  <small>L’invitation reste révocable.</small>
                </div>
              </div>
              <label className="field-label">
                Email invité
                <input
                  name="email"
                  type="email"
                  required
                  className="premium-field"
                  placeholder="membre@exemple.com"
                />
              </label>
              <label className="field-label">
                Rôle
                <select name="role" className="premium-field">
                  <option value="reader">Lecteur</option>
                  <option value="operator">Opérateur</option>
                  <option value="manager">Gestionnaire</option>
                </select>
              </label>
              <button className="premium-button">Inviter</button>
            </form>
          )}

          {data.invitations.length > 0 && (
            <div className="pending-invitations">
              <h3>Invitations en cours</h3>
              <ul>
                {data.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span>
                      <AppIcon name="user" />
                    </span>
                    <div>
                      <strong>{invitation.email}</strong>
                      <small>
                        {roleLabels[invitation.role] ?? invitation.role} ·{" "}
                        {invitation.status}
                      </small>
                    </div>
                    {isOwner && invitation.status === "pending" && (
                      <form action={cancelInvitation}>
                        <input type="hidden" name="id" value={invitation.id} />
                        <button>Annuler</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      <AppNavigation />
    </main>
  );
}
