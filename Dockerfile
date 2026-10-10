# syntax=docker/dockerfile:1
# Keep the Linux runtime aligned with the validated local Node.js version.
FROM node:24.15.0-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --include=dev \
    && npm run db:generate

FROM deps AS build
COPY . .
ENV NODE_ENV=production
# No DATABASE_URL or AUTH_SECRET build arguments: runtime secrets stay outside
# the image and a build never connects to or migrates the production database.
RUN npm run build

# Keep the locked Prisma CLI and its transitive dependencies for the separate
# pre-deploy migration command, without copying the development toolchain.
FROM deps AS migration-deps
RUN node -e 'const fs = require("node:fs"); const p = require("./package.json"); fs.writeFileSync("package.json", JSON.stringify({ name: "cet-six-daily-migration-tools", private: true, dependencies: { prisma: p.dependencies.prisma || p.devDependencies.prisma } }));' \
    && npm prune --omit=dev --ignore-scripts \
    && test -x node_modules/.bin/prisma \
    && node -e 'require.resolve("@prisma/engines");' \
    && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=migration-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/standalone ./
# Copy the complete generated Linux client instead of relying on native-engine
# file tracing alone. Host Windows node_modules are excluded from the context.
COPY --from=deps --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/start-production.mjs /app/scripts/deploy-check.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e 'require("node:http").get({ hostname: "127.0.0.1", port: process.env.PORT || 3000, path: "/api/health", timeout: 4000 }, r => { r.resume(); process.exit(r.statusCode === 200 ? 0 : 1); }).on("timeout", () => process.exit(1)).on("error", () => process.exit(1));'
# Startup validates configuration only. Run npm run db:migrate separately.
CMD ["node", "scripts/start-production.mjs", "--standalone"]
