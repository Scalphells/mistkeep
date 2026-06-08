# Self-hosting Mistkeep with Docker

This runs the whole stack on one machine: the front end, the full Supabase API
(auth, REST, realtime, storage), and PostgreSQL. No cloud account needed.

> The front end talks to the **Supabase API**, not to PostgreSQL directly. A bare
> Postgres container is not enough — that is why this compose includes auth,
> rest, realtime, storage and a Kong gateway.

## 1. Requirements

- Docker and Docker Compose v2.

## 2. Generate secrets

You need four secrets: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and
`SECRET_KEY_BASE`.

- `JWT_SECRET`: any random string of at least 40 characters.
- `ANON_KEY` and `SERVICE_ROLE_KEY`: JWTs **signed with that `JWT_SECRET`**, with
  payload `role: anon` and `role: service_role` respectively. The easiest way is
  the generator in Supabase's self-hosting guide
  (https://supabase.com/docs/guides/self-hosting/docker), or jwt.io with the
  HS256 algorithm and your `JWT_SECRET`.
- `SECRET_KEY_BASE`: any random string of at least 64 characters (realtime).

Random strings, for example:

```
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 48   # SECRET_KEY_BASE
```

## 3. Configure

```
cp .env.docker.example .env
```

Fill in `.env`. Keep `API_EXTERNAL_URL` reachable **from the browser**:
`http://localhost:8000` for local play, or `http://<host-ip>:8000` so other
players on your LAN can connect.

> The `ANON_KEY` and `API_EXTERNAL_URL` are baked into the front-end bundle at
> build time (Vite). If you change them later, rebuild: `docker compose build frontend`.

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

## Notes

- This is a single-host setup intended for running your own table. For internet
  play, put it behind a reverse proxy / tunnel and use real domains and TLS.
- Image tags are pinned for reproducibility. Review them periodically.
