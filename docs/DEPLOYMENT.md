# Déploiement

1. Créer un projet Supabase et appliquer `supabase/migrations`.
2. Configurer `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Vercel.
3. Ne jamais définir `SUPABASE_SERVICE_ROLE_KEY` avec préfixe `NEXT_PUBLIC_`.
4. Lancer `npm run build` avant promotion.
