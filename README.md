# Mistkeep

A self-hostable virtual tabletop (VTT) for the GM and players, running multiple
game systems (D&D 5e 2014/2024, Pathfinder 2e, and a Free/Custom system):
multi-system character sheets, initiative tracking, a map-first tactical layout
with tokens and dynamic vision, chat, a card-based combat log, and a compendium.

📖 **Documentation: [mistkeep.mintlify.app](https://mistkeep.mintlify.app)** — install, quick start, DM & player guides.

Static front end (Vite, plain JavaScript, no framework) on top of Supabase
(auth, PostgreSQL, realtime, file storage). You run your own instance and keep
your own data.

This repository contains tools and open SRD content only. It ships no
proprietary text, rules, art, or adventure data. Bring your own material.

## Features

- Multi-system: the character sheet, rolls, saving throws and budgets are driven
  by a system descriptor chosen per campaign — D&D 5e (2014, SRD 5.1), D&D 5e
  (2024, SRD 5.2), Pathfinder 2e (Remaster), or a Free/Custom system with
  GM-configurable abilities, skills and test die (e.g. 1d100, 2d6).
- Multi-campaign: a campaign manager, self-service join via invite codes, full
  export/import of a campaign as a single JSON file, per-campaign GM
  authorization and campaign-scoped storage. Each campaign selects its own
  game system.
- Map-first VTT layout: three dispositions (Classic top bar, Left rail, Right
  rail — the default), where rail mode opens directly on the map with other
  views as floating windows. Map tools form a vertical rail of category icons
  along the map edge (sub-tools in a small floating panel, one category at a
  time), with floating scene tabs at the top-centre, a browser-fullscreen
  button, a separate "hide interface" button (hides the header while keeping the
  dock), a display-density setting and optional translucent windows.
- Map: tokens (disposition, auras, elevation, quick elevation control on the
  token HUD), dynamic vision (walls, doors, lights, three-level fog, darkvision),
  spell templates, drawing, multiple scenes with atmosphere, token HUD, and
  reordering scenes by drag-and-drop. Cell distance in feet or metres (default
  5 ft / 1.5 m) with per-cell distance shown while moving and a movement-speed
  budget (the path turns red past the token's speed).
- Hidden enemy HP: a per-token flag so players see only a qualitative estimate
  (Healthy / Hurt / Bloodied) while the GM keeps the exact value with a marker —
  both on the map and in the initiative list.
- Combat: initiative (including group rolls), HP, and system-aware conditions and
  timed effects (the full Pathfinder 2e set, valued conditions such as Frightened
  1 or Slowed 2 with steppers, rule tooltips), death saving throws, area saving
  throws, and a card-based combat log.
- Characters: multi-system sheets (a section engine driven by the system
  descriptor), SRD import, an optional decorative per-system skin (themed banner
  and frame) and an optional translucent sheet.
- Shared: chat (public/private, roll modes), handouts, compendium (SRD import),
  party loot, quest log, dice (with a quick-roll R key), and scene ambience /
  soundscape.
- Languages: the UI is fully available in French and English (switchable in
  preferences), with SRD content provided per language.

## Requirements

- Node.js >= 20.19
- A Supabase project (the free tier is enough).

## Self-hosting

Two options:

- **Single binary** (no cloud, no database to install): a self-contained Go
  server that embeds the UI and stores data in SQLite — one file to run. See
  [poc/go-backend/README.md](poc/go-backend/README.md).
- **Hosted Supabase** (front end deployed to any static host, data on a Supabase
  project): follow the steps below.

1. Create a Supabase project. From Project Settings > API, note the project URL
   and the public `anon` key.
2. In the Supabase SQL editor, run the files in `supabase/migrations/` in order
   (`0001_*`, then `0002_*`, and so on).
3. Configure and run:

   ```
   git clone <repo>
   cd mistkeep
   npm install
   cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

4. Create your account, then grant yourself the DM role once in the SQL editor:

   ```sql
   update public.profiles set role = 'dm' where email = 'you@example.com';
   ```

5. Build with `npm run build` and deploy `dist/` to any static host (Cloudflare
   Pages, Netlify, Vercel, GitHub Pages), setting `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.

## Development

```
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run build   # production build
```

State lives in a small central store (`src/state.js`). Each feature exposes a
`mount(container)` function under `src/features/`. Pure, testable logic lives in
`src/lib/`.

## Security

- The DM/player role is stored in the database (`profiles.role`) and enforced by
  row-level security. The client never decides permissions.
- Sensitive writes are DM-only via RLS. Storage (maps, handouts) is private and
  served through signed URLs.

## Content and rights

The application is an engine. Campaign content (NPCs, locations, published-module
text, art) is not included. Only use material you have the rights to. The bundled
SRD content (D&D 5e SRD 5.1 and 5.2, Pathfinder 2e Remaster) is available under
open licences.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[GNU AGPL-3.0-or-later](LICENSE).
