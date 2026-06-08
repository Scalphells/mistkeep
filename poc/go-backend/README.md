# Mistkeep — Go backend PoC

A proof of concept for the "single Go binary" backend that could replace Supabase
for self-hosting (see the architecture notes in the project).

Persists to **SQLite** (pure Go, no CGO), hashes passwords with **bcrypt**, pushes
realtime over **WebSocket**, **embeds its UI**, and serves a **generic resource
API** matching the front-end `goAdapter` contract.

## Run

Requires Go 1.22+.

```
cd poc/go-backend
go mod tidy   # first time: fetches modernc.org/sqlite, x/crypto, coder/websocket
go run .
```

Open http://localhost:8787. The **first account becomes the DM**. Data lives in
`./data/mistkeep.db` (delete it to reset).

### Build a single binary

```
go build -o mistkeep-poc .
```

The UI is embedded (`go:embed`), so the binary runs on its own.

## API

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` (cookie session, bcrypt) |
| Data (generic) | `GET/POST/PATCH/DELETE /api/{table}` — see `api.go` for the table whitelist and per-table rules |
| Realtime | WebSocket `GET /realtime`: emits `{table,eventType,new}` on writes; relays ephemeral events |

The data layer (`api.go`) is table-driven: a registry lists each table's columns,
primary key, JSON columns, and authorization rule (`dm` / `owner` / `auth`). Only
whitelisted tables/columns reach SQL; values use placeholders. This matches the
`goAdapter` so the real front end can run against it with `VITE_BACKEND=go`.

## Status vs production

| Done | Still a shortcut / to do |
|---|---|
| SQLite persistence, bcrypt, DB sessions | column lists in `api.go` must be reconciled with the real migrations |
| WebSocket realtime | origin checks skipped (`InsecureSkipVerify`) |
| UI embedded → single binary | file storage (`/storage`) not implemented yet (G5) |
| generic `/api/{table}` + per-table authz | needs an end-to-end run against the real front end to shake out bugs |

> This Go server was written without a local compiler in the loop. Run
> `go mod tidy && go run .` and report build/run errors — that is the validation
> step for the generic engine.
