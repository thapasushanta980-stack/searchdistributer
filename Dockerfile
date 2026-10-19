# syntax=docker/dockerfile:1
# Search Distributor: one image serving the API, the SSR site and the /admin app.
# Build context is the repository root (Coolify: Build Pack = Dockerfile, Base Directory = /).

FROM node:22-bookworm-slim AS base
# openssl: required by the Prisma engines.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build: full install, generate the Prisma client, build client (browser + SSR) and server ----
FROM base AS build
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY shared shared
COPY server server
COPY client client
RUN npx prisma generate --schema server/prisma/schema.prisma \
 && npm run build \
 && npm prune --omit=dev

# ---- runtime: production dependencies + build output only ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared shared
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/client/package.json client/package.json
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/client/public client/public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# The pruned node_modules no longer holds the generated client, so generate it for this image's platform.
# CRLF guard: a Windows checkout can add \r to the script, which breaks the shebang.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh \
 && node_modules/.bin/prisma generate --schema server/prisma/schema.prisma

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
