# Mistkeep — Go backend PoC

A proof of concept for the "single Go binary" backend that could replace Supabase
for self-hosting (see the architecture notes in the project).

Persists to **SQLite** (pure Go, no CGO), hashes passwords with **bcrypt**, pushes
realtime over **WebSocket**, and **embeds its UI** in the binary.

## Run

Requires Go 1.22+.

```
cd poc/go-backend
go mod tidy   # first time: fetches modernc.org/sqlite, x/crypto, coder/websocket
go run .
```

Open http://localhost:8787. The **first account created becomes the DM**; open a
second browser profile to sign up a player. Data lives in `./data/mistkeep.db`
(delete it to reset).

### Build a single binary

```
go build -o mistkeep-poc .
```

The UI is embedded (`go:embed`), so the resulting binary runs on its own — no
`static/` folder needed. That is the "single file you double-click" target.

## What it demonstrates

| Supabase piece | Here |
|---|---|
| Auth (GoTrue) | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` (cookie session, bcrypt) |
| REST (`.from()`) | `GET/POST/PATCH/DELETE /api/characters` backed by SQLite |
| Row-level security | `canWriteCharacter()` — DM may write any sheet; a player only their own |
| Realtime | a hub over **WebSocket** (`GET /realtime`): pushes data changes, relays ephemeral events |

Try it: as a player, `PATCH` a character owned by someone else → `403`. As the DM
→ allowed. Connect the live feed in two windows and create/update a character →
both see the event. Restart the server → the data is still there.

## Status vs production

| Done | Still a shortcut |
|---|---|
| SQLite persistence | one resource (`characters`); production needs all tables |
| bcrypt + DB sessions | no file storage yet (`/storage`) |
| WebSocket realtime | origin checks skipped (`InsecureSkipVerify`) — validate in production |
| UI embedded → single binary | not yet wired to the real front end (needs the `goAdapter`) |

## How it fits

The front end already calls a data-access seam (`backend.db / .realtime / .auth /
.storage`, in `src/lib/backend.js`). A `goAdapter` will translate those calls into
requests against endpoints like these, while a `supabaseAdapter` keeps the hosted
edition working — one front end, two backends.
