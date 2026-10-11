# syntax=docker/dockerfile:1
# Production image for Souvenir Galore. See docs/DEPLOYMENT.md (Docker section).

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies ─────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# Commit package-lock.json so builds are reproducible (npm ci).
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ── Build ────────────────────────────────────────────────────
FROM deps AS build
# NEXT_PUBLIC_* values are compiled into the site at build time.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
ARG NEXT_PUBLIC_PLAUSIBLE_SRC=""
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN \
    NEXT_PUBLIC_PLAUSIBLE_SRC=$NEXT_PUBLIC_PLAUSIBLE_SRC \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────
# Dev dependencies (prisma CLI, tsx) are kept so migrations and the admin
# scripts can run inside the container: docker compose exec app npm run admin:create
FROM base AS run
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending database migrations, then start the server.
CMD ["sh", "-c", "node scripts/migrate-deploy.mjs && exec npx next start -H 0.0.0.0 -p ${PORT}"]
