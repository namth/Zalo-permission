# 1. Base image with pnpm (Debian Bookworm slim for ARM64 & AMD64 compatibility)
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.4

# 2. Dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/channels/package.json ./packages/channels/
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/
COPY apps/agent-worker/package.json ./apps/agent-worker/

RUN pnpm install --frozen-lockfile

# 3. Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client and build packages
RUN pnpm --filter @omniagent/database build
RUN pnpm --filter @omniagent/channels build
RUN pnpm --filter @omniagent/core build
RUN pnpm --filter @omniagent/agent-worker build
RUN pnpm --filter @omniagent/web build

# 4. Production Web Runner (Standalone Next.js)
FROM node:22-bookworm-slim AS runner-web
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7140
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 7140

CMD ["node", "apps/web/server.js"]

# 5. Production Worker Runner
FROM base AS runner-worker
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

CMD ["pnpm", "--filter", "@omniagent/agent-worker", "start"]
