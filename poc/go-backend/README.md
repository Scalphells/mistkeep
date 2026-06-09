# Mistkeep — self-hosted backend (single binary)

A self-contained server for Mistkeep: it **embeds the web UI**, stores
everything in **SQLite** (pure Go, no CGO), hashes passwords with **bcrypt**,
pushes realtime over **WebSocket**, and serves uploaded files from disk. One
binary, no external services, no database to install.

It implements the same data contract as the hosted (Supabase) edition, so the
exact same front end runs against it — built with `VITE_BACKEND=go`.

## Run it (no build)

Download the binary for your system and run it:

| System                         | File                         | How to run                          |
|--------------------------------|------------------------------|-------------------------------------|
| Windows                        | `mistkeep-windows-amd64.exe` | double-click                        |
| Linux (PC / server)            | `mistkeep-linux-amd64`       | `chmod +x …` then `./…`             |
| Linux ARM (Raspberry Pi 64-bit)| `mistkeep-linux-arm64`       | `chmod +x …` then `./…`             |
| macOS (Apple Silicon, M1–M4)   | `mistkeep-darwin-arm64`      | `chmod +x …`, then right-click → Open |
| macOS (Intel)                  | `mistkeep-darwin-amd64`      | `chmod +x …`, then right-click → Open |

```
chmod +x mistkeep-linux-amd64
./mistkeep-linux-amd64
```

Open <http://localhost:8787>. **The first account that signs up becomes the
DM**; everyone after is a player. Other players on the same network reach it at
`http://<host-lan-ip>:8787`.

> The binaries are **unsigned**, so the OS warns on first launch: Windows
> SmartScreen → *More info → Run anyway*; macOS Gatekeeper → right-click → *Open*
> (or `xattr -d com.apple.quarantine mistkeep-darwin-arm64`). Linux has no such
> prompt.

| Variable          | Default  | Purpose                                                                 |
|-------------------|----------|-------------------------------------------------------------------------|
| `PORT`            | `8787`   | Port to listen on.                                                      |
| `DATA_DIR`        | `./data` | Where the database and uploaded files are written.                      |
| `DISABLE_SIGNUP`  | unset    | `1` closes registration (the existing DM/players keep working). The very first account is always allowed, so you can bootstrap then lock it down. |
| `ALLOWED_ORIGINS` | unset    | Extra comma-separated host patterns allowed to open a WebSocket. Same-origin is always allowed; set this only if the front is served from a different host. |
| `SECURE_COOKIES`  | unset    | `1` forces the `Secure` flag on the session cookie. Auto-detected over HTTPS or behind a proxy sending `X-Forwarded-Proto: https`. |

```
PORT=9000 DATA_DIR=/srv/mistkeep ./mistkeep-linux-amd64
```

Back up the **data directory** (`mistkeep.db` + `storage/`) to back up a
campaign. Delete it to start fresh.

## Build from source

Needs [Go](https://go.dev/dl/) 1.22+ and Node (to build the front end once).

```
# Windows
./build.ps1

# Linux / macOS
./build.sh
```

This builds the front end (`VITE_BACKEND=go`), embeds it into `static/`, and
compiles `mistkeep` for the current machine.

### Cross-compile for everyone

```
./release.ps1        # Windows
./build.sh release   # Linux / macOS
```

Builds binaries for windows/linux/macOS (amd64 + arm64) into `release/`. Because
there's no CGO, cross-compilation needs only the Go toolchain — hand a friend
the binary for their OS and they just run it.

## How it works

| Area     | Endpoints |
|----------|-----------|
| Auth     | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` (bcrypt, cookie session) |
| Data     | `GET/POST/PATCH/DELETE /api/{table}` — generic engine, per-table authorization (see `api.go`) |
| Realtime | WebSocket `GET /realtime` — broadcasts row changes and relays ephemeral events |
| Storage  | `POST /storage/{bucket}`, `/sign`, `GET /storage/{bucket}/{path...}`, `DELETE` — private, on disk |
| UI       | everything else is served from the embedded front end |

The data layer (`api.go`) is table-driven: a registry lists each table's
columns, primary key, JSON columns, and write rule (`dm` / `owner` / `auth`).
Only whitelisted tables and columns reach SQL; values always go through
placeholders. The schema mirrors the SQL migrations in `supabase/migrations`.

## Security notes

- Sessions are random tokens in an HTTP-only, `SameSite=Lax` cookie that expires
  after 30 days (enforced server-side); passwords are bcrypt-hashed.
- WebSocket handshakes are origin-checked: same-origin only, unless you widen it
  with `ALLOWED_ORIGINS`.
- Responses carry `X-Content-Type-Options`, `X-Frame-Options: DENY` and
  `Referrer-Policy: no-referrer`; request bodies are size-bounded.
- Storage buckets are private — reads require a session, writes require the DM.
- For internet exposure: put a TLS-terminating reverse proxy (Caddy, nginx, …)
  in front for HTTPS, and consider `DISABLE_SIGNUP=1` once your players have
  registered. On a LAN it runs as-is.
