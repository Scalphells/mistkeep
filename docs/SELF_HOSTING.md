# Self-hosting Mistkeep with Docker

This runs the whole stack on one machine: the front end, the full Supabase API
(auth, REST, realtime, storage), and PostgreSQL. No cloud account needed.

> The front end talks to the **Supabase API**, not to PostgreSQL directly. A bare
> Postgres container is not enough — that is why this compose includes auth,
> rest, realtime, storage and a Kong gateway.

## 1. Requirements

- Docker and Docker Compose v2.

## 2. Generate secrets and .env

Run the helper (needs `openssl`):

```
./scripts/gen-keys.sh --write
```

This creates `.env` with strong random values for `POSTGRES_PASSWORD`,
`JWT_SECRET`, `SECRET_KEY_BASE`, and the signed JWT `ANON_KEY` /
`SERVICE_ROLE_KEY`. It refuses to overwrite an existing `.env`. Run it without
`--write` to only print the values, or copy `.env.docker.example` and fill them
in by hand.

The output contains secrets. Keep it private.

## 3. Set the URLs

Edit `.env` and keep `API_EXTERNAL_URL` reachable **from the browser**:
`http://localhost:8000` for local play, or `http://<host-ip>:8000` so other
players on your LAN can connect. `SITE_URL` is the front end.

> `ANON_KEY` and `API_EXTERNAL_URL` are baked into the front-end bundle at build
> time (Vite). If you change them later, rebuild: `docker compose build frontend`.

## 4. Start

```
docker compose up --build
```

This builds the front end, starts the database, applies the migrations, and
brings up the Supabase services.

- Front end: http://localhost:3000
- Supabase Studio (admin): http://localhost:3001
- Supabase API gateway: http://localhost:8000

## 5. Create the DM account

1. Open the front end, create your account (sign up). Email confirmation is
   auto-confirmed (no SMTP needed).
2. Grant yourself the DM role once, in Studio's SQL editor (http://localhost:3001)
   or any psql client:

   ```sql
   update public.profiles set role = 'dm' where email = 'you@example.com';
   ```

Players just open the same URL and sign up.

## Troubleshooting

- **"Failed to fetch" on sign up**: the front end cannot reach the Supabase API.
  Check that `kong` is up (`docker compose ps`) and that `API_EXTERNAL_URL` in
  `.env` is reachable from the browser, then rebuild the front end.
- **A service keeps restarting**: image tags in `docker-compose.yml` mirror a
  recent Supabase release; if one fails, bump it to match the versions in
  Supabase's current self-hosting compose. `realtime` is the most version-sensitive.
- **Reset everything**: `docker compose down -v` removes the database and storage
  volumes (you lose all data).

## Security

- Use generated secrets (`scripts/gen-keys.sh`); never ship the example
  placeholders. `.env` is gitignored — keep it private and out of any shared backup.
- Only the front end (`3000`) and the API gateway (`8000`) are meant to be
  reachable by players. The database is not published to the host, and Studio is
  bound to `127.0.0.1:3001` — do not expose it on the LAN or the internet.
- Open sign-up is on by default so players can register. Once everyone has an
  account, set `GOTRUE_DISABLE_SIGNUP: "true"` on the `auth` service and run
  `docker compose up -d auth` to stop new registrations — important if the
  instance is reachable from the internet.
- For internet play, put the stack behind a reverse proxy with TLS (HTTPS) and a
  real domain; never expose plain HTTP. A private tunnel (Tailscale, Cloudflare
  Tunnel) is a safer alternative to opening ports.
- In-app access control is enforced by PostgreSQL row-level security (DM-only
  writes; players limited to their own data). Do not disable RLS.
- Keep images updated and review the pinned versions periodically.

## Notes

- This is a single-host setup intended for running your own table. For internet
  play, put it behind a reverse proxy / tunnel and use real domains and TLS.
- Image tags are pinned for reproducibility. Review them periodically.
