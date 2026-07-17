# Gestion des revenus — Famille Kay

Application web mobile-first pour piloter les revenus, les dépenses, la trésorerie, l’épargne et les stocks d’une petite famille.

## Activités suivies

- Vente IPTV
- Vente de Mini UPS
- Vente d’Android TV Box
- Table de billard, désactivée par défaut et activable au lancement de l’activité

## Objectif

Donner à la famille une vue fiable de l’argent réellement disponible et de la rentabilité de chaque activité, sans confondre chiffre d’affaires, bénéfice, transferts, apports familiaux et épargne.

## Produit attendu

- interface française, responsive et installable comme PWA ;
- tableau de bord consolidé et vues par activité ;
- ventes, autres entrées, dépenses, achats et retraits familiaux ;
- comptes de trésorerie : caisse, banque, M-Pesa, Airtel Money et épargne ;
- gestion USD/CDF avec taux de conversion historisé ;
- stock pour Mini UPS et Android TV Box ;
- suivi des clients et échéances IPTV ;
- objectifs et contributions d’épargne ;
- budgets, rapports et exports ;
- rôles familiaux, journal d’audit et règles de sécurité par foyer.

## Documentation de référence

- [Spécification produit](docs/PRODUCT_SPEC.md)
- [Architecture technique](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Prompt maître Codex Web](docs/CODEX_WEB_MASTER_PROMPT.md)
- [Règles permanentes pour les agents](AGENTS.md)

## État du dépôt

Le dépôt contient d’abord le contrat produit et technique. La première mission Codex doit construire l’application complète conformément aux documents ci-dessus, valider les tests et ouvrir une pull request.
