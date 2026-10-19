#!/bin/sh
# Applies pending migrations and the idempotent category seed, then starts the server.
set -eu

# Set SKIP_MIGRATIONS=true to start without touching the schema (e.g. extra replicas).
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Applying database migrations..."
  node_modules/.bin/prisma migrate deploy --schema server/prisma/schema.prisma
  node server/dist/seed.js
fi

exec "$@"
