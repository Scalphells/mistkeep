# Mistkeep

A self-hostable virtual tabletop (VTT) for running D&D 5e (SRD 5.1) games online:
character sheets, initiative tracking, a tactical map with tokens and dynamic
vision, chat, a card-based combat log, and a compendium.

Static front end (Vite, plain JavaScript, no framework) on top of Supabase
(auth, PostgreSQL, realtime, file storage). You run your own instance and keep
your own data.

This repository contains tools and open content (SRD 5.1) only. It ships no
proprietary text, rules, art, or adventure data. Bring your own material.

> Note: the application interface is currently in French. Internationalisation
> is not done yet.

## Features

- Characters: ability scores, rolls, skills, spells and slots, class resources,
  inventory and currency, short/long rest, hit dice.
- Combat: initiative (including group rolls), HP, conditions and timed effects,
  death saving throws, area saving throws, card-based combat log.
- Map: tokens (disposition, auras, elevation), dynamic vision (walls, doors,
  lights, three-level fog, darkvision), spell templates, drawing, multiple
  scenes, scene atmosphere, token HUD.
- Shared: chat (public/private, roll modes), handouts, compendium (SRD import
  via dnd5eapi.co), party loot, quest log.
- Optional VTT layout with a central map and floating windows.

## Requirements

- Node.js >= 20.19
- A Supabase project (the free tier is enough).

## Self-hosting

Two options:

- **All-in-one Docker** (front end + full Supabase stack + database on one
  machine, no cloud account): see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).
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
text, art) is not included. Only use material you have the rights to. SRD 5.1 is
available under an open licence.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[GNU AGPL-3.0-or-later](LICENSE).
