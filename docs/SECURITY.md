# Sécurité

- Supabase SSR maintient la session côté serveur via `proxy.ts` et les cookies sécurisés.
- RLS est activée sur les tables métier avec isolation par `household_members`.
- La création du premier foyer passe par la RPC atomique `bootstrap_household`, qui crée le propriétaire et les référentiels initiaux sans ouvrir les politiques RLS.
- Les écritures validées sont postées par RPC, doivent être équilibrées et sont corrigées par annulation avec motif.
- Les lignes d'écritures postées sont immuables par trigger.
- Les documents financiers validés et les écritures finalisées sont immuables ; toute correction crée une écriture inverse conservant les références aux comptes de trésorerie.
- Les routes métier redirigent les visiteurs non authentifiés et les rôles sont vérifiés dans les RPC, indépendamment de l'interface.
- Les clés d'idempotence sont isolées par foyer et liées à l'empreinte complète de l'opération afin de refuser une relance modifiée.
- Les montants utilisent `numeric(20,4)` dans PostgreSQL et `decimal.js` côté domaine TypeScript.
- Les fonctions `security definer` fixent `search_path=public` et révoquent/accordent explicitement l'exécution.
- La clé `service_role` est interdite dans le navigateur et ne doit jamais être préfixée par `NEXT_PUBLIC_`.
- Le service worker ne met en cache que les ressources statiques ; aucune page ni donnée financière authentifiée n'est stockée hors ligne.
