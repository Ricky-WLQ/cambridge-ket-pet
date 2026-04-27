# Weekly Forced AI Assessment (Diagnose v2) · Design

| | |
|---|---|
| **Status** | Implemented (build phase 8 in progress — docs + manual QA) |
| **Date** | 2026-04-26 |
| **Branch** | `feat/diagnose-weekly` (off `main` after Phase 4 merge `863f2f5`) |
| **Plan source** | `~/.claude/plans/shiny-gathering-fountain.md` (approved 2026-04-26 after 4 rounds of `AskUserQuestion`) |
| **Reference project** | `C:\Users\wul82\Desktop\英语AB级\pretco-app` — 8-category knowledge-point analysis prompt + diagnostic UX adopted, level wiring + category #7 adapted for Cambridge KET/PET |
| **Supersedes** | `docs/superpowers/specs/2026-04-23-diagnose-v1-design.md` (passive analysis-report variant — scrapped; only the `(userId, weekStart)` row concept + ISO-week-in-CST helper carry over) |

## 1. Context

The Cambridge KET/PET exam-prep web app finished its four-phase roadmap on 2026-04-26 when Phase 4 (Vocab + Grammar) merged to `main` at `863f2f5`. All six learning surfaces are now shipped: Reading, Writing, Listening, Speaking, Vocab, Grammar. The roadmap's natural next step is a **weekly retrospective + forward-look loop** — the exam-prep equivalent of a Monday standup that locks the student into a balanced reality-check before they're allowed to cherry-pick favourite practice modes for another week.

Previous v1 attempt (2026-04-23) shipped a passive "analyse-only" report off existing `TestAttempt` rows. It read the data, made pretty graphs, and changed nothing about student behaviour. Users skimmed it, closed it, and went back to over-practicing the surfaces they already enjoyed. That design is **scrapped**. v2 inverts the contract: every ISO week, every `role=STUDENT` is **gated** from practice surfaces until they take and submit a fresh AI-generated 6-section test (~15 questions, ~30 min). Submission alone unblocks; no passing-score requirement. After submit, AI grades + produces an 8-category knowledge-point report adapted from `pretco-app/src/lib/diagnostic-analysis.ts`.

The persistence model concept (a `(userId, weekStart)`-keyed parent row) and `apps/web/src/lib/diagnose/week.ts` ISO-week-in-CST helper are the only artefacts inherited from v1.

The project remains non-commercial research-grade — free to users, manuscript-track for the project owner. Hosted on Zeabur Singapore; Chinese users; AI endpoints must be China-reachable (DeepSeek direct API satisfies this per memory `user_ai_apis_and_china_constraint.md`).

## 2. Product decisions (locked)

The 10 locks below were decided in 4 rounds of `AskUserQuestion` during plan v2 review and **must not be re-litigated** without writing a new spec. They were copied verbatim from the plan §"Locks" into this spec to make the doc self-contained.

### L1 — Trigger + gate

The week is **ISO week (Monday 00:00 → Sunday 23:59:59 `Asia/Shanghai`)**. China has had no DST since 1991, so this is deterministic.

All practice surfaces are **blocked** for `role=STUDENT` while `requiredDiagnoseId !== null`:
- Portal hubs: `/`, `/ket`, `/pet`
- All `*/runner/*` paths
- All `/{ket,pet}/{vocab,grammar}` paths

Surfaces always **allowed**:
- `/diagnose/*` (the diagnose flow itself)
- `/history` (read-only past records — banner overlay while gated)
- `/classes` (class-membership view)
- `/login`, `/logout`, `/signup` (auth)
- `/teacher/*` (teachers exempt entirely — see L1.2)
- `/api/auth/*`, `/api/diagnose/*`, `/api/cron/*`, `/api/teacher/*`

**L1.2 — Role exemptions:** Teachers (`role=TEACHER`) and admins (`role=ADMIN`) are exempt from the gate. They never see `requiredDiagnoseId !== null` in their JWT.

**L1.3 — Carve-outs for runner static assets:** `/api/r2/*` and `/api/speaking/photos/*` are referenced from active runner pages; without an allowlist the gate would redirect mid-runner audio fetches and break the experience. Both are unconditionally allowed.

### L2 — Test composition

6 sections totalling **~15 questions, ~30 minutes**:

| Section | Questions | Time limit |
|---|---|---|
| Reading | 3 | 8 min |
| Listening | 3 | 10 min |
| Grammar | 3 | 5 min |
| Vocab | 3 | 4 min |
| Writing | 1 | 15 min |
| Speaking | 1 | 5 min |

The 30-minute total is the wall-clock of completing all 6 with no breaks; in practice students chunk it across multiple sittings within the week (see L4).

### L3 — Question source

Mixed — 4 sections fresh-AI, 2 sections bank-sampled:

| Section | Source | Reason |
|---|---|---|
| Reading | Fresh AI | Comprehension passages need topic novelty; same passage twice = no signal |
| Listening | Fresh AI | Same — plus audio re-use across diagnose attempts would over-cache R2 |
| Writing | Fresh AI | Prompt freshness avoids canned-essay regression |
| Speaking | Fresh AI | Akool turn prompts must vary or the student rote-memorises |
| Vocab | Bank sampling | 3 words from `Word` table weighted by weak topics + fresh AI fill-blank patterns. Saves ~¥0.20/student/week DeepSeek per user-confirmed estimate. |
| Grammar | Bank sampling | 3 questions from `GrammarQuestion` bank weighted by weak topics + de-duped vs the last 4 weeks. Same cost saving. |

### L4 — Per-section behaviour

- **Order**: any section in any order — no forced reading-first-then-listening.
- **Sittings**: multiple sittings within the week are allowed. The hub shows status pills (`NOT_STARTED / IN_PROGRESS / SUBMITTED / AUTO_SUBMITTED / GRADED`) so a half-week return is unambiguous.
- **Timer per section**: each section has its own time limit (per L2). Once a section is **started**, that section's timer is locked — closing the tab does not pause it.
- **Force-submit on expiry**: the cron job `/api/cron/diagnose-force-submit-expired` runs every 5 min and force-submits any section whose `startedAt + timeLimit + 60s grace` is past. The 60s grace mirrors the existing `expired-attempts` cron.

### L5 — Cold start (week 1)

No weak-area history exists for a brand-new student in their first week. The orchestrator generates a **balanced level-appropriate test** (uniform topic distribution, mid-difficulty) instead of weak-area targeting. Week 2+ uses last week's data as the weight signal.

### L6 — Storage

Reuse existing `Test` + `TestAttempt` tables with a new `TestKind.DIAGNOSE` enum value. **Six** `TestAttempt` rows per `(userId, weekStart)` — one per section. Plus a new `WeeklyDiagnose` parent model for completion tracking + report.

### L7 — Score gating

**Submission alone = complete.** No minimum passing score. A perfect score and a 0/15 score both clear the gate identically. The intent is forced retrospective contact, not a punitive checkpoint.

### L8 — Speaking

Reuse the existing **Akool TRTC streaming-avatar (Mina)** flow from Phase 3 unchanged. ~3-5 min Akool session per week per student. The speaking runner keys off `attemptId`, so a diagnose-flavoured page just hands it the diagnose `TestAttempt.id` and everything else (TRTC token, VAD, rubric grading, ~400 LOC of streaming logic) works as-is.

### L9 — Post-submit report

The report contains:
1. **Per-section scores** (6 numbers, percentage)
2. **Overall score** (weighted average — equal weight per section)
3. **4-field AI summary**:
   - `strengths[]` — what the student did well
   - `weaknesses[]` — what they struggled with
   - `priorityActions[]` — concrete next steps
   - `narrative_zh` — Chinese paragraph that names the week date in its first sentence (e.g., "本周（2026年4月27日—5月3日）……")
4. **8-category knowledge-point analysis** ported from `pretco-app/src/lib/diagnostic-analysis.ts:201-282` with three Cambridge adaptations (see §6.3).

The 8 categories (after Cambridge adaptation):

| # | Category | Notes |
|---|---|---|
| 1 | `grammar` | Verb-tense, modal, pronoun, etc. |
| 2 | `collocation` | Common collocations + dependent prepositions |
| 3 | `vocabulary` | Word meaning + form + register |
| 4 | `sentence_pattern` | Cleft, inversion, passive, etc. |
| 5 | `reading_skill` | Skimming, scanning, inference, gist |
| 6 | `listening_skill` | Number, name, gist, attitude |
| 7 | `cambridge_strategy` | **Replaces pretco's `translation_skill`** — KET/PET has no translation paper |
| 8 | `writing_skill` | Email/note conventions, narrative structure |

### L10 — History

Past diagnoses live at `/diagnose/history`, **separate** from `/history`. The student `/history` page filters out `kind=DIAGNOSE` attempts to avoid mixing diagnose attempts with self-directed practice. Past diagnoses are replayable — the **replay** flow creates fresh `PRACTICE`-mode `TestAttempt` rows that do **not** mutate the `WeeklyDiagnose` parent. Replay is for review, not re-scoring.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js 16 + Auth.js v5 JWT + Prisma 6 + Tailwind v4)   │
│                                                                     │
│  middleware.ts  (Edge runtime, JWT-only, no Prisma)                 │
│    - reads Auth.js JWT                                              │
│    - if role=STUDENT && requiredDiagnoseId !== null                 │
│        → redirect to /diagnose                                      │
│                                                                     │
│  /diagnose                  (hub: 6 section cards, progress, report) │
│  /diagnose/runner/[section] (per-section runner, wraps existing)    │
│  /diagnose/report/[testId]  (post-submit report)                    │
│  /diagnose/history          (past weeks list)                       │
│  /diagnose/history/[testId] (past report read-only)                 │
│  /diagnose/replay/[testId]/[section] (PRACTICE replay)              │
│  /teacher/classes/[classId]/diagnose-status (class roll-up)         │
│                                                                     │
│  API:                                                               │
│   GET  /api/diagnose/me/current                                     │
│   POST /api/diagnose/me/generate          (idempotent + 3/hr)       │
│   POST /api/diagnose/me/section/[k]/start                           │
│   POST /api/diagnose/me/section/[k]/submit                          │
│   POST /api/diagnose/me/finalize          (5-step pipeline)         │
│   GET  /api/diagnose/me/report/[testId]                             │
│   POST /api/diagnose/replay                                         │
│   GET  /api/diagnose/history                                        │
│   GET  /api/teacher/diagnose-status                                 │
│   POST /api/cron/diagnose-force-submit-expired (every 5 min)        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTP Bearer (existing aiClient)
┌─────────────────────────────────────────────────────────────────────┐
│  services/ai (FastAPI + Pydantic AI + DeepSeek)                     │
│                                                                     │
│  POST /v1/diagnose/generate                                         │
│    orchestrator: asyncio.gather × 4 fresh-AI sections               │
│    (R/L/W/S — vocab + grammar bank-sample on the Node side)         │
│                                                                     │
│  POST /v1/diagnose/analysis                                         │
│    8-category knowledge-point analysis                              │
│    (port of pretco diagnostic-analysis.ts with Cambridge adaptation)│
│                                                                     │
│  POST /v1/diagnose/summary                                          │
│    4-field summary (sibling of analyze_student, diagnose-framed)    │
└─────────────────────────────────────────────────────────────────────┘
```

The split mirrors the rest of the app: TS Next.js owns DB, gating, runner UX; Python owns AI prompts, validators, multi-agent orchestration. No new dependencies introduced — all packages already in `apps/web/package.json` or `services/ai/pyproject.toml` are reused.

## 4. Data model

### 4.1 New `TestKind.DIAGNOSE` enum value

`apps/web/prisma/schema.prisma` adds `DIAGNOSE` to `enum TestKind`. Postgres requires a **two-phase migration** for enum value addition + use:

```sql
-- Migration step 1 (single transaction, must commit before step 2)
ALTER TYPE "TestKind" ADD VALUE 'DIAGNOSE';

-- Migration step 2 (separate transaction, can run any time after step 1)
CREATE TYPE "DiagnoseStatus" AS ENUM (...);
CREATE TYPE "DiagnoseSectionStatus" AS ENUM (...);
CREATE TABLE "WeeklyDiagnose" (...);
```

Created at `apps/web/prisma/migrations/20260427_add_weekly_diagnose/migration.sql` in commit `c0ac90d`.

### 4.2 Two new enums

```prisma
enum DiagnoseStatus {
  PENDING
  IN_PROGRESS
  COMPLETE
  REPORT_READY
  REPORT_FAILED
}

enum DiagnoseSectionStatus {
  NOT_STARTED
  IN_PROGRESS
  SUBMITTED
  AUTO_SUBMITTED
  GRADED
}
```

`DiagnoseStatus` tracks parent lifecycle from generation → completion → report. `DiagnoseSectionStatus` is a per-section state machine that mirrors `TestAttempt.status` but with the extra `AUTO_SUBMITTED` value to distinguish cron-forced submissions from user-pressed submits (matters for the report — auto-submitted sections may have empty answers).

### 4.3 `WeeklyDiagnose` parent model

```prisma
model WeeklyDiagnose {
  id        String   @id @default(cuid())
  userId    String
  weekStart DateTime  // CST Monday 00:00 stored as UTC
  weekEnd   DateTime
  testId    String
  examType  ExamType
  status    DiagnoseStatus @default(PENDING)

  readingAttemptId   String?
  listeningAttemptId String?
  writingAttemptId   String?
  speakingAttemptId  String?
  vocabAttemptId     String?
  grammarAttemptId   String?

  readingStatus   DiagnoseSectionStatus @default(NOT_STARTED)
  listeningStatus DiagnoseSectionStatus @default(NOT_STARTED)
  writingStatus   DiagnoseSectionStatus @default(NOT_STARTED)
  speakingStatus  DiagnoseSectionStatus @default(NOT_STARTED)
  vocabStatus     DiagnoseSectionStatus @default(NOT_STARTED)
  grammarStatus   DiagnoseSectionStatus @default(NOT_STARTED)

  completedAt DateTime?
  reportAt    DateTime?

  knowledgePoints  Json?    // KnowledgePointGroup[]
  summary          Json?    // 4-field
  perSectionScores Json?    // PerSectionScores
  overallScore     Float?
  reportError      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  test Test @relation(fields: [testId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId, status])
  @@index([weekStart])
}
```

Back-relations added: `User.weeklyDiagnoses WeeklyDiagnose[]`, `Test.weeklyDiagnose WeeklyDiagnose?` (1-to-1).

### 4.4 Why this shape (not nested JSON in `Test.payload`)

1. **`(userId, weekStart)` unique constraint** = single source of truth for "is gated this week". The middleware can answer the gate question with O(1) keyed lookup.
2. **6 `*AttemptId` FK + 6 `*Status` mirrors** = render the hub in 1 indexed query (no joins through `TestAttempt`). The status mirrors are read-only denormalisations updated on submit.
3. **Report JSON is heavy.** `knowledgePoints` alone can be ~30 KB. Isolating it from `Test.payload` avoids re-shipping it to the runner on every status poll.

### 4.5 Why six `TestAttempt` rows per week (not one with nested answers)

1. **Independent state per section.** `startedAt`, `submittedAt`, `status`, `answers`, `rawScore` are all per-section concepts. Mutating a single nested attempt would race when two sections submit simultaneously (rare but possible with multi-tab usage).
2. **Existing `forceSubmitExpired` cron** iterates per-attempt rows. Extending it to handle the diagnose case requires zero new query topology — just an added filter on `kind=DIAGNOSE`.
3. **Speaking is keyed by attemptId.** All 14 speaking-runner files (`apps/web/src/components/speaking/*`) and 5+ API routes thread `attemptId` through the TRTC pipeline. One row per section keeps speaking integration trivial — no ad-hoc nesting.
4. **Aggregation cost is one indexed query.** Read 6 rows by parent `testId`, sum `rawScore`. Cheaper than reading + JSON-parsing a denormalised payload.

### 4.6 8-category knowledge-point storage

Stored as JSON in `WeeklyDiagnose.knowledgePoints`. The TS interface lives at `apps/web/src/lib/diagnose/types.ts:KnowledgePointGroup` (added in commit `7aa47cf`, polished `b4d26d3`):

```ts
type KnowledgePointCategory =
  | "grammar"
  | "collocation"
  | "vocabulary"
  | "sentence_pattern"
  | "reading_skill"
  | "listening_skill"
  | "cambridge_strategy"     // NOT translation_skill (KET/PET has no translation paper)
  | "writing_skill";

interface KnowledgePointGroup {
  category: KnowledgePointCategory;
  knowledgePoint: string;        // English label, e.g. "Past simple agreement"
  miniLesson: string;            // Chinese mini-lesson explaining the point
  rule?: string;                  // Optional rule formalisation
  exampleSentences: string[];    // ≥1 entry
  severity: "critical" | "moderate" | "minor";
  questions: KnowledgePointQuestion[];   // The wrong answers in this group
}

interface KnowledgePointQuestion {
  section: DiagnoseSectionKind;  // one of READING/LISTENING/WRITING/SPEAKING/VOCAB/GRAMMAR
  questionId: string;             // stable within Test.payload
  whyWrong: string;               // Chinese explanation tied to this specific student attempt
}
```

Severity is computed deterministically by `apps/web/src/lib/diagnose/severity.ts` (commit `432b041`) — `≥3 wrong = critical`, `=2 = moderate`, `=1 = minor`. Ports `pretco-app/src/lib/diagnostic-analysis.ts` severity logic verbatim.

### 4.7 ISO-week boundary semantics

`apps/web/src/lib/diagnose/week.ts` (commit `8286142`) exports:
- `currentWeekStart(now: Date): Date` — Monday 00:00 CST of `now`'s week, returned as a `Date` whose `getTime()` is the UTC instant of that local boundary.
- `currentWeekEnd(now: Date): Date` — Sunday 23:59:59.999 CST.
- `formatWeekRangeZh(weekStart: Date): string` — `"2026年4月27日—5月3日"` Chinese label.

Implementation uses `Intl.DateTimeFormat` with `timeZone: "Asia/Shanghai"`. Test coverage in `apps/web/src/lib/diagnose/__tests__/week.test.ts` covers DST-shift boundaries (a no-op for China since 1991, but the test asserts the assumption explicitly so a future timezone migration would fail loudly).

## 5. Backend — services/ai (Python)

### 5.1 Three new endpoints

Registered in `services/ai/app/main.py` at commit `1bea71e`:

| Endpoint | Purpose | Agent |
|---|---|---|
| `POST /v1/diagnose/generate` | Orchestrator: produces all 4 fresh-AI sections via `asyncio.gather`. | `app/agents/diagnose_generator.py` |
| `POST /v1/diagnose/analysis` | 8-category knowledge-point analysis (port of pretco). | `app/agents/diagnose_analysis.py` |
| `POST /v1/diagnose/summary` | 4-field summary (sibling of `analyze_student`, framed for diagnose). | `app/agents/diagnose_summary.py` |

### 5.2 Schemas + validators

`services/ai/app/schemas/diagnose.py` (commit `236cfd8`, polish `1547690`) defines all request + response Pydantic models. Validators in `services/ai/app/validators/diagnose.py` mirror the analysis-validator pattern from `app/validators/analysis.py:185-212`.

Key structural validators:
- `validate_diagnose_analysis` — knowledge-point category whitelist (frozenset derived from the `Literal` type via `typing.get_args` so taxonomy edits happen in **one** place), section enum check, mandatory-field non-empty check, ≥1 example sentence per group.
- `validate_diagnose_summary` — non-empty `narrative_zh`, ≥1 entry in `strengths[]` and `priority_actions[]`, score-misreading checks (PCT_AS_POINTS_*, BAD_FULL_MARKS_DENOMINATOR) via the shared `_score_misreading.check_score_misreading` helper.

The Cambridge strategy adaptation lives in the schemas + prompts:
- `KnowledgePointCategory` literal type uses `cambridge_strategy` not `translation_skill`.
- The prompt explicitly tells the model "this is Cambridge KET/PET, not Chinese-to-English translation; cambridge_strategy refers to exam-room tactics like dealing with distractors in MCQ Part 1".

### 5.3 The CJK regex word-boundary fix

`services/ai/app/validators/diagnose.py` enforces that `narrative_zh` references the week date in its opening sentence — the LLM otherwise tends to omit it ("本周你做得不错" instead of "本周（2026年X月X日—X月X日）你做得不错"). A 4-digit year token (2024–2099) is the cheapest signal.

The naive regex `\b20\d{2}\b` **does not work** in Python `str` mode against Chinese text. Python's `\b` treats CJK characters as word characters, so the boundary at the trailing `2026年` evaluates to "no transition" → no match. The validator therefore uses **digit-boundary lookarounds**:

```python
_YEAR_TOKEN_PATTERN = re.compile(r"(?<!\d)20\d{2}(?!\d)")
```

This matches "2026" in "2026年4月27日" and rejects "12026" (longer numeric run), with semantics independent of surrounding language. The fix is documented inline at `services/ai/app/validators/diagnose.py:43-49`:

```python
# We use digit-boundary lookarounds (?<!\d) / (?!\d) instead of \b because
# Python's str-mode \b treats CJK characters as word characters, so the
# pattern \b20\d{2}\b would FAIL to match the canonical Chinese form
# "2026年4月27日" (the trailing 年 is a word char, suppressing the boundary).
# Digit-boundary lookarounds give the same closed-set semantics ("not a
# longer numeric run") while working regardless of surrounding language.
```

### 5.4 Generator orchestration

A single new orchestrator at `services/ai/app/agents/diagnose_generator.py` (commit `e32b26b`) calls existing per-kind agents in parallel via `asyncio.gather`:

```python
async def generate_diagnose(req: DiagnoseGenerateRequest) -> DiagnoseGenerateResponse:
    reading, listening, writing, speaking = await asyncio.gather(
        reading_generator.generate(...),
        listening_generator.generate(...),
        writing_generator.generate(...),
        speaking_generator.generate(...),
    )
    # vocab + grammar are bank-sampled on the Node side per L3
    return DiagnoseGenerateResponse(
        reading=reading, listening=listening,
        writing=writing, speaking=speaking,
    )
```

**Zero edits to existing generators.** They keep their PRACTICE/MOCK contract; the orchestrator just dispatches them with diagnose-flavoured request payloads (3 questions for R/L, 1 prompt each for W/S).

End-to-end target wall time: ~30-45s (max of parallel sub-agents) instead of sequential ~3 min.

### 5.5 8-category analysis agent

`services/ai/app/agents/diagnose_analysis.py` (commit `72eecf7`) + prompt at `services/ai/app/prompts/diagnose_analysis.py` (commits `0bb43d8`, `3978976`). Ports `pretco-app/src/lib/diagnostic-analysis.ts:201-282` verbatim with three Cambridge adaptations:

1. **Replace level wiring `'A'|'B'` → `'KET'|'PET'`** in the prompt header and few-shot examples.
2. **Replace category #7 `translation_skill` → `cambridge_strategy`** everywhere (schema literal, prompt, validator whitelist, frontend display).
3. **Add Cambridge exam-point terminology guidance** — short paragraph in the prompt grounding the model in `MCQ_3_PICTURE`, `GAP_FILL_OPEN`, etc. so generated `whyWrong` text uses Cambridge-aligned vocabulary.

Same batching as pretco (15 wrong answers per batch, capped at 40 total) and severity rule (≥3=critical, =2=moderate, =1=minor).

### 5.6 4-field summary agent

`services/ai/app/agents/diagnose_summary.py` (commit `0df40b6`) is a **new sibling** of `analyze_student`, **not** an extension. Reasons documented in plan §B.4:

> The existing `analyze_student` prompt is heavily tuned for long-term trends across many attempts. Diagnose is single-week snapshot with different framing — the prompt asks for "this week's strengths" and "next 7 days' priority actions", which makes a separate prompt worth the duplicated boilerplate.

### 5.7 Failure handling

3-attempt validator loop with feedback (mirrors `services/ai/app/agents/analysis.py:185-212`). On exhausted retries:
- `analysis` agent → fallback shape (empty `knowledgePoints[]`, the gate is unblocked anyway since the report is best-effort).
- `summary` agent → minimal placeholder summary (still includes the week date in `narrative_zh` so the validator passes if the validator was the failure cause).

All three endpoints return 200 with placeholder shapes rather than 5xx, so the Node `/finalize` route always completes.

### 5.8 Pytest coverage

Test suite at `services/ai/tests/test_diagnose_*.py` (commit `08c8bda`). Covers:
- `test_diagnose_generator.py` — orchestrator dispatch + truncation + `asyncio.gather` failure handling.
- `test_diagnose_analysis.py` — prompt embedding, validator, severity computation.
- `test_diagnose_summary.py` — agent runs + 4-field shape + the CJK year-boundary edge case.

## 6. Backend — apps/web (TypeScript)

### 6.1 Eleven API routes

| Route | Method | Purpose | Commit |
|---|---|---|---|
| `/api/diagnose/me/current` | GET | Current week state (gating + section statuses) | `b592d34` (T17) |
| `/api/diagnose/me/generate` | POST | Idempotent generation, rate-limited 3/hr | `14c443c` (T18) |
| `/api/diagnose/me/section/[k]/start` | POST | Create section attempt (lock timer) | `f711d53` (T19) |
| `/api/diagnose/me/section/[k]/submit` | POST | Grade MCQ deterministically; W → async; S stays on existing route | `f711d53` (T20) |
| `/api/diagnose/me/finalize` | POST | 5-step pipeline (idempotent) | `ff49667` (T21) |
| `/api/diagnose/me/report/[testId]` | GET | Fetch report | `2cc152e` (T22) |
| `/api/diagnose/replay` | POST | Create new PRACTICE attempts for past content | `2cc152e` (T23) |
| `/api/diagnose/history` | GET | Past weeks list | `2cc152e` (T23) |
| `/api/teacher/diagnose-status` | GET | Class roll-up for teacher | `2cc152e` (T24) |
| `/api/cron/diagnose-force-submit-expired` | POST | Every 5min, auto-submits expired sections | `2cc152e` (T25) |
| `/api/diagnose/me/section/[k]/start` (Speaking variant) | POST | Reuses existing speaking-attempt creation | shared with `f711d53` |

### 6.2 The 5-step `/finalize` pipeline

The `/api/diagnose/me/finalize` route runs **idempotently** through 5 sequential steps:

1. **Deterministic grade R/L/Vocab/Grammar** — uses `apps/web/src/lib/diagnose/grade.ts` (commit `ba00a7f`). Pure function, no AI.
2. **AI writing grade** — calls existing `/v1/writing-grade` endpoint via `aiClient.gradeWriting()`. Same code path as practice writing.
3. **AI speaking grade** — polls existing speaking-attempt grading for up to 90s (Akool finalisation can lag). On 90s timeout, writes a placeholder score and the periodic re-finalize cron picks it up later.
4. **8-category analysis** — calls `/v1/diagnose/analysis` with the wrong-answers payload from `apps/web/src/lib/diagnose/collectWrongAnswers.ts` (commit `c4dc411`).
5. **4-field summary** — calls `/v1/diagnose/summary` with the per-section + overall scores.

After step 5 the parent `WeeklyDiagnose.status` transitions to `REPORT_READY` and the report fields (`knowledgePoints`, `summary`, `perSectionScores`, `overallScore`) are written in one transaction.

Idempotency: the route is keyed on `(userId, testId)`. Re-calls return the cached result if `status=REPORT_READY` already. If a step failed (e.g., DeepSeek 500), the route resumes from the failed step on the next invocation.

### 6.3 Gate-check helpers (`apps/web/src/lib/diagnose/`)

| File | Purpose | Commit |
|---|---|---|
| `week.ts` | ISO-week-in-CST + Chinese label | `8286142` (T2) |
| `sectionLimits.ts` | Per-section time limits + grace | `e83a9a6` (T3) |
| `types.ts` | `KnowledgePointGroup`, `DiagnosePayload`, etc. | `7aa47cf` (T4) |
| `grade.ts` | Deterministic graders for R/L/Vocab/Grammar | `ba00a7f` (T5) |
| `severity.ts` | Severity bucket boundaries | `432b041` (T6) |
| `collectWrongAnswers.ts` | Port of pretco wrong-answer collection (commit `c4dc411`, T7) | `c4dc411` (T7) |
| `eligibility.ts` | `findCurrentWeekDiagnose`, `isCompletedThisWeek`, `getRequiredDiagnoseId`, `requireUngated` | `a8c2b3c` (T8) |
| `markComplete.ts` | Helper to flip `WeeklyDiagnose.status` after all 6 sections submit | added during T20 polish |

`apps/web/src/lib/cron/diagnose-expired.ts` is the cron implementation called by the route in §6.1.

### 6.4 The cron job

`/api/cron/diagnose-force-submit-expired` (commit `2cc152e`) runs every 5 minutes (Zeabur cron). Logic:

```
SELECT TestAttempt
WHERE status = 'IN_PROGRESS'
  AND test.kind = 'DIAGNOSE'
  AND startedAt + sectionTimeLimit + 60s grace < now()
```

For each row: force-submit with current `answers`, set `WeeklyDiagnose.<section>Status = AUTO_SUBMITTED`, and if all 6 sections are now submitted → enqueue `/finalize`.

Mirrors `apps/web/src/app/api/cron/expired-attempts/route.ts` patterns. The 60s grace period gives the client-side timer 1 minute to fire its own auto-submit before the cron steps in (avoids double-submit races).

## 7. Gate enforcement (3 layers)

The gate uses a **belt-and-suspenders** approach with 3 independent layers. Any one failing falls through to the next.

### Layer 1 — JWT cache (Edge, no DB call per request)

`apps/web/src/lib/auth.ts` (extended in T26 / commit `881da3f`'s second hunk) adds two fields to the Auth.js v5 JWT:
- `requiredDiagnoseId: string | null` — the WeeklyDiagnose row's `id` if the student is gated this week, `null` otherwise.
- `role: UserRole` — already present, but explicitly read in middleware.

The JWT callback **only re-computes** `requiredDiagnoseId` on `signIn` OR explicit `update()` trigger. Re-computing on every request would defeat the JWT cache (which is the whole point of using JWT over session-cookie + DB).

After the last section submit, the client calls `useSession().update()` to refresh the JWT — this re-runs the callback and clears `requiredDiagnoseId` to `null`. Layer 1 alone is enough for the happy path.

### Layer 2 — Edge middleware (`apps/web/middleware.ts`)

New file at commit `881da3f`'s first hunk. Edge runtime (no Prisma). Reads `req.auth` (the decrypted JWT) and applies the rule:

```ts
if (
  req.auth?.user?.role === "STUDENT" &&
  req.auth?.user?.requiredDiagnoseId !== null
) {
  // Allowlist check
  if (!isAllowedPath(req.nextUrl.pathname)) {
    return Response.redirect(new URL("/diagnose", req.url));
  }
}
```

The allowlist is the §L1 list:
- Allowed paths: `/login`, `/signup`, `/diagnose`, `/history`, `/classes`, `/teacher/activate`, `/teacher/classes`.
- Allowed prefixes: `/api/auth`, `/api/diagnose`, `/api/cron`, `/_next`, `/teacher/`, `/api/teacher/`, `/api/r2`, `/api/speaking/photos` (carve-outs from L1.3).

### Layer 3 — Per-page belt-and-suspenders (`requireUngated()`)

Top of `/ket/page.tsx`, `/pet/page.tsx`, all `*/runner/*` server components in T28 (commit `881da3f`'s third hunk):

```ts
import { requireUngated } from "@/lib/diagnose/eligibility";

export default async function Page() {
  await requireUngated();
  // ... rest of the page
}
```

`requireUngated()` is a cheap DB lookup keyed on the `(userId, weekStart)` unique index. It throws a redirect if the JWT cache is stale (e.g., the `update()` call after submit hasn't reached this tab yet). This catches the rare race where Layer 1 + Layer 2 say "ungated" but the DB still says "gated".

The triple-layer design is overkill for the happy path but cheap defense — each layer is O(1) and the failure modes don't overlap.

## 8. Frontend

### 8.1 Pages (commits `3e420c5` for T36-T40)

| Path | File | Purpose |
|---|---|---|
| `/diagnose` | `app/diagnose/page.tsx` | Hub: SiteHeader + week banner + 6 SectionStatusCards + report link |
| `/diagnose/runner/[section]` | `app/diagnose/runner/[section]/page.tsx` | Per-section runner, wraps existing per-kind runner |
| `/diagnose/report/[testId]` | `app/diagnose/report/[testId]/page.tsx` | Post-submit report viewer |
| `/diagnose/history` | `app/diagnose/history/page.tsx` | Past weeks list |
| `/diagnose/history/[testId]` | `app/diagnose/history/[testId]/page.tsx` | Past report read-only |
| `/diagnose/replay/[testId]/[section]` | `app/diagnose/replay/[testId]/[section]/page.tsx` | Replay in PRACTICE mode |
| `/teacher/classes/[classId]/diagnose-status` | `app/teacher/classes/[classId]/diagnose-status/page.tsx` | Teacher class roll-up |

### 8.2 Components (commit `09a3dc2` for T29-T35)

`apps/web/src/components/diagnose/`:

| Component | Purpose |
|---|---|
| `DiagnoseHub.tsx` | 6-card status grid |
| `SectionStatusCard.tsx` | Per-section: title + status pill + countdown + CTA |
| `DiagnoseRunnerReading.tsx` | Wraps `components/reading/Runner.tsx` with `submitUrl` prop |
| `DiagnoseRunnerListening.tsx` | Wraps `ListeningRunner.tsx` |
| `DiagnoseRunnerWriting.tsx` | Wraps `writing/Runner.tsx` |
| `DiagnoseRunnerVocab.tsx` | NEW lightweight (no SRS writes) |
| `DiagnoseRunnerGrammar.tsx` | NEW lightweight (no GrammarProgress writes) |
| `DiagnoseReport.tsx` | Overall ring + per-section grid + 4-field summary + N KnowledgePointClusters |
| `KnowledgePointCluster.tsx` | Severity badge + miniLesson + rule + exampleSentences + expandable per-question whyWrong |
| `HistoryList.tsx` | Past-weeks table |
| `GateBanner.tsx` | Top-of-page banner on allowed pages while gated |

### 8.3 Runner reuse strategy

| Section | Existing runner | Strategy | Rationale |
|---|---|---|---|
| Reading | `components/reading/Runner.tsx` | Wrap + `submitUrl` prop | Already does timer + answers cleanly; only the URL was hard-coded |
| Listening | `components/listening/ListeningRunner.tsx` | Wrap + `submitUrl` prop | Audio status polling works as-is (same `Test` row); only submit URL changes |
| Writing | `components/writing/Runner.tsx` | Wrap + `submitUrl` prop | Same one-prop parametrisation |
| Speaking | `components/speaking/ClientSpeakingRunner.tsx` + 13 siblings | **Reuse as-is** with `mode=DIAGNOSE` discriminator at page level | The speaking runner has ~400 LOC of TRTC/VAD logic we don't want to fork; it keys off `attemptId` |
| Vocab | `components/vocab/VocabSpellRunner.tsx` | NEW lightweight | Existing runner writes `VocabProgress.mastery` (would pollute the SRS state) |
| Grammar | `components/grammar/GrammarQuizRunner.tsx` | NEW lightweight | Existing runner writes `GrammarProgress` rows (would pollute the mistakes notebook) |

The two `submitUrl` props on Reading/Listening/Writing runners are the **only** modifications to existing runner files (added in T30, commit `09a3dc2`).

### 8.4 Modifications to existing files (T35 etc.)

- `SiteHeader.tsx` — added 诊断 link with red-dot indicator when `requiredDiagnoseId !== null`.
- `ket/page.tsx`, `pet/page.tsx` — `requireUngated()` + `<GateBanner />` above the existing tile grid.
- `i18n/zh-CN.ts` — `t.diagnose.*` namespace.
- `auth.ts` — extended JWT/session callbacks.
- `lib/aiClient.ts` (commit `f34f7a1`, T16) — added `generateDiagnose()`, `analyzeDiagnose()`, `summarizeDiagnose()`.

## 9. Tests + verification

### 9.1 Vitest (apps/web)

`apps/web/src/lib/diagnose/__tests__/`:
- `week.test.ts` — DST/timezone correctness, ISO-week edge cases.
- `sectionLimits.test.ts` — per-section time limits + grace.
- `eligibility.test.ts` — pre-/post-generation states, role exemption.
- `grade.test.ts` — vocab/grammar/reading/listening grading correctness.
- `severity.test.ts` — bucket boundaries (≥3 critical, =2 moderate, =1 minor).
- `collectWrongAnswers.test.ts` — joins answers across 6 sections.
- `markComplete.test.ts` — status transition ladder.

API route tests at `apps/web/src/app/api/diagnose/me/{generate,submit}/__tests__/route.test.ts`:
- Idempotency, rate-limit (4th request within an hour → 429).
- Auth + attempt ownership.
- All-6 trigger for `/finalize` enqueue.

### 9.2 Pytest (services/ai)

`services/ai/tests/`:
- `test_diagnose_generator.py` — orchestrator dispatch + `asyncio.gather` failure handling.
- `test_diagnose_analysis.py` — prompt embedding, validator, severity computation.
- `test_diagnose_summary.py` — agent runs + 4-field shape + CJK year-boundary fix.

### 9.3 Manual QA

20-case end-to-end checklist at `docs/diagnose/manual-qa.md` (T42, this same commit). Covers cold start, normal flow, mid-week resume, force-submit, simultaneous tabs, AI failure, gate-redirect, replay, teacher exemption, perfect-score empty, etc.

## 10. What was deferred (out of v1 scope)

The following items were **explicitly out of scope** for the diagnose v2 ship and are **not implemented**. They are tracked here so the next planner doesn't have to re-derive them:

| # | Item | Why deferred | Possible future home |
|---|---|---|---|
| 1 | **Knowledge-point quests** — drillable quests auto-generated from each `KnowledgePointGroup` in the report | Pretco has this; we don't yet. Would need a `Quest` table + drill UI + completion tracking. Adds ~2 weeks of build. | Phase 5 |
| 2 | **Gamification** (XP / streaks / badges for completing diagnose) | Not in product roadmap; team wants behaviour data first to validate the gate's effect | Phase 5+ |
| 3 | **Cron-based diagnose generation** — auto-generate the next week's test on Sunday night | Currently lazy-on-view-with-button: student lands on `/diagnose` Monday morning, clicks Generate, waits ~30-45s. Acceptable for v1; may move to Sunday-night pre-warm in Phase 5 | Phase 5 |
| 4 | **TTS audio generation for listening section** — full Edge-TTS pipeline like Phase 2 listening | Listening section uses the existing Phase 2 listening generator's audio pipeline. The diagnose-listening-specific audio assembly may be partial in Phase 8 — verify in QA case 14 | Phase 8 polish |
| 5 | **Parent surface** — read-only parent view of student's weekly diagnose | Roles + auth scaffolding for `role=PARENT` doesn't exist yet | Future |
| 6 | **Per-week comparative trends** — overlay this week's report onto last week's | Would need a multi-week aggregation query + chart component. Scope creep for v1 | Phase 5 |
| 7 | **AI re-grade button** — let student request a re-grade if they think the auto-grade is wrong | Cost concern (DeepSeek bill grows linearly with re-grade requests). Defer until usage data shows complaint volume | Phase 5+ |
| 8 | **Mobile-optimised diagnose runner** | The runners inherit Phase 1-4's responsive layouts; no diagnose-specific mobile work yet | As a class-wide pass |
| 9 | **Localised English UI for international users** | App is zh-CN only by product decision (memory `feedback_ket_pet_light_theme.md`) | Not on roadmap |
| 10 | **Email notifications** — "Your weekly diagnose is ready" / "You haven't started this week's diagnose" | Notification infra doesn't exist yet | Phase 5 |

## 11. Risks + mitigations

Carried over verbatim from the plan §H.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | DeepSeek timeout during generation | M | Retry needed | `asyncio.gather` keeps wall time ≤45s; typed `failedSection` error; retry CTA on `/diagnose` hub |
| 2 | Listening audio R2 lag | M | Student waits | Existing `<GenerationProgress />` polling pattern handles |
| 3 | JWT cache stale after submit | L | Gate doesn't release | `useSession().update()` post-submit + per-page DB belt-and-suspenders |
| 4 | Cron downtime | L | No auto-submit | Client-side timer is primary auto-submit; cron is safety net for closed-tab case |
| 5 | All-6 completion race | L | Finalize runs 2× | `/finalize` is idempotent; second invocation returns cached result |
| 6 | Speaking score >90s in finalize | L | Report missing speaking | Writes error placeholder; periodic re-finalize cron (Phase 5) |
| 7 | Teacher resets diagnose row | L | Orphans | Cascade delete `WeeklyDiagnose → Test → TestAttempt` |
| 8 | Edge runtime + Prisma | M | Middleware crash | Middleware uses ONLY `req.auth` (JWT), no Prisma import |
| 9 | Student timezone shift | L | Wrong week | Server-side computation in CST; client never sends timezone |
| 10 | DIAGNOSE attempts polluting `/history` | M | Confusing UX | Filter `/history` to `kind != DIAGNOSE`; dedicated `/diagnose/history` |

## 12. Build phases + commit map

The build executed `superpowers:subagent-driven-development` across 8 phases. Each phase = one or more subagent dispatches (always Opus per memory `feedback_subagent_model_opus.md`) + spec reviewer + code quality reviewer + fix loop.

| Phase | Tasks | Key commits |
|---|---|---|
| 0 — workspace | T0 | (worktree setup, no commit) |
| 1 — foundations | T1-T4 | `c0ac90d`, `8286142`, `e83a9a6`, `7aa47cf` (+ `b4d26d3`, `5a48525` polish) |
| 2 — pure helpers | T5-T8 | `ba00a7f`, `432b041`, `c4dc411`, `a8c2b3c` |
| 3 — services/ai | T9-T15 | `236cfd8` (+ `1547690`), `0bb43d8` (+ `3978976`), `e32b26b`, `72eecf7`, `0df40b6`, `1bea71e`, `08c8bda` |
| 4 — apps/web API | T16-T25 | `f34f7a1`, `b592d34`, `14c443c`, `f711d53` (start + submit), `ff49667`, `2cc152e` (report/history/replay/teacher/cron) |
| 5 — gate enforcement | T26-T28 | `881da3f` (auth + middleware + page belt-and-suspenders) + polish in `18b06fb` |
| 6 — frontend components | T29-T35 | `09a3dc2` |
| 7 — pages | T36-T40 | `3e420c5` |
| 8 — docs + QA | T41-T45 | (this commit) |

## 13. References

- **Plan source of truth**: `~/.claude/plans/shiny-gathering-fountain.md`
- **Pretco reference**: `C:\Users\wul82\Desktop\英语AB级\pretco-app\src\lib\diagnostic-analysis.ts:201-282` (analysis prompt) + `:411-552` (wrong-answer collection)
- **Phase 4 merge baseline**: `863f2f5` on `main` (2026-04-26)
- **CJK regex commentary**: `services/ai/app/validators/diagnose.py:43-49`
- **Schema migration**: `apps/web/prisma/migrations/20260427_add_weekly_diagnose/migration.sql`
- **Edge middleware**: `apps/web/middleware.ts`
- **Gate-helper module**: `apps/web/src/lib/diagnose/eligibility.ts`
- **Manual QA checklist**: `docs/diagnose/manual-qa.md`

## Appendix A — File inventory created in this build

### Schema + migrations
- `apps/web/prisma/migrations/20260427_add_weekly_diagnose/migration.sql`

### apps/web TypeScript
- `apps/web/src/lib/diagnose/week.ts` + `__tests__/week.test.ts`
- `apps/web/src/lib/diagnose/eligibility.ts` + `__tests__/eligibility.test.ts`
- `apps/web/src/lib/diagnose/sectionLimits.ts` + `__tests__/sectionLimits.test.ts`
- `apps/web/src/lib/diagnose/grade.ts` + `__tests__/grade.test.ts`
- `apps/web/src/lib/diagnose/collectWrongAnswers.ts` + `__tests__/collectWrongAnswers.test.ts`
- `apps/web/src/lib/diagnose/severity.ts` + `__tests__/severity.test.ts`
- `apps/web/src/lib/diagnose/types.ts`
- `apps/web/src/lib/diagnose/markComplete.ts` + `__tests__/markComplete.test.ts`
- `apps/web/src/lib/cron/diagnose-expired.ts` + `__tests__/diagnose-expired.test.ts`
- `apps/web/middleware.ts`

### apps/web pages (7)
- `apps/web/src/app/diagnose/page.tsx`
- `apps/web/src/app/diagnose/GenerateButton.tsx`
- `apps/web/src/app/diagnose/runner/[section]/page.tsx`
- `apps/web/src/app/diagnose/report/[testId]/page.tsx`
- `apps/web/src/app/diagnose/history/page.tsx`
- `apps/web/src/app/diagnose/history/[testId]/page.tsx`
- `apps/web/src/app/diagnose/replay/[testId]/[section]/page.tsx`
- `apps/web/src/app/teacher/classes/[classId]/diagnose-status/page.tsx`

### apps/web API routes (10)
- `apps/web/src/app/api/diagnose/me/current/route.ts`
- `apps/web/src/app/api/diagnose/me/generate/route.ts` + `__tests__/route.test.ts`
- `apps/web/src/app/api/diagnose/me/section/[sectionKind]/start/route.ts`
- `apps/web/src/app/api/diagnose/me/section/[sectionKind]/submit/route.ts` + `__tests__/route.test.ts`
- `apps/web/src/app/api/diagnose/me/finalize/route.ts`
- `apps/web/src/app/api/diagnose/me/report/[testId]/route.ts`
- `apps/web/src/app/api/diagnose/history/route.ts`
- `apps/web/src/app/api/diagnose/replay/route.ts`
- `apps/web/src/app/api/cron/diagnose-force-submit-expired/route.ts`
- `apps/web/src/app/api/teacher/diagnose-status/route.ts`

### apps/web components (11)
- `apps/web/src/components/diagnose/DiagnoseHub.tsx`
- `apps/web/src/components/diagnose/SectionStatusCard.tsx`
- `apps/web/src/components/diagnose/DiagnoseRunnerReading.tsx`
- `apps/web/src/components/diagnose/DiagnoseRunnerListening.tsx`
- `apps/web/src/components/diagnose/DiagnoseRunnerWriting.tsx`
- `apps/web/src/components/diagnose/DiagnoseRunnerVocab.tsx`
- `apps/web/src/components/diagnose/DiagnoseRunnerGrammar.tsx`
- `apps/web/src/components/diagnose/DiagnoseReport.tsx`
- `apps/web/src/components/diagnose/KnowledgePointCluster.tsx`
- `apps/web/src/components/diagnose/HistoryList.tsx`
- `apps/web/src/components/diagnose/GateBanner.tsx`

### services/ai
- `services/ai/app/agents/diagnose_generator.py`
- `services/ai/app/agents/diagnose_analysis.py`
- `services/ai/app/agents/diagnose_summary.py`
- `services/ai/app/prompts/diagnose_analysis.py`
- `services/ai/app/prompts/diagnose_summary.py`
- `services/ai/app/schemas/diagnose.py`
- `services/ai/app/validators/diagnose.py`
- `services/ai/tests/test_diagnose_generator.py`
- `services/ai/tests/test_diagnose_analysis.py`
- `services/ai/tests/test_diagnose_summary.py`

### Docs
- `docs/superpowers/specs/2026-04-26-diagnose-design.md` (this file)
- `docs/diagnose/manual-qa.md`

### Modifications (key files)
- `apps/web/prisma/schema.prisma` — `TestKind.DIAGNOSE` + 2 enums + `WeeklyDiagnose` + back-relations
- `apps/web/src/lib/auth.ts` — extended `jwt`/`session` callbacks for `requiredDiagnoseId`
- `apps/web/src/lib/aiClient.ts` — added 3 client functions
- `apps/web/src/components/SiteHeader.tsx` — 诊断 link + red-dot indicator
- `apps/web/src/components/listening/ListeningRunner.tsx` — `submitUrl` prop
- `apps/web/src/components/reading/Runner.tsx` — `submitUrl` prop
- `apps/web/src/components/writing/Runner.tsx` — `submitUrl` prop
- `apps/web/src/app/ket/page.tsx` — `requireUngated()` + `<GateBanner />`
- `apps/web/src/app/pet/page.tsx` — same
- `apps/web/src/i18n/zh-CN.ts` — `t.diagnose.*` namespace
- `services/ai/app/main.py` — register 3 new endpoints
