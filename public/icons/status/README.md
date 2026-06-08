# Logos custom des états (status)

Dépose ici un fichier **`<slug>.svg`** par état pour remplacer son emoji partout
(tracker de combat, jetons de la carte, dock, aperçu du groupe). Repli automatique
sur l'emoji si le fichier n'est pas listé.

## Procédure
1. Place le fichier, ex. `public/icons/status/poisoned.svg`.
2. Ouvre `src/lib/conditions.js` et ajoute le slug dans `CUSTOM_STATUS_ICONS`,
   ex. `new Set(['poisoned'])`.
3. (PNG possible : adapte l'extension dans `statusIconHtml`.)

## Slugs attendus (fichier = `<slug>.svg`)

| État | slug (nom de fichier) |
|---|---|
| Aveuglé | `blinded` |
| Charmé | `charmed` |
| Assourdi | `deafened` |
| Effrayé | `frightened` |
| Agrippé | `grappled` |
| Entravé | `restrained` |
| Empoisonné | `poisoned` |
| À terre | `prone` |
| Neutralisé | `incapacitated` |
| Étourdi | `stunned` |
| Paralysé | `paralyzed` |
| Pétrifié | `petrified` |
| Inconscient | `unconscious` |
| Invisible | `invisible` |
| Épuisement | `exhaustion` |
| Concentration | `concentration` |

> Format conseillé : SVG carré, lisible en très petit (≈14 px), monochrome ou
> contrasté. Assure-toi d'avoir les droits sur les images que tu déposes.
