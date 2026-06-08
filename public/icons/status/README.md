# Custom status icons

Drop a `<slug>.svg` file here to replace a condition's emoji everywhere it shows
(combat tracker, map tokens, dock, party overview). The emoji is used as a
fallback whenever a file is not present.

## How to enable

1. Add the file, e.g. `public/icons/status/poisoned.svg`.
2. Open `src/lib/conditions.js` and add the slug to `CUSTOM_STATUS_ICONS`,
   e.g. `new Set(['poisoned'])`.
3. (PNG is possible: adjust the extension in `statusIconHtml`.)

## Expected slugs (file = `<slug>.svg`)

| Condition (FR label in UI) | slug (file name) |
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

Recommended format: square SVG, legible at ~14 px, monochrome or high-contrast.
Make sure you have the rights to any image you add.
