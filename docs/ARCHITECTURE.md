# Architecture technique

## 1. Choix directeur

Construire une application web progressive mobile-first, déployable sur Vercel, avec Next.js et Supabase. Le système doit rester exploitable comme une application mono-foyer tout en isolant les données par `household_id` pour permettre plusieurs foyers sans refonte.

## 2. Stack

- Next.js App Router et React ;
- TypeScript en mode strict ;
- Tailwind CSS et composants accessibles inspirés de shadcn/ui ;
- Supabase Auth et PostgreSQL ;
- migrations SQL Supabase versionnées ;
- Zod pour les schémas ;
- React Hook Form pour les formulaires ;
- TanStack Table pour les historiques ;
- bibliothèque de graphiques légère et accessible ;
- Vitest, Testing Library et Playwright ;
- PWA via manifeste, service worker prudent et stratégie réseau adaptée.

Éviter une couche ORM qui masquerait les politiques RLS. Utiliser le client Supabase typé et des fonctions PostgreSQL transactionnelles pour les opérations financières atomiques.

## 3. Découpage

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
  ui/
  finance/
  charts/
features/
  activities/
  sales/
  expenses/
  inventory/
  ledger/
  savings/
  reports/
lib/
  supabase/
  finance/
  validation/
  i18n/
supabase/
  migrations/
  seed.sql
tests/
  unit/
  integration/
  e2e/
```

Les composants d’interface ne calculent jamais les soldes. Les règles financières vivent dans le domaine et dans des fonctions PostgreSQL transactionnelles testées.

## 4. Écritures financières

Utiliser un grand livre en partie double :

- `journal_entries` contient l’événement métier, son état, sa date et ses références ;
- `journal_lines` contient au minimum deux lignes avec compte, débit, crédit, devise source, taux et valeur en devise de base ;
- une contrainte ou une fonction de validation garantit `sum(debit_base) = sum(credit_base)` avant passage à `posted` ;
- les soldes et rapports sont dérivés des lignes validées ;
- chaque vente, paiement, achat, dépense, transfert, apport, retrait et contribution d’épargne appelle une fonction atomique dédiée ;
- une annulation crée une écriture inverse liée à l’originale.

Les comptes du plan interne sont distincts des comptes de trésorerie présentés à l’utilisateur. Les comptes de trésorerie correspondent à des sous-comptes d’actif.

## 5. Multi-devise

- base du foyer configurable, USD par défaut ;
- devises initiales USD et CDF ;
- montants PostgreSQL `numeric(20,4)` et validation métier de la précision d’affichage ;
- chaque opération conserve devise, montant source, taux vers base et montant base ;
- le taux est figé lors de la validation ;
- les transferts entre devises conservent les deux montants et l’écart de change ;
- aucun calcul monétaire avec `number` flottant côté client ; utiliser chaînes décimales ou bibliothèque décimale.

## 6. Sécurité

- authentification Supabase avec cookies serveur ;
- RLS activée sur toute table métier ;
- appartenance validée par `household_members` ;
- fonctions sensibles en `security invoker` par défaut ; une fonction `security definer` doit fixer `search_path`, vérifier explicitement l’utilisateur et rester minimale ;
- clé `service_role` interdite dans le navigateur ;
- validation Zod côté client et serveur ;
- contrôle de rôle au serveur, jamais seulement dans l’UI ;
- limitation de débit sur les actions sensibles ;
- stockage privé des justificatifs avec politiques par foyer ;
- audit append-only pour validation, annulation, rôle, export et paramètres.

## 7. Données et cohérence

- identifiants UUID ;
- dates métier en `date`, instants en `timestamptz` ;
- timezone de présentation `Africa/Kinshasa` ;
- clés d’idempotence sur les commandes de validation ;
- contraintes uniques par foyer pour numéros de documents et codes actifs ;
- index sur `household_id`, dates, statuts et références ;
- pas de cascade destructive depuis les écritures validées ;
- soft delete uniquement pour les référentiels non utilisés, sinon désactivation.

## 8. Performance

- composants serveur pour lectures et agrégats ;
- mutations via Server Actions ou routes protégées appelant des RPC atomiques ;
- vues SQL ou fonctions stables pour rapports ;
- pagination par curseur pour les opérations ;
- cache seulement pour données non sensibles ou clés incluant le foyer ;
- invalidation ciblée après mutation.

## 9. Environnements

Fournir :

- `.env.example` sans secrets ;
- Supabase local via CLI ;
- migrations et seed de démonstration ;
- scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e` ;
- documentation de déploiement Vercel + Supabase ;
- CI GitHub Actions pour lint, typecheck, tests et build.

## 10. Stratégie de livraison

1. socle, auth, foyer, RLS et design system ;
2. grand livre, comptes et multi-devise ;
3. ventes, dépenses, transferts et épargne ;
4. stock et spécificités par activité ;
5. tableaux de bord, rapports et exports ;
6. PWA, accessibilité, sécurité, tests et documentation ;
7. pull request finale avec preuves de validation.

