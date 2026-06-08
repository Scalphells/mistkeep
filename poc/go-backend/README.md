# Mistkeep — Go backend PoC

A proof of concept for the "single Go binary" backend that could replace Supabase
for self-hosting (see the architecture notes in the project).

Now persists to **SQLite** (pure Go, no CGO) with **bcrypt** password hashing.

## Run

Requires Go 1.22+.

```
cd poc/go-backend
go mod tidy   # first time: fetches modernc.org/sqlite and golang.org/x/crypto
go run .
```

Open http://localhost:8787 and use the demo page. The **first account created
becomes the DM**; open a second browser profile to sign up a player and watch
authorization and live updates. Data lives in `./data/mistkeep.db` (delete it to
reset).

## What it demonstrates

| Supabase piece | Here |
|---|---|
| Auth (GoTrue) | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` (cookie session, bcrypt) |
| REST (`.from()`) | `GET/POST/PATCH/DELETE /api/characters` backed by SQLite |
| Row-level security | `canWriteCharacter()` — DM may write any sheet; a player only their own |
| Realtime | a hub that pushes data changes and relays ephemeral events |

Try it: as a player, create a character, then `PATCH` a character owned by
someone else → `403`. As the DM → allowed. Connect the live feed in two windows
and create/update a character → both see the event. Restart the server → the data
is still there.

## Status vs production

| Done | Still a shortcut |
|---|---|
| SQLite persistence (`modernc.org/sqlite`) | one resource (`characters`); production needs all tables |
| bcrypt password hashing | Server-Sent Events → WebSocket for two-way realtime |
| cookie sessions in the database | front end served from disk → embed with `embed.FS` (true single binary) |

## How it fits

In the real design, the front end calls a small data-access abstraction
(`backend.db / .realtime / .auth / .storage`, already in `src/lib/backend.js`).
A `goAdapter` will translate those calls into requests against endpoints like
these, while a `supabaseAdapter` keeps the hosted edition working — one front
end, two backends.
