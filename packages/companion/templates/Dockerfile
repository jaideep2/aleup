# Template Dockerfile for a service that runs @aleup/companion.
# Adapt paths/package-manager to your repo; this assumes a pnpm workspace where
# apps/companion/src/index.ts calls startStandaloneCompanion() with your env names.
#
# If you consume @aleup/* from a private registry, pass the read token as a build arg:
#   ARG NPM_TOKEN
# and provide an .npmrc mapping the @aleup scope (see the aleup docs, "Private registry").

FROM node:22-slim AS base
RUN corepack enable

FROM base AS installer
WORKDIR /app
ARG NPM_TOKEN
ENV NPM_TOKEN=$NPM_TOKEN
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod
ENV NPM_TOKEN=""

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
# tsx keeps the entry a plain .ts file; @aleup/companion itself arrives precompiled.
CMD ["node", "--import", "tsx", "src/index.ts"]
