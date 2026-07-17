# Sécurité

- RLS est activée sur les tables métier avec isolation par `household_members`.
- Les écritures validées doivent être équilibrées et corrigées par annulation.
- Les montants utilisent `numeric(20,4)` dans PostgreSQL et `decimal.js` côté domaine TypeScript.
- La clé `service_role` est interdite dans le navigateur.
