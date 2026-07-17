# Déploiement

1. Installer Supabase CLI et lancer `supabase db reset` en local pour valider les migrations.
2. Créer un projet Supabase distant et appliquer `supabase/migrations`.
3. Configurer `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Vercel.
4. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` au navigateur.
5. Exécuter `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build` et `npm run test:e2e` avant promotion.
6. Garder hors Git les rapports Playwright, traces, vidéos, captures et builds générés.
