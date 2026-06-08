#!/usr/bin/env bash
#
# Generate the secrets needed to self-host Mistkeep with Docker:
#   POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SECRET_KEY_BASE
# ANON_KEY and SERVICE_ROLE_KEY are JWTs (HS256) signed with JWT_SECRET.
#
# Requires: openssl.
#
# Usage:
#   scripts/gen-keys.sh            # print a ready-to-paste block
#   scripts/gen-keys.sh --write    # create .env from these secrets (refuses to overwrite)
#
# SECURITY:
#   - The output contains SECRETS. Never paste it into chats, issues, or commits.
#   - .env is gitignored; keep it private and out of backups you share.
#   - Run this locally; the values belong to your instance only.

set -euo pipefail

command -v openssl >/dev/null 2>&1 || { echo "error: openssl is required" >&2; exit 1; }

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

mk_jwt() {
  # $1 = role, $2 = secret
  local role="$1" secret="$2" now exp header payload h p sig
  now=$(date +%s)
  exp=$(( now + 60*60*24*365*10 ))   # ~10 years
  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"role\":\"${role}\",\"iss\":\"supabase\",\"iat\":${now},\"exp\":${exp}}"
  h=$(printf '%s' "$header"  | b64url)
  p=$(printf '%s' "$payload" | b64url)
  sig=$(printf '%s' "${h}.${p}" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)
  printf '%s.%s.%s' "$h" "$p" "$sig"
}

POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
SECRET_KEY_BASE=$(openssl rand -hex 32)
ANON_KEY=$(mk_jwt anon "$JWT_SECRET")
SERVICE_ROLE_KEY=$(mk_jwt service_role "$JWT_SECRET")

read -r -d '' SECRETS <<EOF || true
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
EOF

if [ "${1:-}" = "--write" ]; then
  if [ -e .env ]; then
    echo "Refusing to overwrite existing .env. Printing the secrets instead:" >&2
    echo
    printf '%s\n' "$SECRETS"
    exit 0
  fi
  {
    printf '%s\n' "$SECRETS"
    echo "API_EXTERNAL_URL=http://localhost:8000"
    echo "SITE_URL=http://localhost:3000"
  } > .env
  echo "Wrote .env. For LAN play, change API_EXTERNAL_URL to http://<host-ip>:8000 and rebuild the front end." >&2
else
  printf '%s\n' "$SECRETS"
fi
