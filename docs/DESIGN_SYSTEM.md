# Kayembe Signature — système visuel

## Intention

La proposition C associe la clarté éditoriale d’une maison patrimoniale à
l’efficacité d’un outil de pilotage quotidien. L’interface doit paraître
exclusive sans devenir décorative : chaque contraste guide une action ou une
lecture financière.

## Palette

| Rôle             | Couleur   | Usage                             |
| ---------------- | --------- | --------------------------------- |
| Fond principal   | `#F7F3E8` | Pages et zones respirantes        |
| Surface          | `#FFFDF7` | Cartes, formulaires et tableaux   |
| Ivoire chaud     | `#EEE8DA` | Surfaces secondaires              |
| Olive clair      | `#B8C19F` | Héros, sélections et repères      |
| Sauge            | `#DDE1CB` | États neutres et icônes           |
| Olive profond    | `#263120` | Texte fort, navigation et boutons |
| Olive secondaire | `#667154` | Texte secondaire et graphiques    |
| Laiton vieilli   | `#A48145` | Accent éditorial et état actif    |
| Positif          | `#557A45` | Succès uniquement                 |
| Alerte           | `#805317` | Attention et stock bas            |
| Danger           | `#A24E3F` | Annulation et erreur uniquement   |

Tous les couples texte/fond utilisés dans les parcours essentiels doivent
atteindre WCAG 2.2 AA.

## Typographie

- Les titres de héros, résultats majeurs et chiffres de synthèse utilisent une
  pile serif éditoriale (`Georgia`, `Times New Roman`, serif).
- Les contrôles, libellés, textes et montants opérationnels utilisent la pile
  système sans-serif.
- Les montants utilisent des chiffres tabulaires et ne sont jamais abrégés de
  manière ambiguë.

## Composants

- Les cartes ont des rayons modérés, une bordure olive très légère et une ombre
  chaude discrète.
- Le bouton principal est olive profond ; le bouton secondaire reste ivoire.
- La navigation principale conserve cinq entrées et devient une barre olive
  profonde sur mobile comme sur bureau.
- Les surfaces olive clair sont réservées aux zones de contexte ou de décision,
  pas à chaque carte.
- Les états vide, chargement, succès et erreur gardent toujours un texte et une
  prochaine action explicites.

## Mouvement

Les animations sont courtes, non bloquantes et limitées à l’entrée des contenus
ou au retour immédiat d’une interaction. Elles sont supprimées avec
`prefers-reduced-motion: reduce`.

## Photographie

La page de connexion affiche le portrait fourni par la famille dans un héros
responsive : bandeau éditorial sur mobile et composition pleine hauteur sur
bureau. Le cadrage préserve les deux visages, aucun filtre ne les altère et un
voile olive sert uniquement à maintenir la lisibilité des textes. Une
alternative textuelle décrit simplement le couple, sans exposer d’information
personnelle inutile.
