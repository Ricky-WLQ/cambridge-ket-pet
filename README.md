# Cambridge KET / PET Exam-Prep

A web app for Chinese K-12 students preparing for Cambridge English **KET** (A2 Key) and **PET** (B1 Preliminary), with teacher monitoring and AI-generated practice tests strictly consistent with the real Cambridge exam format, exam points (考点), and difficulty points (难点).

## Status

**Phase 1 — Reading + Writing — complete (local). Awaiting final Phase 1 sign-off before moving to Phase 2.**

| Phase | Scope | Status |
|---|---|---|
| 1 | Reading + Writing (KET + PET), auth, classes, history, teacher dashboard, assignments, comments, AI teacher-analysis | ✅ complete, awaiting sign-off |
| 2 | Listening (CosyVoice2 TTS via SiliconFlow; browser-TTS fallback) | ⏳ planned |
| 3 | Speaking (Qwen3.5-Omni-Realtime via DashScope; Cambridge 4-criteria rubric) | ⏳ planned |
| 4 | Vocab + Grammar (seeded from Cambridge A2/B1 official lists) | ⏳ planned |

Deployment to **Zeabur Singapore** happens **only after all four phases pass local validation**.

## Architecture

```
cambridge-ket-pet/
├── apps/
│   └── web/            # Next.js 16 + React 19 + TypeScript 5 + Tailwind 4
│       ├── src/        # App Router pages, components, lib
│       └── prisma/     # schema.prisma + migrations + seed.ts (exam/difficulty points)
└── services/
    └── ai/             # Python FastAPI + Pydantic AI + DeepSeek direct API
        ├── app/agents/    # Pydantic AI agents (reading, writing, analysis)
        ├── app/prompts/   # Cambridge-spec system prompts
        ├── app/schemas/   # Pydantic request/response models
        ├── app/validators/# Post-generation format validators
        └── tests/         # pytest suites (schemas + validators)
```

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 | Server components, server actions |
| Backend (app) | Next.js API routes + server actions | Server-side only calls to the AI service |
| Auth | Auth.js v5 (NextAuth v5 beta) + Credentials + Prisma adapter + bcryptjs | Sessions in Postgres |
| DB | PostgreSQL 16 (via Docker Compose locally) | Prisma 6 ORM |
| AI agents | Pydantic AI (Python) | DeepSeek direct API (`deepseek-chat` for generation + grading + analysis) |
| Structured LLM output | Pydantic `output_type` + custom format/anti-hallucination validators | 3-retry regeneration on validator failure |
| Rate limiting | `GenerationEvent` table (per-user, per-bucket, rolling 1-hour window) | 20/hr reading + writing, 10/hr analysis |

## Prerequisites

- **Node.js 22+**
- **pnpm 10+**
- **Docker Desktop** (for local PostgreSQL)
- **Python 3.13+**
- **DeepSeek API key** — sign up at <https://platform.deepseek.com/>
- **Git bash or WSL** on Windows (uses Unix-style shell commands)

## One-page quickstart

```bash
# 1. Clone + install
git clone <repo> cambridge-ket-pet
cd cambridge-ket-pet
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Env — copy template, fill in keys
cp .env.example .env
# and separately for each service:
cp .env.example apps/web/.env
cp .env.example services/ai/.env
# Fill at minimum:
#   AUTH_SECRET              — openssl rand -base64 32
#   DEEPSEEK_API_KEY         — your key from platform.deepseek.com
#   INTERNAL_AI_SHARED_SECRET / INTERNAL_SHARED_SECRET — any matching string

# 4. Migrate + seed
pnpm --filter web exec prisma migrate deploy
pnpm --filter web run db:seed   # exam points + difficulty points + 1 teacher activation code

# 5. Start the Python AI service (separate terminal)
cd services/ai
python -m venv .venv
source .venv/Scripts/activate    # Windows bash
# or:  source .venv/bin/activate   # macOS / Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload --host :: --port 8001

# 6. Start the Next.js dev server (back in root)
pnpm --filter web dev

# 7. Open http://localhost:3000
```

After step 4, the seed script prints a **teacher activation code** — copy it. A new account can enter this at `/teacher/activate` to become a teacher.

## Running services

| Service | Local port | Start command | Health |
|---|---|---|---|
| Next.js web | 3000 | `pnpm --filter web dev` | <http://localhost:3000> |
| Python AI | 8001 (dev) / 8000 (docker) | `uvicorn app.main:app --reload --host :: --port 8001` | <http://localhost:8001/health> |
| PostgreSQL | 5432 | `docker compose up -d` | `docker exec ketpet-postgres pg_isready` |
| Prisma Studio | 5555 | `pnpm --filter web run db:studio` | <http://localhost:5555> |

On Windows, bind uvicorn with `--host ::` (IPv6 dual-stack) — `localhost` resolves to `::1` first and a `127.0.0.1`-only bind is unreachable.

## Tests

```bash
# Next.js (grading logic)
pnpm --filter web exec vitest run             # 22 tests

# Python (schemas + validators — reading + writing + analysis)
cd services/ai && source .venv/Scripts/activate
python -m pytest -q                            # 46 tests

# Type + lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
```

Every commit in Phase 1 was landed green against all of the above.

## Key routes

### Student
- `/signup`, `/login`, `/classes`
- `/ket`, `/pet` — portal homes (show assignments)
- `/ket/reading/new`, `/pet/reading/new` (accept `?part=N` for assignment deep-linking)
- `/ket/writing/new`, `/pet/writing/new`
- `/{ket|pet}/{reading|writing}/runner/[attemptId]`
- `/{ket|pet}/{reading|writing}/result/[attemptId]`
- `/history`, `/history/mistakes`

### Teacher
- `/teacher/activate` — enter activation code to become a teacher
- `/teacher/classes`, `/teacher/classes/new`
- `/teacher/classes/[classId]` — overview (stats, assignments, students, activity feed)
- `/teacher/classes/[classId]/assignments/new`
- `/teacher/classes/[classId]/students/[studentId]` — per-student detail (AI analysis, trend chart, per-kind breakdown, comments, attempts)
- `/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]` — attempt drill-in

### Internal APIs
- `/api/tests/generate`, `/api/writing/generate` — proxy to Python AI
- `/api/tests/[attemptId]/submit` — reading grading (synchronous) / writing grading (30-90s)
- `/api/mistakes/[id]/status` — mistake status update
- `/api/teacher/student-analysis` — AI teacher-analysis agent (10/hr per teacher)
- `/api/auth/*` — Auth.js

### Python AI service (`services/ai`)
| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness |
| GET  | `/ready` | Readiness + which providers are configured |
| GET  | `/v1/ping` | Auth smoke test |
| POST | `/v1/reading/generate` | Reading test generation |
| POST | `/v1/writing/generate` | Writing prompt generation |
| POST | `/v1/writing/grade` | 4-criteria rubric grading |
| POST | `/v1/analysis/student` | Teacher-style diagnostic |

All non-health endpoints require `Authorization: Bearer <INTERNAL_SHARED_SECRET>`.

## Test users

After running `db:seed`, you can:
- Visit `/signup` to create a student
- Create a second account, visit `/teacher/activate`, enter the seeded code → that account becomes a teacher
- Teacher creates a class → shares the 8-char invite code with the student → student joins via `/classes`

## Documentation per service

- [`apps/web/README.md`](apps/web/README.md) — web-app specific commands (Prisma, seeding, auth)
- [`services/ai/README.md`](services/ai/README.md) — Python service commands (venv, pytest, endpoints)

## Design decisions

Key Phase-1 decisions captured in commits and the implementation plan:

- **No past-paper corpus.** Every test is generated fresh. Grounding comes from Cambridge-spec encoded in system prompts + seeded `ExamPoint`/`DifficultyPoint` reference tables + CEFR-level instructions. No retrieval, no PDF parsing.
- **DeepSeek-chat (V3.2) for everything** — including the grader. R1 (`deepseek-reasoner`) rejects the `tool_choice` parameter Pydantic AI needs for structured output (verified 2026-04-23).
- **Completion is derived, not stored.** Assignments don't have a join table; a student "completed" an assignment iff they have a GRADED `TestAttempt` matching the assignment target. Keeps the schema small; forward-compatible with a future `AssignmentCompletion`.
- **Format validators + 3-retry regenerate** on every generator/grader/analysis call. A validator failure never silently ships malformed content to the user — after 3 tries we surface an explicit error.
- **Rate limiting** via the `GenerationEvent` table — rolling 1-hour window, per-user-per-bucket (reading, writing, analysis).
- **Chinese output, everywhere.** UI is `zh-CN` only; AI agents produce Simplified Chinese; validator catches English leakage and common misreadings like `25 分（满分 25）`.

## License

Private — all rights reserved.
