# Mission maître pour Codex Web

Tu travailles sur le dépôt `kayboxstore/gestion_revenus`, actuellement initialisé uniquement avec sa documentation de référence. Construis l’application complète de gestion des revenus d’une petite famille.

## Résultat attendu

Livre un MVP réellement exécutable, sécurisé, testé et prêt à être déployé. Ne produis pas seulement une maquette, une procédure ou du pseudo-code. Implémente l’application, les migrations, les tests, la documentation et la CI, puis ouvre une pull request.

## Lecture obligatoire

Avant toute modification, lis entièrement :

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`

Ces fichiers constituent le contrat. N’ignore aucune règle financière ou exigence de sécurité.

## Mode d’exécution

1. Inspecte le dépôt et reformule un plan d’implémentation court.
2. Crée une branche `feat/initial-family-finance-app`.
3. Implémente par tranches verticales fonctionnelles ; ne laisse pas une succession d’écrans factices.
4. À chaque tranche, ajoute les migrations, le domaine, l’UI et les tests correspondants.
5. Utilise Supabase local pour valider migrations, fonctions et RLS. Si une dépendance externe ou un secret manque, fournis un mode local complet et poursuis tout ce qui ne dépend pas de ce secret.
6. Ne demande pas à l’utilisateur de choisir des détails techniques déjà tranchés dans la documentation.
7. N’abandonne pas au premier échec : diagnostique, corrige et relance les validations.

## Ordre de construction obligatoire

### Phase A — Fondation

- Next.js App Router, TypeScript strict, Tailwind, composants accessibles ;
- configuration ESLint/formatage, Vitest, Playwright et GitHub Actions ;
- Supabase local, migrations, types et `.env.example` ;
- authentification, foyer, rôles, onboarding ;
- design system et navigation responsive/PWA.

### Phase B — Noyau financier

- plan de comptes interne ;
- comptes de trésorerie ;
- grand livre en partie double ;
- fonctions transactionnelles atomiques ;
- idempotence, validation, annulation et audit ;
- USD/CDF avec taux figé ;
- tests de propriétés ou cas limites prouvant l’équilibre des écritures.

### Phase C — Opérations

- ventes, paiements et créances ;
- dépenses d’exploitation et familiales ;
- apports, retraits et transferts ;
- objectifs et contributions d’épargne ;
- saisie rapide mobile.

### Phase D — Activités

- IPTV : plans, abonnements, échéances et renouvellement ;
- Mini UPS et Android TV Box : produits, achats, coût moyen, stock, ventes et alertes ;
- Billard : activité inactive, activable, séances ou parties et tarification.

### Phase E — Pilotage

- dashboard consolidé et filtrable ;
- résultats et marges par activité ;
- trésorerie, dépenses, épargne, créances et stock ;
- rapports CSV, reçus et synthèses PDF ;
- budgets et alertes.

### Phase F — Durcissement

- politiques RLS complètes et tests inter-foyers ;
- accessibilité, responsive 360 px, états d’erreur et doubles soumissions ;
- sécurité, en-têtes, contrôle des secrets et audit ;
- performance et pagination ;
- documentation d’installation, sauvegarde et déploiement.

## Données initiales

Créer automatiquement pour un nouveau foyer :

- activités actives IPTV, Mini UPS et Android TV Box ;
- activité Billard inactive ;
- comptes suggérés Caisse USD, Caisse CDF, M-Pesa USD, M-Pesa CDF, Banque et Épargne ;
- catégories usuelles d’exploitation et de famille ;
- devise de base USD, devise secondaire CDF, locale `fr-CD`, timezone `Africa/Kinshasa`.

Le seed de développement doit montrer tous les parcours mais ne doit jamais être exécuté en production.

## Barrière de qualité

La mission n’est pas terminée tant que ces commandes ne réussissent pas :

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npm run test:e2e
```

Si les noms de scripts diffèrent pour une bonne raison, documente l’équivalence. Ajoute des tests couvrant les 12 critères d’acceptation de `docs/PRODUCT_SPEC.md`, avec priorité aux calculs, annulations, idempotence, multi-devise, stock et RLS.

## Livrables GitHub

- code complet ;
- migrations et seed ;
- tests et CI ;
- `README.md` transformé en guide d’installation et d’utilisation tout en conservant les liens vers les spécifications ;
- captures des vues principales ou rapport Playwright équivalent ;
- `docs/DEPLOYMENT.md`, `docs/SECURITY.md` et `docs/USER_GUIDE.md` ;
- pull request vers `main` avec résumé, choix clés, commandes exécutées, résultats, captures, variables d’environnement et limites réelles.

## Interdictions

- Pas de données fictives codées en dur dans les écrans de production.
- Pas de calcul financier uniquement côté client.
- Pas de suppression physique d’écritures validées.
- Pas de `service_role` exposée au navigateur.
- Pas de RLS reportée à « plus tard ».
- Pas de `number` flottant pour les calculs monétaires.
- Pas de rapport de réussite si les tests n’ont pas réellement été exécutés.

Commence maintenant et poursuis jusqu’à l’ouverture de la pull request. Si une action externe impossible depuis l’environnement reste nécessaire, termine tout le reste, fournis la commande ou l’écran exact à utiliser et marque clairement ce seul blocage.

