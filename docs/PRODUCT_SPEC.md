# Spécification produit — Gestion des revenus d’une petite famille

## 1. Vision

Créer une application simple mais comptablement fiable qui permet à une petite famille de savoir, à tout moment : combien elle possède, d’où vient l’argent, ce que chaque activité rapporte réellement, où part l’argent et si les objectifs d’épargne progressent.

Le produit doit remplacer les notes éparses, les calculs manuels et les tableaux difficiles à maintenir. Il doit être utilisable principalement depuis un téléphone Android, sans vocabulaire comptable intimidant.

## 2. Périmètre métier

### 2.1 Activités initiales

| Code | Activité | Type | État initial | Particularités |
| --- | --- | --- | --- | --- |
| `IPTV` | Vente IPTV | Service récurrent | Active | client, formule, date d’activation, date d’expiration, renouvellement |
| `MINI_UPS` | Vente Mini UPS | Produit physique | Active | achat, stock, coût unitaire, marge |
| `ANDROID_TV_BOX` | Vente Android TV Box | Produit physique | Active | achat, stock, coût unitaire, marge |
| `BILLIARD` | Table de billard | Service à la séance | Inactive | activation ultérieure, prix par partie ou durée, encaissements journaliers |

L’administrateur peut ajouter, renommer, désactiver ou réactiver une activité sans déploiement.

### 2.2 Périmètre financier

- ventes et autres revenus ;
- achats de stock et coût des marchandises vendues ;
- dépenses d’activité et dépenses familiales ;
- apports familiaux, emprunts, remboursements et retraits personnels ;
- transferts entre caisse, banque, mobile money et épargne ;
- objectifs d’épargne et contributions ;
- budgets mensuels ;
- soldes, résultat, marge, flux de trésorerie et valeur du stock ;
- multi-devise USD/CDF.

## 3. Principes de calcul

L’application doit distinguer les concepts suivants :

- **Chiffre d’affaires** : total des ventes validées hors annulations.
- **Coût des ventes** : coût des unités effectivement vendues, calculé selon la méthode du coût moyen pondéré.
- **Bénéfice brut** : chiffre d’affaires moins coût des ventes.
- **Dépenses d’exploitation** : dépenses nécessaires aux activités.
- **Dépenses familiales** : sorties destinées au foyer, visibles séparément du résultat opérationnel.
- **Bénéfice net d’activité** : bénéfice brut moins dépenses d’exploitation et autres charges d’activité.
- **Flux de trésorerie** : mouvements réels sur les comptes, y compris transferts, apports et retraits.
- **Épargne** : argent affecté à un compte ou un objectif d’épargne ; ce n’est ni une dépense ni un revenu.

Une vente à crédit augmente le chiffre d’affaires et la créance, mais pas la trésorerie avant paiement. Un achat de stock transforme de la trésorerie en stock et ne devient coût qu’au moment de la vente. Un transfert caisse → M-Pesa ne modifie ni revenu ni dépense.

## 4. Utilisateurs et rôles

| Rôle | Droits |
| --- | --- |
| Propriétaire | tous les droits, gestion du foyer, membres, paramètres, clôtures et exports |
| Gestionnaire | saisie et modification des brouillons, validation selon configuration, rapports |
| Opérateur | création des ventes, encaissements et dépenses autorisées |
| Lecteur | consultation des tableaux de bord et rapports uniquement |

Chaque donnée appartient à un foyer. Les politiques RLS doivent empêcher tout accès à un autre foyer, y compris par manipulation d’URL ou appel direct de l’API.

## 5. Fonctionnalités

### 5.1 Démarrage

- création du foyer, devise de base et nom d’affichage ;
- choix des activités actives ;
- création assistée des comptes initiaux ;
- saisie des soldes et stocks de départ via écritures d’ouverture ;
- invitation facultative des membres ;
- jeu de démonstration disponible uniquement en environnement de développement.

### 5.2 Tableau de bord

- période : aujourd’hui, semaine, mois, trimestre, année et intervalle personnalisé ;
- chiffre d’affaires, bénéfice brut, bénéfice net, dépenses familiales et épargne ;
- trésorerie totale et solde de chaque compte ;
- comparaison avec la période précédente ;
- résultat et marge par activité ;
- dépenses par catégorie ;
- progression des objectifs d’épargne ;
- alertes : stock bas, créances échues, abonnements IPTV proches de l’expiration, budget dépassé ;
- dernières opérations.

### 5.3 Saisie rapide

Un bouton central « Ajouter » propose :

- Vente ;
- Autre entrée ;
- Dépense ;
- Achat de stock ;
- Transfert ;
- Apport familial ;
- Retrait familial ;
- Contribution d’épargne ;
- Ajustement autorisé.

Chaque formulaire prend en charge brouillon, validation, annulation, pièce jointe, note, date, activité, compte, devise et taux de change. Les champs conditionnels apparaissent selon le type d’opération.

### 5.4 Ventes

- numéro unique lisible ;
- activité, client facultatif, date, devise, statut et compte d’encaissement ;
- une ou plusieurs lignes ;
- quantité, prix, remise, taxe facultative, coût et marge ;
- paiement total, partiel, à crédit ou mixte ;
- reçus imprimables et partageables ;
- annulation avec motif ;
- pour IPTV : formule, identifiant client, activation, expiration, statut et rappel ;
- pour le billard : nombre de parties ou durée et tarif appliqué.

### 5.5 Dépenses et achats

- catégories séparant exploitation et famille ;
- fournisseur, compte payé, activité facultative, justificatif et note ;
- dépense récurrente configurable ;
- achat de stock augmentant la quantité et la valeur d’inventaire ;
- frais annexes répartissables dans le coût d’acquisition ;
- alertes sur doublons probables.

### 5.6 Trésorerie

- types de compte : caisse, banque, M-Pesa, Airtel Money, autre mobile money, épargne ;
- solde courant et historique ;
- transfert équilibré entre comptes, avec frais facultatifs ;
- rapprochement manuel ;
- aucune modification directe de solde après l’ouverture.

### 5.7 Stock

- produits, variantes, SKU, prix conseillé, seuil d’alerte et état ;
- entrées par achats, sorties par ventes, retours et ajustements contrôlés ;
- coût moyen pondéré ;
- inventaire physique et rapport d’écart ;
- valeur du stock et historique des mouvements ;
- interdiction du stock négatif par défaut, option explicite réservée au propriétaire.

### 5.8 Épargne et budgets

- objectifs avec montant cible, devise, date cible facultative et priorité ;
- contributions depuis un compte source vers un compte d’épargne ;
- retrait d’épargne avec motif et traçabilité ;
- budget mensuel global, par activité ou catégorie ;
- seuils d’alerte à 80 % et 100 % ;
- taux d’épargne = contributions nettes / revenus encaissés, avec définition visible.

### 5.9 Rapports

- synthèse mensuelle ;
- résultat par activité ;
- revenus et marges par produit ou service ;
- dépenses par catégorie ;
- flux de trésorerie ;
- soldes des comptes ;
- stock et valorisation ;
- créances clients ;
- échéances IPTV ;
- progression de l’épargne ;
- exports CSV ; PDF pour les synthèses et reçus.

### 5.10 Paramètres et audit

- foyer, logo facultatif, locale, fuseau et devise de base ;
- activités, catégories, produits, comptes et taux de change ;
- rôles et invitations ;
- journal d’audit consultable par propriétaire ;
- export complet des données ;
- procédure de fermeture du compte avec confirmation renforcée.

## 6. Navigation

Navigation mobile principale :

1. Accueil
2. Opérations
3. Activités
4. Rapports
5. Plus

Le bouton « Ajouter » reste accessible depuis Accueil et Opérations. Sur bureau, la même structure devient une barre latérale.

## 7. Design

- direction : premium, claire, humaine et rassurante ;
- palette recommandée : bleu nuit, bleu électrique mesuré, vert pour les résultats positifs, ambre pour les alertes, rouge uniquement pour danger et annulation ;
- cartes aérées, chiffres tabulaires, graphiques lisibles, icônes cohérentes ;
- aucune surcharge de dégradés, de glassmorphism ou d’animations ;
- états vides pédagogiques avec action immédiate ;
- graphiques accompagnés de valeurs textuelles accessibles.

## 8. Exigences non fonctionnelles

- mobile-first dès 360 px ;
- PWA installable ;
- LCP cible inférieur à 2,5 s sur connexion moyenne ;
- formulaires résistants à la double soumission ;
- pagination et filtres côté serveur pour les historiques ;
- sécurité OWASP, CSP et en-têtes adaptés ;
- RLS sur toutes les tables de données métier ;
- audit des actions sensibles ;
- sauvegarde et restauration documentées ;
- aucune donnée financière sensible dans les logs ;
- conformité d’accessibilité WCAG 2.2 AA pour les parcours essentiels.

## 9. Critères d’acceptation du MVP

Le MVP est accepté lorsque :

1. un utilisateur crée un foyer et termine l’assistant initial ;
2. il enregistre une vente IPTV encaissée et voit trésorerie et résultat mis à jour ;
3. il achète puis vend un Android TV Box, et le stock ainsi que le coût des ventes sont exacts ;
4. il enregistre une dépense familiale, visible en trésorerie mais séparée du résultat d’activité ;
5. il transfère de la caisse vers M-Pesa sans modifier revenu ou dépense ;
6. il contribue à un objectif d’épargne sans créer une fausse dépense ;
7. il saisit une opération en CDF avec une base USD et retrouve le montant source, le taux et la conversion ;
8. il filtre le tableau de bord par activité et période ;
9. un membre Lecteur ne peut rien modifier ;
10. un utilisateur ne peut accéder aux données d’un autre foyer ;
11. les écritures validées restent équilibrées et sont annulables sans suppression ;
12. les tests financiers, RLS et E2E critiques réussissent.

## 10. Hors périmètre initial

- intégration automatique aux API M-Pesa ou bancaires ;
- comptabilité fiscale officielle et déclarations ;
- paie complète ;
- marketplace ou e-commerce public ;
- application mobile native distincte ;
- intelligence artificielle et prévisions avancées.

Ces éléments peuvent être ajoutés après stabilisation, sans compromettre le modèle de données initial.

