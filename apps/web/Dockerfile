# Dockerfile for apps/web (Next.js 16 + Prisma 6 + node-edge-tts + ffmpeg-static).
# Used by Zeabur (and any container host) when auto-detection of the pnpm
# monorepo isn't sufficient. Build context MUST be the REPO ROOT so the pnpm
# workspace lockfile + sibling packages resolve correctly:
#   docker build -f apps/web/Dockerfile .

# ---------- 1. Base + pnpm via corepack ----------
FROM node:22-bookworm-slim AS base

# corepack ships with node 22; enable + pin pnpm to match packageManager in root package.json
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /repo

# ---------- 2. Install deps (cached layer) ----------
FROM base AS deps

# Copy only the manifests for maximum layer cache hit
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY services/ai/pyproject.toml services/ai/

# Install ALL workspace deps. Build scripts are explicitly enabled for native
# bins (ffmpeg-static, sharp, prisma) via the root package.json
# pnpm.onlyBuiltDependencies allowlist.
RUN pnpm install --frozen-lockfile

# ---------- 3. Build apps/web ----------
FROM base AS build

COPY --from=deps /repo /repo
COPY . .

# Generate Prisma client (deterministic; no DB connection needed at build time)
RUN pnpm --filter web exec prisma generate

# Next build (Turbopack) — emits .next/standalone-style output
RUN pnpm --filter web build

# ---------- 4. Runtime image ----------
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /repo

# Copy the full built workspace. We keep node_modules intact rather than
# pruning, because Next 16 + Prisma + ffmpeg-static + sharp all depend on
# native binaries that are awkward to re-install at runtime.
COPY --from=build /repo /repo

EXPOSE 3000

# Health probe Zeabur can hook (Next serves 200 on /).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the Next.js server.
CMD ["pnpm", "--filter", "web", "start"]
