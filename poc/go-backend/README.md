# Mistkeep — Go backend PoC

A minimal proof of concept for the "single Go binary" backend that could replace
Supabase for self-hosting (see the architecture discussion in the project).

It uses the **Go standard library only** — no external modules — so it builds and
runs offline.

## Run

Requires Go 1.22+.

```
cd poc/go-backend
go run .
```

Open http://localhost:8787 and use the demo page. The **first account created
becomes the DM**; open a second browser profile to sign up a player and watch
authorization and live updates.

## What it demonstrates

| Supabase piece | Here |
|---|---|
| Auth (GoTrue) | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` (cookie session) |
| REST (`.from()`) | `GET/POST/PATCH/DELETE /api/characters` |
| Row-level security | `canWriteCharacter()` — DM may write any sheet; a player only their own |
| Realtime | a hub that pushes data changes and relays ephemeral events |

Try it: as a player, create a character, then try to `PATCH` a character owned by
someone else → `403`. As the DM → allowed. Connect the live feed in two windows
and create/update a character → both see the event.

## PoC shortcuts vs production

This intentionally cuts corners to stay dependency-free and short:

| PoC | Production |
|---|---|
| In-memory store | SQLite (`modernc.org/sqlite`, pure Go) or Postgres (`pgx`) |
| SHA-256 password hash | bcrypt or argon2id |
| Server-Sent Events | WebSocket (`nhooyr.io/websocket`) for two-way realtime |
| One resource (`characters`) | all tables, each with its authorization rules |
| Static files from disk | front end embedded with `embed.FS` (true single binary) |

## How it fits

In the real design, the front end calls a small data-access abstraction
(`backend.db / .realtime / .auth / .storage`). A `goAdapter` would translate
those calls into requests against endpoints like the ones above, while a
`supabaseAdapter` keeps the hosted edition working — one front end, two backends.
