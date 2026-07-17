# Gestion des revenus — Famille Kay

Application Next.js/Supabase mobile-first pour gérer revenus, dépenses, achats, transferts, épargne, stock et rentabilité d'un foyer sans confondre flux de trésorerie et revenu.

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

## Documentation

- [Spécification produit](docs/PRODUCT_SPEC.md)
- [Architecture technique](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Prompt maître Codex Web](docs/CODEX_WEB_MASTER_PROMPT.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Sécurité](docs/SECURITY.md)
- [Guide utilisateur](docs/USER_GUIDE.md)
- [Règles permanentes pour les agents](AGENTS.md)
