# Most container hosts have no native Bun runtime, so ship one.
FROM oven/bun:1.4-alpine AS base
WORKDIR /app

# Dependencies as their own layer: an unchanged lockfile means a cached rebuild.
#   --production   skips devDependencies (types, only needed for tsc)
#   --omit=optional skips @huggingface/transformers (~100MB), which is only used
#                   by EMBEDDING_PROVIDER=local and is dynamically imported
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --omit=optional

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS release
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# After COPY . . — public/ is gitignored and dockerignored, so it only exists
# as build output and must be copied in last.
COPY --from=build /app/public ./public

# Drop root; the app never writes to its own filesystem.
USER bun

EXPOSE 3000
CMD ["bun", "index.ts"]
