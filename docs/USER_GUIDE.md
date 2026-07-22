# Guide utilisateur

1. Se connecter avec Supabase Auth.
2. Si aucun foyer n'existe, ouvrir l'onboarding et créer le foyer : l'application initialise IPTV, Mini UPS, Android TV Box, Billard inactif, catégories, devises, comptes et emplacement de stock.
3. Depuis l'accueil, consulter les KPI calculés depuis le grand livre : chiffre d'affaires, bénéfice brut, bénéfice net, dépenses familiales, épargne et trésorerie.
4. Utiliser « Ajouter rapidement » pour démarrer vente, entrée, dépense, achat, transfert, apport, retrait ou épargne.
5. Consulter le stock, les opérations, les rapports et les paramètres depuis la navigation principale mobile à cinq entrées. Les activités restent accessibles dans **Plus**.

## Activités

Dans **Activités**, le propriétaire ou le gestionnaire peut renommer une
activité et changer son état. La table de billard est créée inactive : choisissez
**Active**, puis **Enregistrer** au moment du lancement, sans migration technique.

## Stock au quotidien

Dans **Stock**, consultez les quantités, la valeur comptable au coût moyen, les
ruptures et les seuils d’alerte. Utilisez **Approvisionner** pour un nouvel achat
payé par la trésorerie, **Stock initial** uniquement pour les articles possédés
avant l’application, et **Vendre** pour enregistrer une sortie réelle.

Le propriétaire ou le gestionnaire peut définir le SKU, le prix conseillé et le
seuil d’alerte de chaque produit. Tous les rôles opérationnels peuvent réaliser
un **Comptage physique**. Le comptage produit un rapport d’écart mais ne modifie
jamais silencieusement le stock comptable ni le résultat ; toute correction doit
rester une opération explicite et auditée.

## Clients IPTV

1. Ouvrir **Activités**, puis **Gérer les clients et échéances** sur la carte IPTV.
2. Utiliser **Activer un nouveau client** pour saisir le nom, le téléphone facultatif, l’identifiant IPTV, la formule et la date d’activation.
3. Choisir **Payé maintenant** pour encaisser sur un compte dans la devise de la formule, ou **À crédit** pour créer une créance avec échéance.
4. Le prix et la durée viennent de la formule. La vente, l’écriture comptable, le client et la période d’abonnement sont validés ensemble.
5. Les abonnements proches de l’échéance ou expirés apparaissent dans **À surveiller** sur l’accueil et dans les filtres du module IPTV.
6. Utiliser **Renouveler** sur la fiche client : une nouvelle période est ajoutée après la précédente sans réécrire l’historique.
7. Le propriétaire ou le gestionnaire peut créer, désactiver et réactiver les formules. Un opérateur peut activer et renouveler, tandis qu’un lecteur consulte seulement.
8. L’annulation de la vente depuis **Opérations** crée l’écriture inverse et annule uniquement la période IPTV liée.

## Épargne

Créez d’abord un objectif dans **Plus > Objectifs d’épargne**. Enregistrez ensuite
la contribution dans **Opérations** en choisissant le compte source, le compte
Épargne et l’objectif. Ce transfert ne devient ni un revenu ni une dépense.

## Corriger une opération validée

Un propriétaire ou gestionnaire ouvre **Opérations**, saisit le motif sous
l’écriture concernée et choisit **Annuler l’écriture**. L’application conserve
l’original, crée l’écriture inverse et inscrit le motif dans l’audit.
