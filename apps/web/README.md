# `apps/web` — Next.js app

The user-facing web application: Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + Prisma 6 + Auth.js v5 + Postgres.

For the overall architecture, quickstart, and cross-service run order, see the [root README](../../README.md).

## Prerequisites

Assumed done from the root quickstart:

- `docker compose up -d` (root) has started PostgreSQL on `localhost:5432`
- Environment is set via `apps/web/.env` (copied from the root `.env.example`)
- `pnpm install` has been run from the repo root

## Running

```bash
pnpm --filter web dev                # Next.js dev server on :3000
# or from apps/web/ directly:
pnpm dev
```

The app reads `INTERNAL_AI_URL` (default `http://localhost:8001`) to reach the Python AI service. Start that service separately (see `services/ai/README.md`) or tests that hit the AI will time out.

## Database

```bash
# Run pending migrations
pnpm --filter web exec prisma migrate deploy

# Create a new migration after editing schema.prisma
pnpm --filter web run db:migrate -- --name <migration_name>

# Seed exam points + difficulty points + 1 teacher activation code
pnpm --filter web run db:seed

# Inspect data in a browser
pnpm --filter web run db:studio       # http://localhost:5555
```

The seed script prints a fresh **teacher activation code** on each run. A new user account can enter this at `/teacher/activate` to be promoted to `TEACHER` role. Re-running the seed appends a new code (previous codes remain valid until used).

## Auth

Auth.js v5 with the Prisma adapter + Credentials provider + bcryptjs. `AUTH_SECRET` is required; generate with:

```bash
openssl rand -base64 32
```

Sessions live in the `Session` table. Logout clears the session cookie; the row is deleted by the adapter.

## Tests

```bash
# Unit tests (grading logic)
pnpm --filter web exec vitest run
```

22 tests cover `normalizeText`, `isAnswerCorrect`, and `gradeReading`. See `src/lib/grading.test.ts`.

## Lint + typecheck

```bash
pnpm --filter web exec tsc --noEmit    # TypeScript
pnpm --filter web lint                  # ESLint
```

## Project structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (root routes)       # /, /signup, /login
│   ├── ket/, pet/          # Student portals + runners + result pages
│   ├── classes/            # Student-side class membership (join)
│   ├── history/            # Unified attempt history + /history/mistakes
│   ├── teacher/            # Teacher dashboard (classes, students, assignments)
│   └── api/                # Route handlers (auth, tests, writing, mistakes, teacher)
├── components/
│   ├── reading/            # Reading runner + result view (shared by student + teacher)
│   ├── writing/            # Writing runner + result view
│   ├── student/            # AssignmentList (reused on /ket and /pet)
│   └── SiteHeader.tsx
├── lib/
│   ├── auth.ts             # Auth.js v5 config
│   ├── prisma.ts           # Singleton Prisma client
│   ├── aiClient.ts         # HTTP client for the Python service (shared-secret bearer)
│   ├── grading.ts          # Pure deterministic reading grader (normalize + score)
│   ├── rateLimit.ts        # GenerationEvent-backed per-user per-bucket limit
│   ├── attemptActions.ts   # Server actions (redo)
│   ├── assignmentActions.ts
│   └── commentActions.ts
└── i18n/zh-CN.ts           # Simplified Chinese string dict (single file for now)
```

## Notable environment variables

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Prisma runtime |
| `DIRECT_URL` | Prisma migrations (may differ from runtime in pooled setups) |
| `AUTH_SECRET` | Auth.js v5 session-cookie signing key |
| `INTERNAL_AI_URL` | Base URL of the Python AI service |
| `INTERNAL_AI_SHARED_SECRET` | Must match `services/ai`'s `INTERNAL_SHARED_SECRET` |

See the root [`.env.example`](../../.env.example) for the full list and local-dev defaults.

### Phase 2 — Listening env vars

All of these live in `apps/web/.env` (copied from the root `.env.example`). The `R2_*` keys come from the Cloudflare R2 bucket setup (prerequisites P1–P5 in the root README).

| Key | Purpose |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account id that owns the R2 bucket |
| `R2_ACCESS_KEY_ID` | R2 API-token access key (Object Read & Write on the bucket) |
| `R2_SECRET_ACCESS_KEY` | R2 API-token secret |
| `R2_BUCKET` | Bucket name, e.g. `cambridge-ket-pet-audio` |
| `R2_ENDPOINT` | S3-compatible endpoint `https://<accountId>.r2.cloudflarestorage.com` |
| `FFMPEG_BINARY` | `auto` (use `ffmpeg-static`) or an absolute path to a system `ffmpeg` binary |
| `LISTENING_MAX_CONCURRENT` | Max concurrent listening-generation jobs (default 3) |
| `LISTENING_QUEUE_MAX` | Max queued jobs before 429 (default 5) |
| `LISTENING_GEN_TIMEOUT_MS` | Per-job hard timeout in ms (default 300_000 = 5 min) |
| `LISTENING_RATE_LIMIT_PER_HOUR` | Per-user hourly generation limit (default 10) |
| `LISTENING_TIME_LIMIT_SEC` | Mock-mode hard timer in seconds (default 1800 = 30 min) |
| `LISTENING_GRACE_PERIOD_MS` | Extra time after the timer before cron auto-submits (default 60_000) |
| `CRON_SECRET` | Shared secret for `/api/cron/*` endpoints (sent by the scheduler as `x-cron-secret`) |

## Tests (Phase 2 listening subset)

To run only the listening-related vitest suites (audio pipeline + listening grader):

```bash
pnpm --filter web exec vitest run src/lib/audio src/lib/grading
```

## Gotchas

- **Windows + Prisma generate**: if `prisma generate` fails with `EPERM: operation not permitted` on `query_engine-windows.dll.node`, the Next.js dev server is holding that DLL. Kill Node (`powershell.exe "Get-Process node | Stop-Process -Force"`) then re-run generate.
- **Writing grader latency**: `deepseek-chat` takes 30-90s on a full essay. The submit route declares `export const maxDuration = 150`; make sure your host honors that (Zeabur does).
- **`deepseek-reasoner` (R1)** is NOT used — it rejects the `tool_choice` parameter Pydantic AI needs for structured output. All agents use `deepseek-chat`.

### Phase 2 listening troubleshooting

- **`ECONNRESET` from edge-tts** — the Microsoft Edge TTS websocket occasionally drops a segment mid-synth. The pipeline retries **3 times with 2 s exponential-ish backoff** automatically; a single `ECONNRESET` in the logs is normal and recovers transparently. Only escalate if you see `edge-tts failed after 3 attempts` in the log.
- **Microsoft `trustedclienttoken` rotation** — `node-edge-tts` bakes in a fixed client token to talk to the Edge TTS endpoint. Microsoft rotates this token periodically (every few months). When it rotates, **all segments fail immediately** with a 401/403 from the websocket. This is a **fail-fast** path — the logs emit a loud `edge-tts auth rejected (token may have rotated)` alert. Fix: bump `node-edge-tts` to the latest version (maintainers roll a new token on each rotation).
- **`ffmpeg-static` postinstall missing** — if the audio pipeline fails with `ENOENT` on `ffmpeg`, pnpm never ran the `ffmpeg-static` postinstall. See the **Gotcha** section in the root README for the one-line fix.
