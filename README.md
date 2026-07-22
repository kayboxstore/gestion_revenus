# Gestion des revenus — Famille Kayembe

Application Next.js/Supabase mobile-first pour gérer revenus, dépenses, achats, transferts, épargne, stock, clients IPTV et rentabilité d'un foyer sans confondre flux de trésorerie et revenu.

## Démarrage local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Les données de production ne sont pas codées en dur : l'accueil lit la session Supabase SSR puis appelle `get_dashboard_kpis` pour dériver les indicateurs depuis les écritures validées du foyer.

## Base Supabase

Appliquer les migrations versionnées :

```bash
supabase start
supabase db reset
```

La migration crée le bootstrap atomique `bootstrap_household`, les tables du modèle logique, les politiques RLS par foyer et les RPC d'écriture/annulation comptable.

Les tests d'intégration se connectent réellement à PostgreSQL via `TEST_DATABASE_URL`. Ils appellent les RPC sous le rôle Supabase `authenticated` et prouvent le coût moyen, l'équilibre des écritures, l'idempotence, l'annulation, les droits Lecteur et l'isolation entre foyers. La CI démarre Supabase local avant de les exécuter.

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npm run test:e2e
```

Sans Supabase local, les scénarios PostgreSQL et le parcours E2E authentifié sont explicitement ignorés ; ils ne sont jamais remplacés par une lecture textuelle des migrations.

## Documentation

- [Spécification produit](docs/PRODUCT_SPEC.md)
- [Architecture technique](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Prompt maître Codex Web](docs/CODEX_WEB_MASTER_PROMPT.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Sécurité](docs/SECURITY.md)
- [Guide utilisateur](docs/USER_GUIDE.md)
- [Règles permanentes pour les agents](AGENTS.md)
