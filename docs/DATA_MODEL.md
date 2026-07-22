# Modèle de données logique

## 1. Identité et foyer

- `profiles`: profil minimal lié à `auth.users`.
- `households`: nom, devise de base, locale, timezone et paramètres.
- `household_members`: utilisateur, foyer, rôle, état et dates d’invitation.
- `audit_logs`: acteur, action, entité, identifiant, métadonnées filtrées et horodatage.

## 2. Référentiels

- `activities`: code, nom, type `service|retail|venue|other`, actif, couleur et ordre.
- `categories`: type `income|operating_expense|family_expense|other`, parent facultatif et actif.
- `contacts`: client, fournisseur ou les deux.
- `products`: activité, type, SKU, nom, prix, coût indicatif, seuil et actif.
- `iptv_plans`: durée, prix, devise et actif.
- `currencies`: code, précision et actif par foyer.
- `exchange_rates`: devise source, devise cible, taux, date et source manuelle.

## 3. Comptabilité et trésorerie

- `ledger_accounts`: plan interne, type comptable et compte parent.
- `cash_accounts`: nom utilisateur, type, devise et lien vers compte d’actif.
- `journal_entries`: numéro, type, date, statut, description, activité, source et idempotency key.
- `journal_lines`: écriture, compte, débit/crédit source et base, devise et taux.
- `reconciliations`: compte, période, solde relevé, écart et état.

Statuts des écritures : `draft`, `posted`, `reversed`. Le statut `deleted` n’existe pas.

## 4. Ventes et créances

- `sales`: numéro, activité, client, date, statut, devise, totaux et échéance.
- `sale_items`: produit/service, description, quantité, prix, remise, taxe, coût et totaux.
- `payments`: vente facultative, contact, compte, montant, devise, taux, date et statut.
- `iptv_subscriptions`: client, plan, identifiant, activation, expiration, état, vente/écriture source et période précédente lors d’un renouvellement.
- `billiard_sessions`: début/fin facultatifs, parties/durée, tarif et vente source.

Statuts de vente : `draft`, `confirmed`, `partially_paid`, `paid`, `overdue`, `cancelled`.

## 5. Dépenses et achats

- `expenses`: catégorie, portée activité/famille, fournisseur, compte, date, montants et statut.
- `purchases`: fournisseur, compte, date, devise, frais, totaux et statut.
- `purchase_items`: produit, quantité, coût unitaire, frais répartis et total.
- `recurring_templates`: type, fréquence, prochaine date et données validées.

## 6. Stock

- `inventory_locations`: emplacement, principal et actif.
- `stock_movements`: produit, emplacement, type, quantité, coût, référence et date.
- `inventory_counts`: inventaire, état, date et responsable.
- `inventory_count_lines`: produit, quantité théorique, quantité comptée et écart.

Le stock courant et le coût moyen sont dérivés de mouvements validés ou maintenus dans une projection transactionnelle reconstruisible.

## 7. Épargne et budget

- `savings_goals`: nom, cible, devise, date cible, priorité et état.
- `savings_contributions`: objectif, compte source, compte épargne, montant, date et écriture.
- `budgets`: période, portée et devise.
- `budget_lines`: catégorie ou activité, montant et seuils.

## 8. Pièces jointes et numérotation

- `attachments`: bucket path privé, type MIME, taille, hash et entité liée.
- `document_sequences`: foyer, type, année et compteur, verrouillé transactionnellement.

## 9. Règles relationnelles

- toutes les tables métier portent `household_id`, y compris les tables enfants lorsque cela renforce la RLS et les index ;
- toute référence croisée doit appartenir au même foyer ;
- toute entité utilisée par une écriture validée devient non supprimable ;
- les agrégats de dashboard ne lisent que les écritures et documents validés ;
- les dates de création et modification ainsi que l’acteur sont conservés.

## 10. Jeux de tests indispensables

- vente IPTV payée comptant ;
- vente produit avec coût moyen ;
- vente partiellement payée et créance ;
- dépense d’exploitation vs dépense familiale ;
- achat de stock sans fausse dépense immédiate ;
- transfert même devise et change USD/CDF avec frais ;
- apport familial, retrait et contribution d’épargne ;
- annulation par écriture inverse ;
- soumission répétée avec même clé d’idempotence ;
- accès RLS inter-foyers refusé pour chaque domaine.
