# Instructions permanentes — Gestion des revenus

## Priorités

1. Exactitude financière et intégrité des données.
2. Sécurité et isolation stricte des données du foyer.
3. Simplicité d’usage sur téléphone Android.
4. Accessibilité, performance et maintenabilité.
5. Design professionnel, chaleureux et sobre.

## Sources de vérité

Lire avant toute modification :

1. `docs/PRODUCT_SPEC.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATA_MODEL.md`

En cas de conflit, la spécification produit prévaut sur l’architecture, puis l’architecture sur les détails d’implémentation.

## Règles métier non négociables

- Ne jamais assimiler une entrée de trésorerie à un revenu.
- Ne jamais compter un transfert interne comme revenu ou dépense.
- Calculer le bénéfice brut après coût des marchandises vendues.
- Calculer le bénéfice net après dépenses d’exploitation et ajustements autorisés.
- Enregistrer les montants avec une précision décimale sûre, jamais en virgule flottante JavaScript.
- Conserver la devise d’origine, le taux appliqué et la valeur convertie dans la devise de base.
- Toute écriture validée doit être équilibrée. Une écriture validée est corrigée par annulation et nouvelle écriture, pas par réécriture silencieuse.
- Les suppressions de données financières validées sont interdites ; utiliser l’annulation avec motif et audit.
- Le billard existe comme activité inactive et doit pouvoir être activé sans migration de code.

## Stack et conventions

- Next.js App Router, TypeScript strict, React et Tailwind CSS.
- Supabase pour PostgreSQL et l’authentification ; migrations SQL versionnées.
- Validation partagée avec Zod.
- Composants accessibles, clavier utilisable, contrastes WCAG AA.
- Interface et messages utilisateur en français ; code, noms de tables et tests en anglais.
- Fuseau par défaut `Africa/Kinshasa`, locale `fr-CD`, devises initiales USD et CDF.
- Tests unitaires avec Vitest, tests d’intégration du domaine financier et parcours critiques avec Playwright.

## Qualité obligatoire

Avant de terminer une tâche :

- lancer le formatage, le lint, le typecheck, les tests unitaires et les tests d’intégration ;
- exécuter les tests E2E critiques si l’environnement le permet ;
- vérifier qu’aucun secret ni clé `service_role` n’est envoyé au navigateur ;
- vérifier les politiques RLS et les accès inter-foyers ;
- documenter toute limite réelle au lieu de masquer un test non exécuté ;
- garder les changements concentrés et lisibles.

## UX

- Mobile-first, navigation principale à cinq entrées maximum.
- L’action « Ajouter » doit permettre d’enregistrer rapidement vente, dépense, transfert, apport et épargne.
- Toujours afficher clairement la devise, le statut et l’activité.
- Prévenir les doubles soumissions et fournir des états de chargement, vide, succès et erreur.
- Le mode sombre est autorisé, mais le mode clair doit être complet et impeccable.

## Git

- Travailler sur une branche dédiée.
- Utiliser des commits conventionnels et atomiques.
- Ne pas modifier directement `main` après l’initialisation.
- Ouvrir une pull request avec résumé, captures des écrans principaux, migrations, commandes de test et risques connus.

