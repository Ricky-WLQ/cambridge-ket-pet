# Phase 3 — Speaking (Akool + Mina) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a live conversational Speaking module (KET + PET) where a student practises spoken English with an AI Cambridge examiner named Mina, streamed as a photorealistic avatar via Akool over TRTC, powered by our DeepSeek examiner brain, and post-hoc scored against the four Cambridge rubric criteria.

**Architecture:** Browser connects to Akool's streaming avatar over Tencent TRTC (China-reachable WebRTC). Akool handles STT + TTS + VAD + lipsync of the Mina avatar. Our backend owns the LLM: Akool's `stream-message` event delivers the student's transcribed turn to the client, the client POSTs it to our Next.js `/api/speaking/[attemptId]/reply`, which fans out to the existing Python `services/ai` FastAPI running DeepSeek, returns a cleaned ≤40-word reply with `[[PART:N]]` / `[[SESSION_END]]` sentinels stripped into flags, and the client pushes the reply back over the TRTC data channel so Akool TTS-es and lipsyncs it on Mina. At session end, we submit a reconciled transcript (server-side `/reply` log as canonical + client `stream-message` buffer as backup), score asynchronously, and render rubric + weak points on a result page. Avatar `mode_type: 1` (Retelling) and `voice_params.turn_detection` are pinned at session-create time — no runtime round-trip for VAD or mode.

**Tech Stack:**
- **Next.js 16** (`apps/web`) with Turbopack, React 19, TypeScript, Vitest for unit/integration, Prisma ORM on Postgres 16 (`ketpet-postgres` Docker container on port 5432)
- **Python FastAPI** (`services/ai`, uvicorn port 8001) with Pydantic AI + DeepSeek, pytest for tests
- **Akool streaming-avatar API** (`https://openapi.akool.com/api/open/v4/liveAvatar/*`) with `stream_type: "trtc"`
- **Tencent TRTC Web SDK v5** (`trtc-sdk-v5` npm package) for browser WebRTC transport
- **Cloudflare R2** (`@aws-sdk/client-s3`) for photo-prompt asset library, bucket `cambridge-ket-pet-audio` (re-used from Phase 2, adds `speaking/photos/` prefix)
- **Auth.js v5** for session + RBAC (unchanged from Phase 1/2)

**Spec of record:** `docs/superpowers/specs/2026-04-24-phase3-speaking-design.md` (commit `4864117` on branch `phase3-speaking`).

---

## File Structure

### Create

**Prisma**
- `apps/web/prisma/migrations/<timestamp>_add_speaking/migration.sql` — generated migration adding `SpeakingStatus` enum, `speakingPrompts` / `speakingPhotoKeys` / `speakingPersona` on `Test`, `transcript` / `rubricScores` / `akoolSessionId` / `speakingStatus` / `speakingError` on `TestAttempt`

**Python (services/ai/app/)**
- `schemas/speaking.py` — Pydantic models: `SpeakingPrompts`, `SpeakingPromptPart`, `SpeakingTurn`, `SpeakingExaminerReply`, `SpeakingScore`, `SpeakingWeakPoint`
- `validators/speaking.py` — Reply length cap, sentinel parsing, script coherence checks
- `prompts/speaking_generator_system.py` — System-prompt constant for generator
- `prompts/speaking_examiner_system.py` — System-prompt constant for examiner (with sentinel instructions)
- `prompts/speaking_scorer_system.py` — System-prompt constant for scorer
- `agents/speaking_generator.py` — Pydantic AI agent → `SpeakingPrompts`
- `agents/speaking_examiner.py` — Non-streaming turn handler → `SpeakingExaminerReply`
- `agents/speaking_scorer.py` — Scorer agent → `SpeakingScore` + `weakPoints`
- `tests/test_speaking_schemas.py`, `tests/test_speaking_validators.py`, `tests/test_speaking_generator.py`, `tests/test_speaking_examiner.py`, `tests/test_speaking_scorer.py`, `tests/test_speaking_routes.py`

**Next.js server lib (apps/web/src/lib/speaking/)**
- `akool-client.ts` — server-only: `getAkoolToken` (in-memory cache), `createAkoolSession`, `closeAkoolSession`
- `persona-config.ts` — compose examiner system prompt per attempt
- `photo-library.ts` — curated R2 photo registry + picker by level + topic tag
- `session-state.ts` — sentinel parser, part inference (shared by `/reply` server route + client runner)
- `transcript-reconciler.ts` — merge server `/reply` buffer + client `stream-message` backup
- `turn-buffer.ts` — in-memory per-attempt turn log (server-side canonical)
- `scoring-client.ts` — thin wrapper calling `services/ai` `/speaking/score`
- `__tests__/akool-client.test.ts`, `session-state.test.ts`, `transcript-reconciler.test.ts`, `turn-buffer.test.ts`, `persona-config.test.ts`

**Next.js client lib (apps/web/src/lib/speaking/)**
- `trtc-client.ts` — client-only wrapper around `trtc-sdk-v5`: join, subscribe to remote tracks, publish mic, send/receive custom messages, interrupt
- `client-transcript-buffer.ts` — client-side `stream-message` capture for the submit-time backup

**Next.js API routes (apps/web/src/app/api/speaking/)**
- `tests/generate/route.ts` — POST: generate speaking test + attempt (rate-limited)
- `[attemptId]/session/route.ts` — POST: create Akool session, return TRTC creds
- `[attemptId]/reply/route.ts` — POST: BYO-LLM turn handler
- `[attemptId]/submit/route.ts` — POST: finalize attempt, reconcile transcript, fire scoring
- `[attemptId]/status/route.ts` — GET: poll scoring status
- `__tests__/generate.test.ts`, `session.test.ts`, `reply.test.ts`, `submit.test.ts`, `status.test.ts`

**Next.js pages (apps/web/src/app/)**
- `ket/speaking/new/page.tsx`, `ket/speaking/runner/[attemptId]/page.tsx`, `ket/speaking/result/[attemptId]/page.tsx`
- `pet/speaking/new/page.tsx`, `pet/speaking/runner/[attemptId]/page.tsx`, `pet/speaking/result/[attemptId]/page.tsx`

**Next.js components (apps/web/src/components/speaking/)**
- `SpeakingRunner.tsx` — orchestrator: state machine, TRTC lifecycle, turn loop
- `MinaAvatarPanel.tsx` — hosts the TRTC remote video track
- `PhotoPanel.tsx` — photo-prompt display (fade in/out on part change)
- `PartProgressBar.tsx` — "Part X of N" indicator
- `StatusPill.tsx` — connecting/listening/thinking/speaking
- `MicPermissionGate.tsx` — pre-flight mic permission UI
- `ConnectionTest.tsx` — `TRTC.checkSystemRequirements()` wrapper
- `SpeakingResult.tsx` — result page layout
- `RubricBar.tsx` — single-criterion progress bar with label
- `TranscriptViewer.tsx` — collapsible transcript pane (reused on teacher views)
- `SpeakingNewPage.tsx` — pre-flight page inner content (shared by /ket and /pet)

**Seeds + scripts (apps/web/scripts/)**
- `seed-speaking-photos.ts` — upload ~50 tagged photos to R2
- `akool-smoke-test.mjs` — manual smoke test for token + session-create

**Docs**
- `docs/superpowers/specs/phase3-speaking-manual-test.md` — manual QA checklist for end-to-end verification

### Modify

- `apps/web/prisma/schema.prisma` — enum + field additions on `Test` and `TestAttempt`
- `apps/web/.env` — (already contains `AKOOL_*` creds from spec-pivot commit; leave blank fields for avatar/voice)
- `apps/web/.env.example` — document new env slots
- `apps/web/src/app/ket/page.tsx`, `apps/web/src/app/pet/page.tsx` — add Speaking tile
- `apps/web/src/app/history/page.tsx` — include SPEAKING attempts
- `apps/web/src/app/class/[classId]/page.tsx` — include SPEAKING in teacher aggregates
- `apps/web/src/app/class/[classId]/student/[studentId]/page.tsx` — render speaking transcript
- `apps/web/src/lib/rate-limit.ts` (or equivalent existing Phase 2 rate-limiter) — add `SPEAKING_ATTEMPT` kind with default 3/24h
- `services/ai/app/main.py` — add `/speaking/generate`, `/speaking/examiner`, `/speaking/examiner-warmup`, `/speaking/score` routes
- `services/ai/app/__init__.py` — export new agents if following Phase 1/2 convention
- `apps/web/package.json` — add `trtc-sdk-v5` dependency (approx `^5.10.0`)

### Delete

- None. `DASHSCOPE_API_KEY` was already removed in an earlier Phase 2 cleanup per spec §8.

---

## Conventions for this plan

- **TDD cycle per task:** write failing test → run to observe failure → implement minimal code → run to observe pass → commit.
- **Commit per task** unless otherwise noted. Message format matches Phase 2: `<type>(<scope>): <subject>` (e.g. `feat(speaking): add akool-client token cache`).
- **Verification between tasks:** after every commit, run the relevant test suite AND `pnpm --filter @apps/web typecheck` (or `ruff + pytest` on the Python side). Only move to the next task on green.
- **Run three services locally for browser tests** (from memory / Phase 2 runbook):
  1. `docker compose -f C:/Users/wul82/Desktop/cambridge-ket-pet/docker-compose.yml up -d`
  2. `cd services/ai && source .venv/Scripts/activate && uvicorn app.main:app --host 0.0.0.0 --port 8001`
  3. `cd apps/web && pnpm dev`
- **Environment invariant:** `apps/web/.env` already contains real `AKOOL_CLIENT_ID` / `AKOOL_CLIENT_SECRET` and `AKOOL_STREAM_TYPE=trtc`. `AKOOL_AVATAR_ID` / `AKOOL_VOICE_ID` remain blank until Task 8.
- **Branch:** all work lands on `phase3-speaking`. No push until the user explicitly asks.

---

# Phase A — Data model + seeds

## Task 1: Prisma migration — `SpeakingStatus` enum + speaking fields

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/<timestamp>_add_speaking/migration.sql` (generated by `prisma migrate dev`)

- [ ] **Step 1.1: Edit `prisma/schema.prisma` to add enum + fields**

In `apps/web/prisma/schema.prisma`, add this enum near the existing `AttemptStatus` enum (around line 48):

```prisma
enum SpeakingStatus {
  IDLE
  IN_PROGRESS
  SUBMITTED
  SCORING
  SCORED
  FAILED
}
```

Extend the `Test` model (around line 196) by adding these fields immediately after the Phase 2 listening block:

```prisma
  // Phase 3 Speaking — per-test script + photo prompts + level tag
  speakingPrompts   Json?
  speakingPhotoKeys String[]
  speakingPersona   String?   // "KET" | "PET"
```

Extend the `TestAttempt` model (around line 226) by adding these fields after `weakPoints`:

```prisma
  // Phase 3 Speaking
  transcript       Json?
  rubricScores     Json?
  akoolSessionId   String?
  speakingStatus   SpeakingStatus?
  speakingError    String?
```

- [ ] **Step 1.2: Generate + apply the migration locally**

Ensure Postgres is up: `docker compose -f C:/Users/wul82/Desktop/cambridge-ket-pet/docker-compose.yml up -d`.

Run:
```bash
cd apps/web
pnpm prisma migrate dev --name add_speaking
```

Expected: prisma creates a new migration directory named like `20260425NNNNNN_add_speaking/` containing `migration.sql`. Output ends with `Your database is now in sync with your schema.`

- [ ] **Step 1.3: Regenerate Prisma Client + typecheck**

Run:
```bash
cd apps/web
pnpm prisma generate
pnpm typecheck
```

Expected: `prisma generate` writes client, `typecheck` exits 0 (no TS errors — we haven't used the new fields yet, but the generated types must compile).

- [ ] **Step 1.4: Smoke-check the migration with a direct psql round-trip**

Run:
```bash
docker exec -i ketpet-postgres psql -U postgres -d ketpet -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='TestAttempt' AND column_name IN ('transcript','rubricScores','akoolSessionId','speakingStatus','speakingError') ORDER BY column_name;"
```

Expected output (order may vary):
```
  column_name    | data_type
-----------------+-----------
 akoolSessionId  | text
 rubricScores    | jsonb
 speakingError   | text
 speakingStatus  | USER-DEFINED
 transcript      | jsonb
(5 rows)
```

Also verify `Test` columns:
```bash
docker exec -i ketpet-postgres psql -U postgres -d ketpet -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Test' AND column_name IN ('speakingPrompts','speakingPhotoKeys','speakingPersona') ORDER BY column_name;"
```

Expected:
```
   column_name     | data_type
-------------------+-----------
 speakingPersona   | text
 speakingPhotoKeys | ARRAY
 speakingPrompts   | jsonb
(3 rows)
```

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations
git commit -m "feat(speaking): add SpeakingStatus enum + speaking fields to Test/TestAttempt"
```

---

## Task 2: Photo library seeding

Curated R2 library of ~50 tagged photos lives under `speaking/photos/` in the existing `cambridge-ket-pet-audio` bucket. We ship a seed script that uploads locally-stored photos with tag-based filenames, plus a lookup helper.

**Files:**
- Create: `apps/web/scripts/seed-speaking-photos.ts`
- Create: `apps/web/src/lib/speaking/photo-library.ts`
- Create: `apps/web/src/lib/speaking/__tests__/photo-library.test.ts`
- Create: `apps/web/prisma/data/speaking-photos/` (local staging for source images; gitignored except for a manifest `.json`)
- Modify: `apps/web/.gitignore` — add `prisma/data/speaking-photos/*.jpg`, `*.png`, `*.webp` to avoid bloating the repo; keep `manifest.json`
- Modify: `apps/web/package.json` — add script `"seed:speaking-photos": "tsx scripts/seed-speaking-photos.ts"`

- [ ] **Step 2.1: Write the photo-library picker unit test FIRST**

Create `apps/web/src/lib/speaking/__tests__/photo-library.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickPhotoKeys, PHOTO_LIBRARY_MANIFEST } from "../photo-library";

describe("photo-library", () => {
  it("returns N distinct keys tagged with the requested topic", () => {
    const keys = pickPhotoKeys({ level: "KET", topic: "daily-life", count: 2 });
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    for (const k of keys) {
      const entry = PHOTO_LIBRARY_MANIFEST.find((p) => p.key === k);
      expect(entry).toBeDefined();
      expect(entry!.tags).toContain("daily-life");
      expect(entry!.levels).toContain("KET");
    }
  });

  it("falls back to any photo for the level when topic has too few matches", () => {
    const keys = pickPhotoKeys({ level: "PET", topic: "nonexistent-topic", count: 3 });
    expect(keys).toHaveLength(3);
    for (const k of keys) {
      const entry = PHOTO_LIBRARY_MANIFEST.find((p) => p.key === k);
      expect(entry!.levels).toContain("PET");
    }
  });

  it("throws when the manifest has fewer than `count` entries for the level", () => {
    expect(() => pickPhotoKeys({ level: "KET", topic: "anything", count: 999 })).toThrow(
      /not enough photos/i,
    );
  });
});
```

- [ ] **Step 2.2: Run the test and verify it fails**

Run:
```bash
cd apps/web
pnpm vitest run src/lib/speaking/__tests__/photo-library.test.ts
```

Expected: test file resolves but fails because `photo-library.ts` does not exist yet. Error: `Cannot find module '../photo-library'`.

- [ ] **Step 2.3: Implement the photo library**

Create `apps/web/src/lib/speaking/photo-library.ts`:

```typescript
/**
 * Curated R2 photo library for Phase 3 Speaking Part 2 prompts.
 * The manifest is bundled at build time (no R2 round-trip for lookup);
 * the underlying JPEGs are uploaded once by scripts/seed-speaking-photos.ts.
 */

export type SpeakingPhotoLevel = "KET" | "PET";

export interface SpeakingPhotoEntry {
  key: string;
  levels: SpeakingPhotoLevel[];
  tags: string[];
  description: string;
}

export const PHOTO_LIBRARY_MANIFEST: readonly SpeakingPhotoEntry[] = [
  // --- KET-weighted (daily-life, family, school, hobbies, food, travel-short) ---
  { key: "speaking/photos/daily-life-01.jpg", levels: ["KET"], tags: ["daily-life", "kitchen"], description: "A family eating breakfast together at a kitchen table." },
  { key: "speaking/photos/daily-life-02.jpg", levels: ["KET"], tags: ["daily-life", "market"], description: "A customer buying fresh fruit at a local market stall." },
  { key: "speaking/photos/family-01.jpg", levels: ["KET"], tags: ["family", "outdoors"], description: "Three generations of a family walking in a park." },
  { key: "speaking/photos/school-01.jpg", levels: ["KET"], tags: ["school", "classroom"], description: "Primary-school students raising hands in a classroom." },
  { key: "speaking/photos/school-02.jpg", levels: ["KET"], tags: ["school", "library"], description: "A student reading at a school library table." },
  { key: "speaking/photos/hobbies-01.jpg", levels: ["KET"], tags: ["hobbies", "sports"], description: "A teenager practising basketball on an outdoor court." },
  { key: "speaking/photos/hobbies-02.jpg", levels: ["KET"], tags: ["hobbies", "music"], description: "A boy playing an acoustic guitar at home." },
  { key: "speaking/photos/hobbies-03.jpg", levels: ["KET"], tags: ["hobbies", "art"], description: "A girl painting a watercolour on an easel." },
  { key: "speaking/photos/food-01.jpg", levels: ["KET", "PET"], tags: ["food", "cafe"], description: "Friends sharing dessert at a cafe window seat." },
  { key: "speaking/photos/food-02.jpg", levels: ["KET"], tags: ["food", "cooking"], description: "Parent and child cooking pasta together in a home kitchen." },
  { key: "speaking/photos/travel-01.jpg", levels: ["KET", "PET"], tags: ["travel", "beach"], description: "Tourists walking along a sandy beach at sunset." },
  { key: "speaking/photos/travel-02.jpg", levels: ["KET"], tags: ["travel", "city"], description: "A small group taking photos in front of a city landmark." },
  { key: "speaking/photos/pets-01.jpg", levels: ["KET"], tags: ["pets", "home"], description: "A child playing with a golden retriever in a living room." },
  { key: "speaking/photos/shopping-01.jpg", levels: ["KET"], tags: ["shopping", "clothes"], description: "Two teenagers choosing T-shirts in a clothing store." },
  { key: "speaking/photos/weather-01.jpg", levels: ["KET"], tags: ["weather", "rain"], description: "People holding umbrellas while walking on a rainy street." },

  // --- KET + PET shared (balanced) ---
  { key: "speaking/photos/park-01.jpg", levels: ["KET", "PET"], tags: ["park", "daily-life"], description: "Joggers and dog-walkers on a tree-lined park path." },
  { key: "speaking/photos/park-02.jpg", levels: ["KET", "PET"], tags: ["park", "family"], description: "A family having a picnic on a grassy hillside." },
  { key: "speaking/photos/park-03.jpg", levels: ["KET", "PET"], tags: ["park", "hobbies"], description: "An elderly couple playing chess at a park table." },
  { key: "speaking/photos/transport-01.jpg", levels: ["KET", "PET"], tags: ["transport", "city"], description: "Commuters waiting at a busy subway platform." },
  { key: "speaking/photos/transport-02.jpg", levels: ["KET", "PET"], tags: ["transport", "bicycle"], description: "Cyclists riding in a dedicated bike lane through a city." },
  { key: "speaking/photos/work-01.jpg", levels: ["PET"], tags: ["work", "office"], description: "Colleagues collaborating over a laptop in an open-plan office." },
  { key: "speaking/photos/work-02.jpg", levels: ["PET"], tags: ["work", "hands-on"], description: "A chef plating dishes at a restaurant pass." },

  // --- PET-weighted (choices, opinions, collaboration scenarios) ---
  { key: "speaking/photos/choice-gifts-01.jpg", levels: ["PET"], tags: ["collaborative", "gifts"], description: "Four different birthday gifts arranged on a table: book, headphones, scarf, plant." },
  { key: "speaking/photos/choice-gifts-02.jpg", levels: ["PET"], tags: ["collaborative", "gifts"], description: "Four different graduation gifts arranged on a desk: watch, wallet, camera, voucher." },
  { key: "speaking/photos/choice-trip-01.jpg", levels: ["PET"], tags: ["collaborative", "travel"], description: "Four holiday-option postcards: beach, mountain, city, countryside." },
  { key: "speaking/photos/choice-weekend-01.jpg", levels: ["PET"], tags: ["collaborative", "free-time"], description: "Four weekend-activity icons: cinema, museum, hiking, shopping." },
  { key: "speaking/photos/choice-club-01.jpg", levels: ["PET"], tags: ["collaborative", "school"], description: "Four after-school club posters: drama, coding, football, environment." },
  { key: "speaking/photos/choice-food-01.jpg", levels: ["PET"], tags: ["collaborative", "food"], description: "Four lunch-option photos: salad, sandwich, noodles, rice bowl." },
  { key: "speaking/photos/opinion-tech-01.jpg", levels: ["PET"], tags: ["opinion", "technology"], description: "Teenagers using smartphones at a coffee shop, laptops closed." },
  { key: "speaking/photos/opinion-environment-01.jpg", levels: ["PET"], tags: ["opinion", "environment"], description: "Volunteers sorting recyclables at a community drop-off centre." },
  { key: "speaking/photos/opinion-health-01.jpg", levels: ["PET"], tags: ["opinion", "health"], description: "A group taking an outdoor fitness class in a park." },
  { key: "speaking/photos/opinion-media-01.jpg", levels: ["PET"], tags: ["opinion", "media"], description: "A family watching a film together on a home TV." },
  { key: "speaking/photos/opinion-learning-01.jpg", levels: ["PET"], tags: ["opinion", "education"], description: "Students attending an online class from their bedrooms." },

  // --- Extra PET depth (doubles up capacity on common topic tags) ---
  { key: "speaking/photos/work-03.jpg", levels: ["PET"], tags: ["work", "creative"], description: "A designer sketching on a drawing tablet at a home studio." },
  { key: "speaking/photos/travel-03.jpg", levels: ["PET"], tags: ["travel", "airport"], description: "Passengers queuing at an airport check-in counter with luggage." },
  { key: "speaking/photos/travel-04.jpg", levels: ["PET"], tags: ["travel", "mountain"], description: "Hikers resting on a ridge overlooking a mountain valley." },
  { key: "speaking/photos/city-01.jpg", levels: ["PET"], tags: ["city", "evening"], description: "Pedestrians on a busy downtown street at dusk." },
  { key: "speaking/photos/city-02.jpg", levels: ["PET"], tags: ["city", "market"], description: "A night market with food stalls and crowds." },
  { key: "speaking/photos/sports-01.jpg", levels: ["PET"], tags: ["sports", "team"], description: "A youth football team celebrating a goal." },
  { key: "speaking/photos/sports-02.jpg", levels: ["PET"], tags: ["sports", "individual"], description: "A swimmer mid-stroke in an outdoor pool." },
  { key: "speaking/photos/volunteer-01.jpg", levels: ["PET"], tags: ["community", "volunteer"], description: "Volunteers serving meals at a community kitchen." },
  { key: "speaking/photos/home-01.jpg", levels: ["KET", "PET"], tags: ["home", "living-room"], description: "A modern living room with a reading nook." },
  { key: "speaking/photos/home-02.jpg", levels: ["KET", "PET"], tags: ["home", "bedroom"], description: "A teenager's bedroom decorated with posters and books." },
  { key: "speaking/photos/event-01.jpg", levels: ["PET"], tags: ["event", "concert"], description: "An outdoor summer concert with a cheering crowd." },
  { key: "speaking/photos/event-02.jpg", levels: ["PET"], tags: ["event", "festival"], description: "A local food festival with stalls and families sitting on benches." },
  { key: "speaking/photos/nature-01.jpg", levels: ["PET"], tags: ["nature", "forest"], description: "Sunlight through pine trees in a quiet forest clearing." },
  { key: "speaking/photos/nature-02.jpg", levels: ["PET"], tags: ["nature", "river"], description: "People kayaking on a calm river at midday." },
  { key: "speaking/photos/reading-01.jpg", levels: ["KET", "PET"], tags: ["reading", "library"], description: "A reader absorbed in a book at a public library." },
  { key: "speaking/photos/technology-01.jpg", levels: ["KET", "PET"], tags: ["technology", "home"], description: "A family video-calling grandparents from a kitchen laptop." },
];

function filterByLevel(level: SpeakingPhotoLevel): SpeakingPhotoEntry[] {
  return PHOTO_LIBRARY_MANIFEST.filter((p) => p.levels.includes(level));
}

export function pickPhotoKeys(args: {
  level: SpeakingPhotoLevel;
  topic?: string;
  count: number;
  seed?: number;
}): string[] {
  const { level, topic, count } = args;
  const byLevel = filterByLevel(level);
  if (byLevel.length < count) {
    throw new Error(
      `photo-library: not enough photos for level ${level} (have ${byLevel.length}, need ${count})`,
    );
  }

  const candidates = topic
    ? byLevel.filter((p) => p.tags.includes(topic))
    : byLevel;

  // Fallback to any-level entries if the topic bucket is too small.
  const pool = candidates.length >= count ? candidates : byLevel;

  // Deterministic, seed-lite shuffle so tests are reproducible when a seed is passed.
  const rng = args.seed != null
    ? mulberry32(args.seed)
    : Math.random;
  const shuffled = [...pool].sort(() => rng() - 0.5);

  return shuffled.slice(0, count).map((p) => p.key);
}

/** Tiny deterministic PRNG for seeded shuffles in tests. */
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2.4: Run the test and verify it passes**

```bash
cd apps/web
pnpm vitest run src/lib/speaking/__tests__/photo-library.test.ts
```

Expected: 3 tests pass. If the "not enough photos" test fails because we pass `count: 999` and the manifest has fewer entries for KET than that, the error is raised correctly.

- [ ] **Step 2.5: Implement the R2 seed script**

Create `apps/web/scripts/seed-speaking-photos.ts`:

```typescript
/**
 * One-shot seed: uploads local JPEG/PNG/WebP photos to R2 under the
 * speaking/photos/ prefix using the bucket credentials already wired
 * for Phase 2. Idempotent — skips objects that already exist.
 *
 * Source images live in apps/web/prisma/data/speaking-photos/<key-basename>.jpg
 * Run: pnpm seed:speaking-photos
 */

import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  PHOTO_LIBRARY_MANIFEST,
  type SpeakingPhotoEntry,
} from "../src/lib/speaking/photo-library";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
};

const s3 = new S3Client({
  region: "auto",
  endpoint: required("R2_ENDPOINT"),
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});
const BUCKET = required("R2_BUCKET");

const SOURCE_DIR = join(__dirname, "..", "prisma", "data", "speaking-photos");

function contentType(key: string): string {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function alreadyUploaded(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function uploadOne(entry: SpeakingPhotoEntry): Promise<"uploaded" | "skipped" | "missing"> {
  const basename = entry.key.split("/").pop()!;
  const localPath = join(SOURCE_DIR, basename);

  if (!existsSync(localPath)) return "missing";
  const size = (await stat(localPath)).size;
  if (size === 0) return "missing";

  if (await alreadyUploaded(entry.key)) return "skipped";

  const body = await readFile(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: entry.key,
      Body: body,
      ContentType: contentType(entry.key),
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        levels: entry.levels.join(","),
        tags: entry.tags.join(","),
      },
    }),
  );
  return "uploaded";
}

async function main() {
  let uploaded = 0,
    skipped = 0,
    missing = 0;
  const missingKeys: string[] = [];

  for (const entry of PHOTO_LIBRARY_MANIFEST) {
    const result = await uploadOne(entry);
    if (result === "uploaded") uploaded++;
    else if (result === "skipped") skipped++;
    else {
      missing++;
      missingKeys.push(entry.key);
    }
  }

  console.log(
    `Photo seed done: uploaded=${uploaded} skipped=${skipped} missing=${missing}`,
  );
  if (missing > 0) {
    console.log("Missing source files (drop JPEGs with these basenames into",
      "apps/web/prisma/data/speaking-photos/ then re-run):");
    for (const k of missingKeys) console.log("  ", k.split("/").pop());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2.6: Add script entry + gitignore lines**

Modify `apps/web/package.json` — in `"scripts"`:

```json
"seed:speaking-photos": "tsx scripts/seed-speaking-photos.ts"
```

Add to `apps/web/.gitignore`:

```
# Phase 3 Speaking — source images staging (JPEG/PNG/WebP only; manifest.json tracked)
prisma/data/speaking-photos/*.jpg
prisma/data/speaking-photos/*.jpeg
prisma/data/speaking-photos/*.png
prisma/data/speaking-photos/*.webp
```

Create the staging directory + a placeholder manifest so the directory is tracked:

```bash
mkdir -p apps/web/prisma/data/speaking-photos
```

Create `apps/web/prisma/data/speaking-photos/manifest.json` with:

```json
{
  "note": "Drop JPEGs/PNGs/WebPs here with basenames matching the keys in src/lib/speaking/photo-library.ts (e.g. daily-life-01.jpg). Run `pnpm seed:speaking-photos` to upload to R2.",
  "source": "curated stock library — pick images you have license to use; spec §2.2 defers AI generation",
  "target_count": 50,
  "last_updated": "2026-04-25"
}
```

- [ ] **Step 2.7: Run typecheck + tests**

```bash
cd apps/web
pnpm typecheck
pnpm vitest run src/lib/speaking/__tests__/photo-library.test.ts
```

Expected: typecheck exits 0; 3 tests pass.

- [ ] **Step 2.8: Commit (without actual image files — user seeds photos out-of-band)**

```bash
git add apps/web/src/lib/speaking/photo-library.ts \
        apps/web/src/lib/speaking/__tests__/photo-library.test.ts \
        apps/web/scripts/seed-speaking-photos.ts \
        apps/web/prisma/data/speaking-photos/manifest.json \
        apps/web/.gitignore \
        apps/web/package.json
git commit -m "feat(speaking): add photo-library manifest + R2 seed script"
```

**Note for operator:** the actual JPEGs are dropped into `apps/web/prisma/data/speaking-photos/` out-of-band (the operator/user supplies license-cleared stock). Running `pnpm seed:speaking-photos` is a one-shot before Task 14's first browser test. The script is idempotent.

---

## Task 3: Python — speaking schemas + validators

**Files:**
- Create: `services/ai/app/schemas/speaking.py`
- Create: `services/ai/app/validators/speaking.py`
- Create: `services/ai/tests/test_speaking_schemas.py`
- Create: `services/ai/tests/test_speaking_validators.py`

- [ ] **Step 3.1: Write failing tests for the schemas**

Create `services/ai/tests/test_speaking_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.speaking import (
    SpeakingPrompts,
    SpeakingPromptPart,
    SpeakingTurn,
    SpeakingExaminerReply,
    SpeakingScore,
    SpeakingWeakPoint,
)


def _valid_part(partNumber: int = 1, photoKey: str | None = None) -> dict:
    return {
        "partNumber": partNumber,
        "title": "Interview",
        "targetMinutes": 2,
        "examinerScript": ["What's your name?", "Where do you live?"],
        "coachingHints": "Encourage full sentences.",
        "photoKey": photoKey,
    }


class TestSpeakingPrompts:
    def test_happy_path(self):
        p = SpeakingPrompts(
            level="KET",
            initialGreeting="Hello, I'm Mina.",
            parts=[_valid_part(1), _valid_part(2, photoKey="speaking/photos/park-01.jpg")],
        )
        assert p.level == "KET"
        assert len(p.parts) == 2
        assert p.parts[1].photoKey == "speaking/photos/park-01.jpg"

    def test_rejects_unknown_level(self):
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="IELTS", initialGreeting="Hi", parts=[_valid_part()])

    def test_rejects_empty_parts(self):
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="KET", initialGreeting="Hi", parts=[])

    def test_rejects_empty_examiner_script(self):
        bad = _valid_part()
        bad["examinerScript"] = []
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="KET", initialGreeting="Hi", parts=[bad])


class TestSpeakingTurn:
    def test_user_turn(self):
        t = SpeakingTurn(role="user", content="My name is Li Wei.", part=1)
        assert t.role == "user"

    def test_rejects_unknown_role(self):
        with pytest.raises(ValidationError):
            SpeakingTurn(role="system", content="x", part=1)


class TestSpeakingExaminerReply:
    def test_happy_path(self):
        r = SpeakingExaminerReply(
            reply="Nice to meet you. Where do you live?",
            advancePart=None,
            sessionEnd=False,
        )
        assert r.sessionEnd is False

    def test_reply_length_enforced(self):
        # 40 words is the cap (spec §12). >40 should fail validation.
        too_long = " ".join(["word"] * 80)
        with pytest.raises(ValidationError):
            SpeakingExaminerReply(reply=too_long, advancePart=None, sessionEnd=False)


class TestSpeakingScore:
    def test_happy_path(self):
        s = SpeakingScore(
            grammarVocab=3,
            discourseManagement=4,
            pronunciation=3,
            interactive=4,
            overall=3.5,
            justification="Good range, some past-tense slips.",
            weakPoints=[
                SpeakingWeakPoint(
                    tag="grammar.past_simple",
                    quote="I go to school yesterday",
                    suggestion="went",
                )
            ],
        )
        assert s.overall == 3.5

    def test_score_bounds_enforced(self):
        with pytest.raises(ValidationError):
            SpeakingScore(
                grammarVocab=6,
                discourseManagement=3,
                pronunciation=3,
                interactive=3,
                overall=3.0,
                justification="x",
                weakPoints=[],
            )
```

- [ ] **Step 3.2: Run the schema tests and verify they fail**

```bash
cd services/ai
source .venv/Scripts/activate
pytest tests/test_speaking_schemas.py -v
```

Expected: collection fails with `ImportError: cannot import name 'SpeakingPrompts' from 'app.schemas.speaking'` (module does not exist yet).

- [ ] **Step 3.3: Implement the schemas**

Create `services/ai/app/schemas/speaking.py`:

```python
"""Pydantic models for Phase 3 Speaking. Shapes match docs/superpowers/specs §5 + §6.2."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


SpeakingLevel = Literal["KET", "PET"]
SpeakingRole = Literal["user", "assistant"]
SpeakingTurnSource = Literal["server", "akool_stt", "client_fallback"]


class SpeakingPromptPart(BaseModel):
    partNumber: int = Field(ge=1, le=6)
    title: str = Field(min_length=1, max_length=100)
    targetMinutes: int = Field(ge=1, le=15)
    examinerScript: list[str] = Field(min_length=1, max_length=20)
    coachingHints: str = ""
    photoKey: str | None = None

    @field_validator("examinerScript")
    @classmethod
    def _non_empty_strings(cls, v: list[str]) -> list[str]:
        if any(not s.strip() for s in v):
            raise ValueError("examinerScript items must be non-empty")
        return v


class SpeakingPrompts(BaseModel):
    level: SpeakingLevel
    initialGreeting: str = Field(min_length=1, max_length=200)
    parts: list[SpeakingPromptPart] = Field(min_length=1, max_length=6)

    @field_validator("parts")
    @classmethod
    def _parts_sequential(cls, parts: list[SpeakingPromptPart]) -> list[SpeakingPromptPart]:
        expected = list(range(1, len(parts) + 1))
        actual = [p.partNumber for p in parts]
        if actual != expected:
            raise ValueError(f"parts must be numbered sequentially from 1; got {actual}")
        return parts


class SpeakingTurn(BaseModel):
    role: SpeakingRole
    content: str
    part: int = Field(ge=1, le=6)
    ts: str | None = None  # ISO-8601 when known; may be set by caller
    source: SpeakingTurnSource = "server"


class SpeakingExaminerReply(BaseModel):
    """Return shape from /speaking/examiner."""

    reply: str = Field(min_length=1, max_length=400)  # ~40 words English ≈ 200–260 chars
    advancePart: int | None = Field(default=None, ge=2, le=6)
    sessionEnd: bool = False

    @field_validator("reply")
    @classmethod
    def _word_cap(cls, v: str) -> str:
        if len(v.split()) > 60:  # hard cap; spec target is ~40 words
            raise ValueError("reply exceeds 60-word cap")
        return v


class SpeakingWeakPoint(BaseModel):
    tag: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=1, max_length=400)
    suggestion: str = Field(min_length=1, max_length=200)


class SpeakingScore(BaseModel):
    grammarVocab: int = Field(ge=0, le=5)
    discourseManagement: int = Field(ge=0, le=5)
    pronunciation: int = Field(ge=0, le=5)
    interactive: int = Field(ge=0, le=5)
    overall: float = Field(ge=0, le=5)
    justification: str = Field(min_length=1, max_length=2000)
    weakPoints: list[SpeakingWeakPoint] = Field(default_factory=list, max_length=30)
```

- [ ] **Step 3.4: Run the schema tests and verify they pass**

```bash
cd services/ai
pytest tests/test_speaking_schemas.py -v
```

Expected: all tests pass. If Pydantic v2 disagrees with `min_length` vs `min_items` for lists, replace with `min_length` on `list[...]` fields (Pydantic v2 supports both).

- [ ] **Step 3.5: Write failing tests for the validators**

Create `services/ai/tests/test_speaking_validators.py`:

```python
import pytest

from app.validators.speaking import (
    parse_examiner_output,
    enforce_reply_caps,
    SentinelParseError,
)


class TestParseExaminerOutput:
    def test_plain_reply_no_sentinels(self):
        raw = "Nice to meet you. Where do you live?"
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.reply == raw
        assert parsed.advancePart is None
        assert parsed.sessionEnd is False

    def test_advance_part_sentinel(self):
        raw = "Great. [[PART:2]] Now, let's look at a photo."
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.advancePart == 2
        assert "[[PART:2]]" not in parsed.reply
        assert parsed.reply == "Great. Now, let's look at a photo."
        assert parsed.sessionEnd is False

    def test_session_end_sentinel(self):
        raw = "Thank you, that's the end of the test. [[SESSION_END]]"
        parsed = parse_examiner_output(raw, current_part=2, last_part=2)
        assert parsed.sessionEnd is True
        assert "[[SESSION_END]]" not in parsed.reply

    def test_both_sentinels_same_turn(self):
        raw = "[[PART:2]] That's all, thank you. [[SESSION_END]]"
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.advancePart == 2
        assert parsed.sessionEnd is True
        assert parsed.reply.strip() == "That's all, thank you."

    def test_rejects_advance_part_beyond_last(self):
        with pytest.raises(SentinelParseError):
            parse_examiner_output("[[PART:7]] ok", current_part=1, last_part=2)

    def test_rejects_advance_part_not_monotonic(self):
        with pytest.raises(SentinelParseError):
            parse_examiner_output("[[PART:1]] ok", current_part=2, last_part=2)


class TestEnforceReplyCaps:
    def test_under_cap(self):
        assert enforce_reply_caps("Hello there.") == "Hello there."

    def test_truncates_soft_cap(self):
        # ~45 words should be truncated to 40
        text = " ".join([f"word{i}" for i in range(45)])
        out = enforce_reply_caps(text)
        assert len(out.split()) <= 40

    def test_keeps_sentence_boundary_when_possible(self):
        text = "One two three. Four five six. " + " ".join(["word"] * 50) + "."
        out = enforce_reply_caps(text)
        assert len(out.split()) <= 40
        # Should prefer to end at a sentence boundary.
        assert out.endswith(".") or out.endswith("?")
```

- [ ] **Step 3.6: Run validator tests and verify they fail**

```bash
pytest tests/test_speaking_validators.py -v
```

Expected: `ImportError: cannot import name 'parse_examiner_output' from 'app.validators.speaking'`.

- [ ] **Step 3.7: Implement the validators**

Create `services/ai/app/validators/speaking.py`:

```python
"""Post-LLM guardrails for Phase 3 Speaking — sentinel parsing + reply caps."""

from __future__ import annotations

import re

from pydantic import BaseModel


class SentinelParseError(ValueError):
    pass


class ParsedExaminerOutput(BaseModel):
    reply: str
    advancePart: int | None
    sessionEnd: bool


_PART_RE = re.compile(r"\[\[PART:(\d+)\]\]")
_END_RE = re.compile(r"\[\[SESSION_END\]\]")


def parse_examiner_output(raw: str, *, current_part: int, last_part: int) -> ParsedExaminerOutput:
    """Extract [[PART:N]] + [[SESSION_END]] sentinels; return cleaned reply + flags."""
    advance_part: int | None = None
    part_match = _PART_RE.search(raw)
    if part_match:
        n = int(part_match.group(1))
        if n <= current_part:
            raise SentinelParseError(
                f"[[PART:{n}]] is not ahead of current part {current_part}"
            )
        if n > last_part:
            raise SentinelParseError(
                f"[[PART:{n}]] exceeds last part {last_part}"
            )
        advance_part = n

    session_end = bool(_END_RE.search(raw))

    cleaned = _PART_RE.sub("", raw)
    cleaned = _END_RE.sub("", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    if not cleaned:
        raise SentinelParseError("reply was empty after stripping sentinels")

    return ParsedExaminerOutput(
        reply=cleaned, advancePart=advance_part, sessionEnd=session_end
    )


def enforce_reply_caps(text: str, *, soft_words: int = 40, hard_words: int = 60) -> str:
    """Clamp the reply length without leaking mid-sentence cuts when avoidable.

    Strategy: if the reply is already at or under the soft cap, return it as-is.
    If it's over the soft cap, prefer to cut at the last sentence boundary that
    keeps us within the soft limit; if no such boundary exists, word-truncate
    at the hard cap and append an ellipsis.
    """
    words = text.split()
    if len(words) <= soft_words:
        return text.strip()

    # Sentence-boundary search up to soft_words worth of tokens.
    # Build cumulative word indices by scanning the original string.
    accumulated: list[tuple[int, int]] = []  # (word_count_at_end_of_sentence, char_index)
    word_count = 0
    last_sentence_end_char = -1
    for i, ch in enumerate(text):
        if ch in ".!?":
            # Count words up to and including this char.
            prefix = text[: i + 1]
            word_count = len(prefix.split())
            last_sentence_end_char = i
            accumulated.append((word_count, i))

    for wc, ci in reversed(accumulated):
        if wc <= soft_words:
            return text[: ci + 1].strip()

    # No sentence boundary fits — hard-truncate.
    truncated = " ".join(words[:hard_words]).rstrip(".,; ") + "…"
    return truncated
```

- [ ] **Step 3.8: Run validator tests and verify they pass**

```bash
pytest tests/test_speaking_validators.py -v
```

Expected: all tests pass.

- [ ] **Step 3.9: Commit**

```bash
git add services/ai/app/schemas/speaking.py \
        services/ai/app/validators/speaking.py \
        services/ai/tests/test_speaking_schemas.py \
        services/ai/tests/test_speaking_validators.py
git commit -m "feat(speaking-ai): add Pydantic schemas + sentinel/length validators"
```

---

# Phase B — Python agents + FastAPI routes

## Task 4: Python — `speaking_generator` agent

**Files:**
- Create: `services/ai/app/prompts/speaking_generator_system.py`
- Create: `services/ai/app/agents/speaking_generator.py`
- Create: `services/ai/tests/test_speaking_generator.py`

- [ ] **Step 4.1: Write the failing test**

Create `services/ai/tests/test_speaking_generator.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_generator import generate_speaking_prompts
from app.schemas.speaking import SpeakingPrompts


@pytest.mark.asyncio
async def test_ket_generator_returns_two_parts():
    fake_output = SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina. Let's begin.",
        parts=[
            {
                "partNumber": 1,
                "title": "Interview",
                "targetMinutes": 3,
                "examinerScript": ["What's your name?", "Where do you live?"],
                "coachingHints": "Encourage full sentences.",
                "photoKey": None,
            },
            {
                "partNumber": 2,
                "title": "Photo description",
                "targetMinutes": 5,
                "examinerScript": ["Describe this photo.", "What do you see in the background?"],
                "coachingHints": "Prompt 'what else' if the student stops early.",
                "photoKey": "speaking/photos/park-03.jpg",
            },
        ],
    )

    with patch("app.agents.speaking_generator.run_pydantic_agent", new=AsyncMock(return_value=fake_output)):
        out = await generate_speaking_prompts(
            level="KET",
            photo_briefs=[
                {"key": "speaking/photos/park-03.jpg", "description": "people playing chess in a park"},
            ],
        )

    assert out.level == "KET"
    assert len(out.parts) == 2
    assert out.parts[1].photoKey == "speaking/photos/park-03.jpg"


@pytest.mark.asyncio
async def test_pet_generator_returns_four_parts():
    fake_output = SpeakingPrompts(
        level="PET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {"partNumber": i, "title": f"Part {i}", "targetMinutes": 3,
             "examinerScript": ["q1", "q2"], "coachingHints": "", "photoKey": None}
            for i in range(1, 5)
        ],
    )
    with patch("app.agents.speaking_generator.run_pydantic_agent", new=AsyncMock(return_value=fake_output)):
        out = await generate_speaking_prompts(level="PET", photo_briefs=[])
    assert len(out.parts) == 4
```

- [ ] **Step 4.2: Run the test and verify it fails**

```bash
cd services/ai
pytest tests/test_speaking_generator.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.agents.speaking_generator'`.

- [ ] **Step 4.3: Implement the generator prompt**

Create `services/ai/app/prompts/speaking_generator_system.py`:

```python
"""System prompt for the speaking_generator agent.

Produces a per-attempt Cambridge Speaking test script aligned to KET/PET format.
The generator NEVER plays the examiner role; it only writes the script the
examiner agent will follow during the live session.
"""

GENERATOR_SYSTEM_PROMPT = """\
You are a Cambridge-exam item writer. Produce a Speaking-test script for the
given CEFR level ({level}) that matches the official Cambridge KET/PET
Speaking format AS ADAPTED INTO SOLO-WITH-EXAMINER (the candidate speaks
only with the examiner; there is no second candidate).

LEVEL CONSTRAINTS
- KET (A2): exactly 2 parts. Part 1 = interview (~3 min, 5–7 personal
  questions). Part 2 = photo description + discussion (~5 min, opens with
  "Now, I'd like you to describe this photo" and follows up with 2–4
  opinion/preference questions tied to the visual topic).
- PET (B1): exactly 4 parts. Part 1 = interview (~2 min, 4–6 personal
  questions with one follow-up each). Part 2 = individual 1-minute photo
  description + 1 clarifying follow-up (~3 min). Part 3 = collaborative
  discussion led by the examiner around the same visual scenario (~3 min,
  4 options implied; the examiner leads "let's talk about…" style turns).
  Part 4 = opinion discussion extending Part 3 topic (~2 min).

CONTENT CONSTRAINTS
- Vocabulary + structures must be level-appropriate. Use the official
  Cambridge A2 Key / B1 Preliminary vocabulary lists as the ceiling.
- Questions must be natural and answerable in <30 seconds at the target
  level. Avoid yes/no dead ends for anything past Part 1.
- Parts must be numbered sequentially from 1 and total exactly 2 (KET) or
  4 (PET).
- `initialGreeting` is ≤ 25 words. Examples:
  "Hello, I'm Mina. I'll be your examiner today. Let's begin with a few
   questions about yourself."
- `photoKey` is REQUIRED on the photo-description part (KET Part 2,
  PET Part 2, PET Part 3). Choose from the provided photo briefs — match
  the topic of the discussion to the photo description.
- `coachingHints` is a short instruction for the live examiner agent,
  e.g. "If student stops early, prompt 'What else can you see?'".
- NEVER write scripts that rely on a second candidate (no "talk to your
  partner", no "agree with the other candidate"). All discussion is
  examiner-led.

OUTPUT
Return a single valid SpeakingPrompts JSON object. Produce nothing else —
no commentary, no markdown fences.
"""
```

Create `services/ai/app/agents/speaking_generator.py`:

```python
"""speaking_generator — produces a per-attempt Speaking test script."""

from __future__ import annotations

import json

from pydantic_ai import Agent

from app.aiClient import get_deepseek_model  # existing Phase 1/2 client factory
from app.prompts.speaking_generator_system import GENERATOR_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingPrompts


# Indirection so tests can patch this symbol.
async def run_pydantic_agent(
    level: str,
    photo_briefs: list[dict],
) -> SpeakingPrompts:
    agent = Agent(
        model=get_deepseek_model(),
        result_type=SpeakingPrompts,
        system_prompt=GENERATOR_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps(
        {"level": level, "photo_briefs": photo_briefs},
        ensure_ascii=False,
    )
    result = await agent.run(user_prompt)
    return result.data


async def generate_speaking_prompts(
    *, level: str, photo_briefs: list[dict]
) -> SpeakingPrompts:
    """Public entry point; wraps the Pydantic AI agent call."""
    return await run_pydantic_agent(level, photo_briefs)
```

**Note on import:** `get_deepseek_model` is the existing Phase 1/2 factory that wires Pydantic AI to DeepSeek (see existing agents in `services/ai/app/agents/` for the exact import path — if it's named differently in this repo, adjust this line to match).

- [ ] **Step 4.4: Run the test and verify it passes**

```bash
pytest tests/test_speaking_generator.py -v
```

Expected: both tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add services/ai/app/prompts/speaking_generator_system.py \
        services/ai/app/agents/speaking_generator.py \
        services/ai/tests/test_speaking_generator.py
git commit -m "feat(speaking-ai): add speaking_generator agent"
```

---

## Task 5: Python — `speaking_examiner` agent

**Files:**
- Create: `services/ai/app/prompts/speaking_examiner_system.py`
- Create: `services/ai/app/agents/speaking_examiner.py`
- Create: `services/ai/tests/test_speaking_examiner.py`

- [ ] **Step 5.1: Write the failing test**

Create `services/ai/tests/test_speaking_examiner.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_examiner import run_examiner_turn
from app.schemas.speaking import SpeakingExaminerReply, SpeakingPrompts


def _ket_prompts() -> SpeakingPrompts:
    return SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {
                "partNumber": 1,
                "title": "Interview",
                "targetMinutes": 3,
                "examinerScript": ["What's your name?", "Where do you live?"],
                "coachingHints": "Encourage full sentences.",
                "photoKey": None,
            },
            {
                "partNumber": 2,
                "title": "Photo",
                "targetMinutes": 5,
                "examinerScript": ["Describe this photo."],
                "coachingHints": "",
                "photoKey": "speaking/photos/park-01.jpg",
            },
        ],
    )


@pytest.mark.asyncio
async def test_examiner_returns_plain_reply():
    fake_raw_output = "Nice to meet you. Where do you live?"
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=fake_raw_output)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "My name is Li Wei."}],
            current_part=1,
        )
    assert isinstance(out, SpeakingExaminerReply)
    assert out.reply == fake_raw_output
    assert out.advancePart is None
    assert out.sessionEnd is False


@pytest.mark.asyncio
async def test_examiner_advances_part():
    raw = "Great, thank you. [[PART:2]] Now, I'd like you to describe this photo."
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "I live in Beijing."}],
            current_part=1,
        )
    assert out.advancePart == 2
    assert "[[PART:2]]" not in out.reply


@pytest.mark.asyncio
async def test_examiner_emits_session_end():
    raw = "Thank you, that's the end of the test. [[SESSION_END]]"
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "Yes, I enjoyed that."}],
            current_part=2,
        )
    assert out.sessionEnd is True


@pytest.mark.asyncio
async def test_examiner_enforces_reply_word_cap():
    raw = " ".join(["word"] * 80)
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert len(out.reply.split()) <= 40
```

- [ ] **Step 5.2: Run the test and verify it fails**

```bash
pytest tests/test_speaking_examiner.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.agents.speaking_examiner'`.

- [ ] **Step 5.3: Implement the examiner prompt + agent**

Create `services/ai/app/prompts/speaking_examiner_system.py`:

```python
"""System prompt for the live examiner turn handler.

The examiner's job is to take the conversation history + script context and
return the NEXT single examiner turn. It never scores, never reveals the
script, never breaks character. It emits [[PART:N]] when advancing and
[[SESSION_END]] when the exam is done.
"""

EXAMINER_SYSTEM_PROMPT = """\
You are Mina, a warm, professional British Cambridge {level} Speaking
examiner talking to ONE student. The student is a Chinese K-12 learner.
You are in practice mode (coaching style): you may gently encourage fuller
answers, but you never reveal scores or grade in-conversation.

TURN RULES
- Reply with ONE next turn only. Do not simulate the student.
- Maximum ~40 words per reply, always in English.
- Stay in role as the examiner at all times. Never mention you are an AI,
  an LLM, or a prompt. Never describe the test structure meta-level.
- If the student asks "what's my score" or "can you tell me the answer",
  politely deflect and continue the conversation.
- If the student speaks Chinese, politely ask them to try in English. If
  they reply in Chinese a second time, say "Let's try the next question"
  and move on.
- If the student falls silent for a turn, gently prompt: "Take your time —
  would you like me to repeat the question?"
- If the last user turn is under 3 chars or obvious STT noise, say:
  "Sorry, I didn't catch that — could you speak up?"
- Match level:
  - KET (A2): simple present/past, short concrete questions, everyday
    vocabulary.
  - PET (B1): slightly more complex structures, opinion framing ("what do
    you think…", "would you rather…"), short follow-ups.

PART FLOW + SENTINELS
- You are currently on part {current_part}. The final part is part
  {last_part}.
- Part scripts live in the `script` field of the USER message. Follow
  their spirit — you may rephrase or add one short follow-up — but do not
  jump ahead of the script questions and do not invent topics unrelated
  to the part.
- When the current part is complete, output the next turn for part
  {next_part_hint} prefixed with `[[PART:{next_part_hint}]] ` (exact
  token). Only emit this sentinel when truly advancing — do not emit it
  on every turn of part {current_part}.
- When the last part is complete, end your turn with a short sign-off
  and the literal token `[[SESSION_END]]`.
- Never emit either sentinel without speech text around it.

OUTPUT
Emit ONLY the spoken reply as plain prose (with sentinels if needed). No
markdown, no JSON, no stage directions.
"""
```

Create `services/ai/app/agents/speaking_examiner.py`:

```python
"""speaking_examiner — non-streaming turn handler.

Accepts the full conversation history + script context, returns a single
SpeakingExaminerReply with sentinels already parsed into flags.
"""

from __future__ import annotations

import json
from typing import Any

from app.aiClient import get_deepseek_model  # Phase 1/2 pattern
from app.prompts.speaking_examiner_system import EXAMINER_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingExaminerReply, SpeakingPrompts
from app.validators.speaking import (
    SentinelParseError,
    enforce_reply_caps,
    parse_examiner_output,
)


async def _run_llm(
    *,
    system_prompt: str,
    user_payload: str,
    max_tokens: int = 150,
    temperature: float = 0.7,
) -> str:
    """Thin wrapper around the DeepSeek chat call.

    Patched in tests. In production, goes through the shared Phase 1/2
    aiClient helper. Returns the raw assistant text.
    """
    from app.aiClient import deepseek_chat  # existing helper

    return await deepseek_chat(
        system=system_prompt,
        user=user_payload,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def _build_user_payload(
    *,
    prompts: SpeakingPrompts,
    history: list[dict[str, str]],
    current_part: int,
) -> str:
    """Compose the user-role payload for the examiner LLM call."""
    part = next(p for p in prompts.parts if p.partNumber == current_part)
    return json.dumps(
        {
            "current_part": current_part,
            "script": {
                "title": part.title,
                "target_minutes": part.targetMinutes,
                "examiner_script": part.examinerScript,
                "coaching_hints": part.coachingHints,
                "photo_key": part.photoKey,
            },
            "history": history,
        },
        ensure_ascii=False,
    )


async def run_examiner_turn(
    *,
    prompts: SpeakingPrompts,
    history: list[dict[str, str]],
    current_part: int,
) -> SpeakingExaminerReply:
    last_part = prompts.parts[-1].partNumber
    next_part_hint = min(current_part + 1, last_part)

    system = EXAMINER_SYSTEM_PROMPT.format(
        level=prompts.level,
        current_part=current_part,
        last_part=last_part,
        next_part_hint=next_part_hint,
    )
    user = _build_user_payload(
        prompts=prompts, history=history, current_part=current_part
    )
    raw = await _run_llm(system_prompt=system, user_payload=user)

    try:
        parsed = parse_examiner_output(
            raw, current_part=current_part, last_part=last_part
        )
    except SentinelParseError:
        # Recover gracefully: drop the malformed sentinel, keep the text,
        # log and continue. Better a polite reply than a broken turn.
        import re
        cleaned = re.sub(r"\[\[[^\]]*\]\]", "", raw).strip()
        parsed_reply = cleaned or "Could you say that again, please?"
        parsed = type("P", (), {
            "reply": parsed_reply, "advancePart": None, "sessionEnd": False,
        })()

    capped = enforce_reply_caps(parsed.reply)

    return SpeakingExaminerReply(
        reply=capped,
        advancePart=parsed.advancePart,
        sessionEnd=parsed.sessionEnd,
    )
```

- [ ] **Step 5.4: Run the test and verify it passes**

```bash
pytest tests/test_speaking_examiner.py -v
```

Expected: all 4 tests pass. If the word-cap test fails because `enforce_reply_caps` returned >40 words, verify the cap impl is wired.

- [ ] **Step 5.5: Commit**

```bash
git add services/ai/app/prompts/speaking_examiner_system.py \
        services/ai/app/agents/speaking_examiner.py \
        services/ai/tests/test_speaking_examiner.py
git commit -m "feat(speaking-ai): add speaking_examiner turn handler"
```

---

## Task 6: Python — `speaking_scorer` agent

**Files:**
- Create: `services/ai/app/prompts/speaking_scorer_system.py`
- Create: `services/ai/app/agents/speaking_scorer.py`
- Create: `services/ai/tests/test_speaking_scorer.py`

- [ ] **Step 6.1: Write the failing test**

Create `services/ai/tests/test_speaking_scorer.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_scorer import score_speaking_attempt
from app.schemas.speaking import SpeakingScore, SpeakingWeakPoint


def _mixed_transcript() -> list[dict]:
    return [
        {"role": "assistant", "content": "Hello, what's your name?", "part": 1},
        {"role": "user", "content": "My name is Li Wei.", "part": 1},
        {"role": "assistant", "content": "Where do you live?", "part": 1},
        {"role": "user", "content": "I live in Beijing. I go to school yesterday.", "part": 1},
        {"role": "assistant", "content": "Thank you. [[SESSION_END]]", "part": 2},
    ]


@pytest.mark.asyncio
async def test_scorer_returns_valid_score():
    fake = SpeakingScore(
        grammarVocab=3,
        discourseManagement=3,
        pronunciation=3,
        interactive=4,
        overall=3.25,
        justification="Range is ok; one past-simple slip.",
        weakPoints=[
            SpeakingWeakPoint(
                tag="grammar.past_simple",
                quote="I go to school yesterday",
                suggestion="went",
            ),
        ],
    )
    with patch("app.agents.speaking_scorer._run_scorer_agent", new=AsyncMock(return_value=fake)):
        out = await score_speaking_attempt(level="KET", transcript=_mixed_transcript())
    assert out.overall == pytest.approx(3.25)
    assert len(out.weakPoints) == 1
    assert out.weakPoints[0].tag == "grammar.past_simple"


@pytest.mark.asyncio
async def test_scorer_handles_empty_student_turns():
    """If the student never spoke, the scorer should still return a valid score with 0s."""
    fake = SpeakingScore(
        grammarVocab=0,
        discourseManagement=0,
        pronunciation=0,
        interactive=0,
        overall=0.0,
        justification="No student speech captured.",
        weakPoints=[],
    )
    transcript = [{"role": "assistant", "content": "Hello, are you there?", "part": 1}]
    with patch("app.agents.speaking_scorer._run_scorer_agent", new=AsyncMock(return_value=fake)):
        out = await score_speaking_attempt(level="KET", transcript=transcript)
    assert out.overall == 0
    assert out.weakPoints == []
```

- [ ] **Step 6.2: Run the test and verify it fails**

```bash
pytest tests/test_speaking_scorer.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.agents.speaking_scorer'`.

- [ ] **Step 6.3: Implement the scorer prompt + agent**

Create `services/ai/app/prompts/speaking_scorer_system.py`:

```python
"""System prompt for speaking_scorer.

Rubric is the published Cambridge 4-criteria:
  - Grammar & Vocabulary
  - Discourse Management
  - Pronunciation (inferred from transcript patterns)
  - Interactive Communication
Each 0-5 integer; overall = simple mean rounded to nearest 0.5.
"""

SCORER_SYSTEM_PROMPT = """\
You are a Cambridge {level} Speaking examiner producing a post-session
rubric score from the transcript of a single-candidate practice session.

OUTPUT shape: a single valid SpeakingScore JSON object (no prose around it).

RUBRIC (Cambridge 4 criteria, each 0–5 integer)
- grammarVocab: range + accuracy + level appropriacy.
- discourseManagement: coherence, extended stretches of speech, topic
  development, filler use.
- pronunciation: INFERRED from transcript patterns — hesitations, filler
  words, incomplete tokens, STT spelling-like artifacts. DO NOT claim
  access to audio. If the transcript looks clean + well-formed, award
  3–4; if full of "um"s / fragmented words, 1–2.
- interactive: responsiveness to examiner prompts, turn-taking, asking
  for clarification, building on prior turns.
- overall: mean of the four, rounded to the nearest 0.5.

BAND DESCRIPTORS (brief, aligned to Cambridge public descriptors)
- {level} 5: consistently meets or exceeds target-level competence.
- {level} 4: generally meets target; minor slips.
- {level} 3: meets target with more than minor slips.
- {level} 2: below target; effort visible; limited range.
- {level} 1: far below target; frequent breakdown.
- 0: no student speech captured.

WEAK POINTS
Produce up to 10 weak points from the student's turns:
- tag: dot-separated category, e.g. "grammar.past_simple",
  "vocab.connectives", "discourse.short_turns", "pron.fillers".
- quote: exact excerpt (≤200 chars) from the student's speech.
- suggestion: short corrective cue (≤25 words), e.g. "went" for
  "I go yesterday".

JUSTIFICATION
- 3–6 short sentences explaining the four scores.
- Mention the MOST impactful weak point by tag.
- Never mention you are an AI, LLM, or prompt.

RULES
- Only score from the transcript in the USER message.
- If the transcript has zero user turns, every score is 0 and weakPoints
  is an empty list.
- Return JSON only. No markdown fences, no commentary.
"""
```

Create `services/ai/app/agents/speaking_scorer.py`:

```python
"""speaking_scorer — post-session rubric scorer."""

from __future__ import annotations

import json

from pydantic_ai import Agent

from app.aiClient import get_deepseek_model
from app.prompts.speaking_scorer_system import SCORER_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingScore


async def _run_scorer_agent(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    agent = Agent(
        model=get_deepseek_model(),
        result_type=SpeakingScore,
        system_prompt=SCORER_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps({"level": level, "transcript": transcript}, ensure_ascii=False)
    result = await agent.run(user_prompt)
    return result.data


async def score_speaking_attempt(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    return await _run_scorer_agent(level=level, transcript=transcript)
```

- [ ] **Step 6.4: Run the test and verify it passes**

```bash
pytest tests/test_speaking_scorer.py -v
```

Expected: both tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add services/ai/app/prompts/speaking_scorer_system.py \
        services/ai/app/agents/speaking_scorer.py \
        services/ai/tests/test_speaking_scorer.py
git commit -m "feat(speaking-ai): add speaking_scorer agent"
```

---

## Task 7: Python — FastAPI routes

Adds four HTTP routes on the existing `services/ai` FastAPI app:
- `POST /speaking/generate` — returns a SpeakingPrompts
- `POST /speaking/examiner` — returns a SpeakingExaminerReply
- `POST /speaking/examiner-warmup` — no-op ping (primes the LLM connection pool on runner mount)
- `POST /speaking/score` — returns a SpeakingScore

**Files:**
- Modify: `services/ai/app/main.py`
- Create: `services/ai/tests/test_speaking_routes.py`

- [ ] **Step 7.1: Write failing integration tests**

Create `services/ai/tests/test_speaking_routes.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.schemas.speaking import (
    SpeakingPrompts,
    SpeakingExaminerReply,
    SpeakingScore,
    SpeakingWeakPoint,
)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_warmup(client: AsyncClient):
    r = await client.post("/speaking/examiner-warmup")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.asyncio
async def test_generate_happy_path(client: AsyncClient):
    fake = SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {"partNumber": 1, "title": "Interview", "targetMinutes": 3,
             "examinerScript": ["What's your name?"], "coachingHints": "", "photoKey": None},
            {"partNumber": 2, "title": "Photo", "targetMinutes": 5,
             "examinerScript": ["Describe this photo."], "coachingHints": "",
             "photoKey": "speaking/photos/park-01.jpg"},
        ],
    )
    with patch("app.main.generate_speaking_prompts", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/generate", json={
            "level": "KET",
            "photo_briefs": [
                {"key": "speaking/photos/park-01.jpg", "description": "park"},
            ],
        })
    assert r.status_code == 200
    assert r.json()["level"] == "KET"
    assert len(r.json()["parts"]) == 2


@pytest.mark.asyncio
async def test_examiner_turn(client: AsyncClient):
    fake = SpeakingExaminerReply(reply="Where do you live?", advancePart=None, sessionEnd=False)
    with patch("app.main.run_examiner_turn", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/examiner", json={
            "prompts": {
                "level": "KET",
                "initialGreeting": "Hi",
                "parts": [
                    {"partNumber": 1, "title": "Interview", "targetMinutes": 3,
                     "examinerScript": ["What's your name?"], "coachingHints": "", "photoKey": None},
                    {"partNumber": 2, "title": "Photo", "targetMinutes": 5,
                     "examinerScript": ["Describe this photo."], "coachingHints": "",
                     "photoKey": "speaking/photos/park-01.jpg"},
                ],
            },
            "history": [{"role": "user", "content": "My name is Li Wei."}],
            "current_part": 1,
        })
    assert r.status_code == 200
    assert r.json()["reply"] == "Where do you live?"


@pytest.mark.asyncio
async def test_score_happy_path(client: AsyncClient):
    fake = SpeakingScore(
        grammarVocab=3, discourseManagement=3, pronunciation=3, interactive=4,
        overall=3.25, justification="ok",
        weakPoints=[SpeakingWeakPoint(tag="grammar.past_simple",
                                      quote="I go yesterday", suggestion="went")],
    )
    with patch("app.main.score_speaking_attempt", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/score", json={
            "level": "KET",
            "transcript": [{"role": "user", "content": "I go yesterday", "part": 1}],
        })
    assert r.status_code == 200
    assert r.json()["overall"] == pytest.approx(3.25)
    assert len(r.json()["weakPoints"]) == 1
```

- [ ] **Step 7.2: Run tests and verify they fail**

```bash
pytest tests/test_speaking_routes.py -v
```

Expected: routes return 404 (they don't exist yet).

- [ ] **Step 7.3: Add routes to `main.py`**

Edit `services/ai/app/main.py`. Add these imports near the existing agent imports:

```python
from app.agents.speaking_generator import generate_speaking_prompts
from app.agents.speaking_examiner import run_examiner_turn
from app.agents.speaking_scorer import score_speaking_attempt
from app.schemas.speaking import (
    SpeakingPrompts,
    SpeakingExaminerReply,
    SpeakingScore,
)
```

Add these Pydantic request bodies + routes (place after the existing Phase 2 listening routes):

```python
from pydantic import BaseModel
from typing import Any


class GenerateSpeakingBody(BaseModel):
    level: str  # "KET" | "PET"
    photo_briefs: list[dict[str, Any]] = []


class ExaminerBody(BaseModel):
    prompts: SpeakingPrompts
    history: list[dict[str, str]]
    current_part: int


class ScoreBody(BaseModel):
    level: str
    transcript: list[dict[str, Any]]


@app.post("/speaking/examiner-warmup")
async def speaking_examiner_warmup() -> dict:
    """No-op: primes the DeepSeek HTTP client on runner mount."""
    return {"ok": True}


@app.post("/speaking/generate", response_model=SpeakingPrompts)
async def speaking_generate(body: GenerateSpeakingBody) -> SpeakingPrompts:
    return await generate_speaking_prompts(
        level=body.level, photo_briefs=body.photo_briefs
    )


@app.post("/speaking/examiner", response_model=SpeakingExaminerReply)
async def speaking_examiner(body: ExaminerBody) -> SpeakingExaminerReply:
    return await run_examiner_turn(
        prompts=body.prompts,
        history=body.history,
        current_part=body.current_part,
    )


@app.post("/speaking/score", response_model=SpeakingScore)
async def speaking_score(body: ScoreBody) -> SpeakingScore:
    return await score_speaking_attempt(level=body.level, transcript=body.transcript)
```

- [ ] **Step 7.4: Run tests and verify they pass**

```bash
pytest tests/test_speaking_routes.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add services/ai/app/main.py \
        services/ai/tests/test_speaking_routes.py
git commit -m "feat(speaking-ai): add /speaking/{generate,examiner,examiner-warmup,score} routes"
```

---

# Phase C — Avatar + voice audition (manual)

## Task 8: User selects Mina avatar + voice, smoke-tests end-to-end

This task is gated on the user's manual action: uploading a Mina avatar via the Akool web UI (already explained at session time — user said "I'll create another you don't worry about avatar creation"), then picking a British-female voice from Akool's Voice Lab, and dropping both IDs into `apps/web/.env`.

We supply a smoke-test script that the user runs after filling in the IDs to validate the session creation round-trip.

**Files:**
- Create: `apps/web/scripts/akool-smoke-test.mjs`
- Modify: `apps/web/.env` (user-side edit only)

- [ ] **Step 8.1: Build the smoke-test script**

Create `apps/web/scripts/akool-smoke-test.mjs`:

```javascript
#!/usr/bin/env node
/**
 * One-shot smoke test for Akool streaming-avatar plumbing.
 * Reads clientId/clientSecret + avatar/voice ids from apps/web/.env,
 * fetches a session token, creates a TRTC session, closes it.
 * Prints the full response so the operator can confirm TRTC credentials
 * are returned.
 *
 * Usage (from apps/web):
 *   node scripts/akool-smoke-test.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const required = ["AKOOL_CLIENT_ID", "AKOOL_CLIENT_SECRET", "AKOOL_AVATAR_ID"];
  for (const k of required) {
    if (!env[k]) {
      console.error(`Missing ${k} in apps/web/.env`);
      process.exit(1);
    }
  }

  console.log(">> POST /api/open/v3/getToken");
  const tokenRes = await fetch("https://openapi.akool.com/api/open/v3/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: env.AKOOL_CLIENT_ID,
      clientSecret: env.AKOOL_CLIENT_SECRET,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (tokenJson.code !== 1000) {
    console.error("Token fetch failed:", tokenJson);
    process.exit(1);
  }
  const token = tokenJson.token;
  console.log("   got token:", token.slice(0, 20), "…");

  const body = {
    avatar_id: env.AKOOL_AVATAR_ID,
    duration: 60,
    stream_type: env.AKOOL_STREAM_TYPE || "trtc",
    mode_type: 1,
    language: "en",
    voice_params: {
      stt_language: "en",
      stt_type: "openai_realtime",
      turn_detection: {
        type: "server_vad",
        threshold: Number(env.AKOOL_VAD_THRESHOLD || 0.6),
        silence_duration_ms: Number(env.AKOOL_VAD_SILENCE_MS || 500),
      },
    },
  };
  if (env.AKOOL_VOICE_ID) body.voice_id = env.AKOOL_VOICE_ID;

  console.log(">> POST /api/open/v4/liveAvatar/session/create");
  console.log("   body:", JSON.stringify(body, null, 2));
  const createRes = await fetch(
    "https://openapi.akool.com/api/open/v4/liveAvatar/session/create",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );
  const createJson = await createRes.json();
  console.log("   response:", JSON.stringify(createJson, null, 2));
  if (createJson.code !== 1000) {
    console.error("   session/create failed.");
    process.exit(1);
  }
  const sessionId = createJson.data._id;
  const creds = createJson.data.credentials || {};

  // Sanity-check the TRTC-shaped fields are populated (when trtc is chosen).
  if ((env.AKOOL_STREAM_TYPE || "trtc") === "trtc") {
    for (const f of [
      "trtc_sdk_app_id",
      "trtc_sdk_room_id",
      "trtc_sdk_user_id",
      "trtc_sdk_user_sig",
    ]) {
      if (creds[f] == null || creds[f] === "") {
        console.error(`   WARN: TRTC credential field \`${f}\` is missing.`);
      }
    }
  }

  console.log(">> POST /api/open/v4/liveAvatar/session/close");
  const closeRes = await fetch(
    "https://openapi.akool.com/api/open/v4/liveAvatar/session/close",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: sessionId }),
    },
  );
  const closeJson = await closeRes.json();
  console.log("   response:", JSON.stringify(closeJson, null, 2));
  if (closeJson.code !== 1000) process.exit(1);

  console.log("\nOK — Akool plumbing is healthy.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8.2: Commit the smoke-test script**

```bash
git add apps/web/scripts/akool-smoke-test.mjs
git commit -m "chore(speaking): add akool-smoke-test.mjs for audition validation"
```

- [ ] **Step 8.3: OPERATOR — fill in avatar + voice IDs**

Ask the user to:
1. Create a Mina avatar via the Akool web UI (Instant Avatar from `Mina (2).png`). Wait until it shows "Ready" in their dashboard.
2. Pick a British-accented female voice from Akool Voice Lab → copy the `voice_id`. (If none fits well, pick the nearest and iterate later.)
3. Edit `apps/web/.env`:
   ```
   AKOOL_AVATAR_ID=<the new avatar id>
   AKOOL_VOICE_ID=<the chosen voice id>
   ```

- [ ] **Step 8.4: OPERATOR — run the smoke test**

```bash
cd apps/web
node scripts/akool-smoke-test.mjs
```

Expected:
- `>> POST /api/open/v3/getToken` → `got token: eyJ... …`
- `>> POST /api/open/v4/liveAvatar/session/create` → response has `code: 1000` and `data.credentials` populated with `trtc_sdk_app_id`, `trtc_sdk_room_id`, `trtc_sdk_user_id`, `trtc_sdk_user_sig`.
- `>> POST /api/open/v4/liveAvatar/session/close` → `code: 1000`.
- Final line: `OK — Akool plumbing is healthy.`

If the TRTC credential fields are missing, verify `AKOOL_STREAM_TYPE=trtc` is set. If the session/create fails with an avatar-not-found error, re-check `AKOOL_AVATAR_ID` is copy-pasted exactly from the dashboard (no leading space).

- [ ] **Step 8.5: No commit** — `.env` is gitignored. This is a milestone, not a code change.

---

# Phase D — Next.js server lib

## Task 9: `lib/speaking/akool-client.ts` — server-only auth + session management

**Files:**
- Create: `apps/web/src/lib/speaking/akool-client.ts`
- Create: `apps/web/src/lib/speaking/__tests__/akool-client.test.ts`
- Modify: `apps/web/next.config.ts` — no change here (fetch is native; nothing to externalise)

- [ ] **Step 9.1: Write failing tests**

Create `apps/web/src/lib/speaking/__tests__/akool-client.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAkoolSession,
  closeAkoolSession,
  getAkoolToken,
  __resetAkoolTokenCache,
  type AkoolCreateSessionInput,
} from "../akool-client";

const envBackup = { ...process.env };

function setEnv(overrides: Record<string, string>) {
  process.env = {
    ...envBackup,
    AKOOL_CLIENT_ID: "cid",
    AKOOL_CLIENT_SECRET: "csecret",
    AKOOL_STREAM_TYPE: "trtc",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

beforeEach(() => {
  setEnv({});
  __resetAkoolTokenCache();
  vi.restoreAllMocks();
});
afterEach(() => {
  process.env = envBackup;
});

const mockFetch = (responder: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return responder(url, init);
  }));
};

describe("getAkoolToken", () => {
  it("returns and caches the token across calls", async () => {
    let calls = 0;
    mockFetch((url) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        calls++;
        // 10-minute expiry relative to now
        const exp = Math.floor(Date.now() / 1000) + 600;
        // JWT-shape header.payload.sig with payload containing exp
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const t1 = await getAkoolToken();
    const t2 = await getAkoolToken();
    expect(t1).toBe(t2);
    expect(calls).toBe(1);
  });

  it("throws on non-1000 codes", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ code: 1101, msg: "invalid" }), { status: 200 }),
    );
    await expect(getAkoolToken()).rejects.toThrow(/akool token.*1101/i);
  });
});

describe("createAkoolSession", () => {
  it("POSTs the expected body and returns TRTC credentials", async () => {
    let capturedBody: any = null;
    mockFetch((url, init) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      if (url.endsWith("/api/open/v4/liveAvatar/session/create")) {
        capturedBody = JSON.parse((init!.body as string));
        return new Response(JSON.stringify({
          code: 1000,
          msg: "OK",
          data: {
            _id: "sess-xyz",
            uid: 123,
            type: 2,
            status: 1,
            stream_type: "trtc",
            credentials: {
              trtc_sdk_app_id: 111,
              trtc_sdk_room_id: "room-1",
              trtc_sdk_user_id: "user-1",
              trtc_sdk_user_sig: "sig-1",
            },
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const input: AkoolCreateSessionInput = {
      avatarId: "avatar-1",
      voiceId: "voice-1",
      durationSeconds: 900,
      vadThreshold: 0.6,
      vadSilenceMs: 500,
    };
    const out = await createAkoolSession(input);

    expect(out.akoolSessionId).toBe("sess-xyz");
    expect(out.streamType).toBe("trtc");
    expect(out.trtc).toEqual({
      sdkAppId: 111,
      roomId: "room-1",
      userId: "user-1",
      userSig: "sig-1",
    });

    // Request body sanity
    expect(capturedBody.avatar_id).toBe("avatar-1");
    expect(capturedBody.voice_id).toBe("voice-1");
    expect(capturedBody.mode_type).toBe(1);
    expect(capturedBody.stream_type).toBe("trtc");
    expect(capturedBody.language).toBe("en");
    expect(capturedBody.duration).toBe(900);
    expect(capturedBody.voice_params.turn_detection.type).toBe("server_vad");
    expect(capturedBody.voice_params.turn_detection.threshold).toBe(0.6);
    expect(capturedBody.voice_params.turn_detection.silence_duration_ms).toBe(500);
    expect(capturedBody.voice_params.stt_language).toBe("en");
  });

  it("throws on non-1000 responses", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 1008, msg: "avatar not found" }), { status: 200 });
    });
    await expect(
      createAkoolSession({ avatarId: "missing", voiceId: null, durationSeconds: 900, vadThreshold: 0.6, vadSilenceMs: 500 }),
    ).rejects.toThrow(/akool.*session\/create.*1008/i);
  });
});

describe("closeAkoolSession", () => {
  it("POSTs the session id", async () => {
    let closedId: string | null = null;
    mockFetch((url, init) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      if (url.endsWith("/api/open/v4/liveAvatar/session/close")) {
        closedId = JSON.parse(init!.body as string).id;
        return new Response(JSON.stringify({ code: 1000, msg: "OK" }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    await closeAkoolSession("sess-xyz");
    expect(closedId).toBe("sess-xyz");
  });
});
```

- [ ] **Step 9.2: Run tests and verify they fail**

```bash
cd apps/web
pnpm vitest run src/lib/speaking/__tests__/akool-client.test.ts
```

Expected: `Cannot find module '../akool-client'`.

- [ ] **Step 9.3: Implement `akool-client.ts`**

Create `apps/web/src/lib/speaking/akool-client.ts`:

```typescript
/**
 * Server-only Akool streaming-avatar client.
 * Wraps /getToken (with in-memory cache), session/create, session/close.
 * All functions here read AKOOL_CLIENT_ID / AKOOL_CLIENT_SECRET and
 * must NEVER be imported from a Client Component.
 */

import "server-only";

const AKOOL_BASE = "https://openapi.akool.com";
const GET_TOKEN_URL = `${AKOOL_BASE}/api/open/v3/getToken`;
const SESSION_CREATE_URL = `${AKOOL_BASE}/api/open/v4/liveAvatar/session/create`;
const SESSION_CLOSE_URL = `${AKOOL_BASE}/api/open/v4/liveAvatar/session/close`;

// --- Token cache ---------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name}`);
  return v;
}

function decodeJwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Reset the in-memory token cache. Intended for tests only.
 */
export function __resetAkoolTokenCache(): void {
  cachedToken = null;
}

export async function getAkoolToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > now) {
    return cachedToken.token;
  }

  const res = await fetch(GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: readEnv("AKOOL_CLIENT_ID"),
      clientSecret: readEnv("AKOOL_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });

  let json: { code?: number; token?: string; msg?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Akool token fetch: non-JSON response (HTTP ${res.status})`);
  }
  if (json.code !== 1000 || !json.token) {
    throw new Error(`Akool token fetch failed: code=${json.code} msg=${json.msg}`);
  }

  const expMs = decodeJwtExpiryMs(json.token) ?? now + 55 * 60 * 1000;
  cachedToken = { token: json.token, expiresAtMs: expMs };
  return json.token;
}

// --- Session create ------------------------------------------------------

export type AkoolStreamType = "trtc" | "agora" | "livekit";

export interface AkoolCreateSessionInput {
  avatarId: string;
  voiceId: string | null;
  durationSeconds: number;
  vadThreshold: number;
  vadSilenceMs: number;
  streamType?: AkoolStreamType;
}

export interface AkoolTrtcCredentials {
  sdkAppId: number;
  roomId: string;
  userId: string;
  userSig: string;
}

export interface AkoolAgoraCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

export interface AkoolCreateSessionResult {
  akoolSessionId: string;
  streamType: AkoolStreamType;
  trtc?: AkoolTrtcCredentials;
  agora?: AkoolAgoraCredentials;
}

export async function createAkoolSession(
  input: AkoolCreateSessionInput,
): Promise<AkoolCreateSessionResult> {
  const streamType: AkoolStreamType =
    input.streamType ?? ((process.env.AKOOL_STREAM_TYPE as AkoolStreamType | undefined) ?? "trtc");

  const token = await getAkoolToken();

  const body: Record<string, unknown> = {
    avatar_id: input.avatarId,
    duration: input.durationSeconds,
    language: "en",
    mode_type: 1, // Retelling: the avatar only speaks what we push.
    stream_type: streamType,
    voice_params: {
      stt_language: "en",
      stt_type: "openai_realtime",
      turn_detection: {
        type: "server_vad",
        threshold: input.vadThreshold,
        silence_duration_ms: input.vadSilenceMs,
      },
    },
  };
  if (input.voiceId) body.voice_id = input.voiceId;

  const res = await fetch(SESSION_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: {
    code?: number;
    msg?: string;
    data?: {
      _id?: string;
      stream_type?: string;
      credentials?: Record<string, unknown>;
    };
  };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Akool session/create: non-JSON (HTTP ${res.status})`);
  }
  if (json.code !== 1000 || !json.data?._id) {
    throw new Error(
      `Akool session/create failed: code=${json.code} msg=${json.msg}`,
    );
  }

  const creds = json.data.credentials ?? {};
  const out: AkoolCreateSessionResult = {
    akoolSessionId: json.data._id,
    streamType,
  };

  if (streamType === "trtc") {
    out.trtc = {
      sdkAppId: Number(creds.trtc_sdk_app_id),
      roomId: String(creds.trtc_sdk_room_id ?? ""),
      userId: String(creds.trtc_sdk_user_id ?? ""),
      userSig: String(creds.trtc_sdk_user_sig ?? ""),
    };
  } else if (streamType === "agora") {
    out.agora = {
      appId: String(creds.agora_app_id ?? ""),
      channel: String(creds.agora_channel ?? ""),
      uid: Number(creds.agora_uid),
      token: String(creds.agora_token ?? ""),
    };
  }

  return out;
}

// --- Session close -------------------------------------------------------

export async function closeAkoolSession(akoolSessionId: string): Promise<void> {
  const token = await getAkoolToken();
  const res = await fetch(SESSION_CLOSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: akoolSessionId }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Akool session/close HTTP ${res.status}`);
  }
  const json = await res.json().catch(() => ({}));
  if (json.code !== 1000) {
    // Log but don't throw — closing is best-effort; session will time out anyway.
    console.warn(
      `Akool session/close code=${json.code} msg=${json.msg} (ignored)`,
    );
  }
}
```

- [ ] **Step 9.4: Install `server-only` if not already present**

```bash
cd apps/web
pnpm list server-only
```

If absent:
```bash
pnpm add server-only
```

- [ ] **Step 9.5: Run tests and verify they pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/akool-client.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add apps/web/src/lib/speaking/akool-client.ts \
        apps/web/src/lib/speaking/__tests__/akool-client.test.ts \
        apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(speaking): add server-only akool-client (token cache + session create/close)"
```

---

## Task 10: `lib/speaking/session-state.ts` — sentinel parsing (shared server + client)

Mirrors the Python validator but runs in JS. Used by `/reply` route (server) to derive flags, and by the client runner to strip sentinels before pushing to Akool (defence in depth — the server strips first, but a pass on the client protects against any upstream drift).

**Files:**
- Create: `apps/web/src/lib/speaking/session-state.ts`
- Create: `apps/web/src/lib/speaking/__tests__/session-state.test.ts`

- [ ] **Step 10.1: Write failing tests**

Create `apps/web/src/lib/speaking/__tests__/session-state.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseExaminerOutput,
  SentinelParseError,
} from "../session-state";

describe("parseExaminerOutput", () => {
  it("returns a plain reply when there are no sentinels", () => {
    const out = parseExaminerOutput("Where do you live?", { currentPart: 1, lastPart: 2 });
    expect(out.reply).toBe("Where do you live?");
    expect(out.advancePart).toBeNull();
    expect(out.sessionEnd).toBe(false);
  });

  it("extracts [[PART:N]] and strips it from the reply", () => {
    const out = parseExaminerOutput("Great. [[PART:2]] Now describe this photo.", {
      currentPart: 1,
      lastPart: 2,
    });
    expect(out.advancePart).toBe(2);
    expect(out.reply).toBe("Great. Now describe this photo.");
    expect(out.sessionEnd).toBe(false);
  });

  it("extracts [[SESSION_END]]", () => {
    const out = parseExaminerOutput("Thank you. [[SESSION_END]]", {
      currentPart: 2,
      lastPart: 2,
    });
    expect(out.sessionEnd).toBe(true);
    expect(out.reply).toBe("Thank you.");
  });

  it("rejects advancePart that isn't ahead of current", () => {
    expect(() =>
      parseExaminerOutput("[[PART:1]] no", { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("rejects advancePart beyond last part", () => {
    expect(() =>
      parseExaminerOutput("[[PART:3]] no", { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("collapses whitespace after stripping", () => {
    const out = parseExaminerOutput(
      "Hello   [[PART:2]]   world",
      { currentPart: 1, lastPart: 2 },
    );
    expect(out.reply).toBe("Hello world");
  });
});
```

- [ ] **Step 10.2: Run the test and verify it fails**

```bash
pnpm vitest run src/lib/speaking/__tests__/session-state.test.ts
```

Expected: `Cannot find module '../session-state'`.

- [ ] **Step 10.3: Implement `session-state.ts`**

Create `apps/web/src/lib/speaking/session-state.ts`:

```typescript
/**
 * Shared (server + client) sentinel parser for Phase 3 Speaking.
 * Keeps `[[PART:N]]` + `[[SESSION_END]]` semantics identical to the
 * Python validator in services/ai/app/validators/speaking.py.
 */

export class SentinelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentinelParseError";
  }
}

export interface ParsedExaminerOutput {
  reply: string;
  advancePart: number | null;
  sessionEnd: boolean;
}

const PART_RE = /\[\[PART:(\d+)\]\]/g;
const END_RE = /\[\[SESSION_END\]\]/g;

export function parseExaminerOutput(
  raw: string,
  opts: { currentPart: number; lastPart: number },
): ParsedExaminerOutput {
  const { currentPart, lastPart } = opts;

  let advancePart: number | null = null;
  const partMatch = [...raw.matchAll(PART_RE)];
  if (partMatch.length > 0) {
    const n = Number(partMatch[0][1]);
    if (n <= currentPart) {
      throw new SentinelParseError(
        `[[PART:${n}]] is not ahead of currentPart ${currentPart}`,
      );
    }
    if (n > lastPart) {
      throw new SentinelParseError(
        `[[PART:${n}]] exceeds lastPart ${lastPart}`,
      );
    }
    advancePart = n;
  }

  const sessionEnd = END_RE.test(raw);
  // Reset lastIndex after the .test()
  END_RE.lastIndex = 0;

  let reply = raw.replace(PART_RE, "").replace(END_RE, "");
  reply = reply.replace(/\s{2,}/g, " ").trim();

  if (!reply) {
    throw new SentinelParseError("reply was empty after stripping sentinels");
  }

  return { reply, advancePart, sessionEnd };
}
```

- [ ] **Step 10.4: Run test and verify pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/session-state.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 10.5: Commit**

```bash
git add apps/web/src/lib/speaking/session-state.ts \
        apps/web/src/lib/speaking/__tests__/session-state.test.ts
git commit -m "feat(speaking): add shared sentinel parser (session-state)"
```

---

## Task 11: `lib/speaking/turn-buffer.ts` — in-memory server turn log

One map per attempt, keyed by `attemptId`. Each entry accumulates `{ userText, replyText, partNumber, ts }` as the `/reply` route completes turns. Flushed to `transcript` JSON at `/submit` time. Volatile — if the Node process restarts mid-session, we fall back to the client transcript buffer.

**Files:**
- Create: `apps/web/src/lib/speaking/turn-buffer.ts`
- Create: `apps/web/src/lib/speaking/__tests__/turn-buffer.test.ts`

- [ ] **Step 11.1: Write failing tests**

Create `apps/web/src/lib/speaking/__tests__/turn-buffer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  appendTurn,
  readTurns,
  clearTurns,
  __resetAllBuffers,
} from "../turn-buffer";

beforeEach(() => {
  __resetAllBuffers();
});

describe("turn-buffer", () => {
  it("starts empty for an unknown attempt", () => {
    expect(readTurns("attempt-1")).toEqual([]);
  });

  it("appends turns in arrival order", () => {
    appendTurn("attempt-1", {
      userText: "hi",
      replyText: "hello",
      partNumber: 1,
      ts: "2026-04-25T10:00:00Z",
    });
    appendTurn("attempt-1", {
      userText: "I live in Beijing",
      replyText: "nice",
      partNumber: 1,
      ts: "2026-04-25T10:00:05Z",
    });
    const turns = readTurns("attempt-1");
    expect(turns).toHaveLength(2);
    expect(turns[0].userText).toBe("hi");
    expect(turns[1].replyText).toBe("nice");
  });

  it("keeps separate buffers per attempt", () => {
    appendTurn("a", { userText: "u", replyText: "r", partNumber: 1, ts: "t" });
    appendTurn("b", { userText: "u2", replyText: "r2", partNumber: 1, ts: "t2" });
    expect(readTurns("a")).toHaveLength(1);
    expect(readTurns("b")).toHaveLength(1);
  });

  it("clearTurns drops the attempt's buffer", () => {
    appendTurn("a", { userText: "u", replyText: "r", partNumber: 1, ts: "t" });
    clearTurns("a");
    expect(readTurns("a")).toEqual([]);
  });
});
```

- [ ] **Step 11.2: Run failing test**

```bash
pnpm vitest run src/lib/speaking/__tests__/turn-buffer.test.ts
```

Expected: `Cannot find module '../turn-buffer'`.

- [ ] **Step 11.3: Implement `turn-buffer.ts`**

Create `apps/web/src/lib/speaking/turn-buffer.ts`:

```typescript
import "server-only";

export interface BufferedTurn {
  userText: string;
  replyText: string;
  partNumber: number;
  ts: string; // ISO-8601
}

// Process-local. Intentionally volatile: if the Next.js process recycles
// mid-session we fall through to the client transcript backup at submit.
const buffers = new Map<string, BufferedTurn[]>();

export function appendTurn(attemptId: string, turn: BufferedTurn): void {
  const list = buffers.get(attemptId);
  if (list) list.push(turn);
  else buffers.set(attemptId, [turn]);
}

export function readTurns(attemptId: string): BufferedTurn[] {
  return buffers.get(attemptId)?.slice() ?? [];
}

export function clearTurns(attemptId: string): void {
  buffers.delete(attemptId);
}

/** Test hook — resets all in-memory buffers. */
export function __resetAllBuffers(): void {
  buffers.clear();
}
```

- [ ] **Step 11.4: Run tests and verify pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/turn-buffer.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 11.5: Commit**

```bash
git add apps/web/src/lib/speaking/turn-buffer.ts \
        apps/web/src/lib/speaking/__tests__/turn-buffer.test.ts
git commit -m "feat(speaking): add in-memory turn-buffer for /reply"
```

---

## Task 12: `lib/speaking/transcript-reconciler.ts` — merge server + client buffers

At `/submit` time we take:
- the server `/reply` buffer (authoritative pairs of `{userText, replyText}`)
- the client `stream-message` backup (sequence of `{role, content, ts, source}`)

…and produce a single ordered transcript where each turn carries a `source` field. Server-sourced turns win on conflict; client-only turns fill gaps (e.g., a final user turn whose `/reply` response never completed).

**Files:**
- Create: `apps/web/src/lib/speaking/transcript-reconciler.ts`
- Create: `apps/web/src/lib/speaking/__tests__/transcript-reconciler.test.ts`

- [ ] **Step 12.1: Write failing tests**

Create `apps/web/src/lib/speaking/__tests__/transcript-reconciler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  reconcileTranscript,
  type ClientTranscriptTurn,
} from "../transcript-reconciler";
import type { BufferedTurn } from "../turn-buffer";

describe("reconcileTranscript", () => {
  it("converts the server buffer into a {user, assistant} sequence", () => {
    const server: BufferedTurn[] = [
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
      { userText: "I live in Beijing", replyText: "nice", partNumber: 1, ts: "2026-04-25T10:00:05Z" },
    ];
    const client: ClientTranscriptTurn[] = [];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });
    expect(out).toEqual([
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "server" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:00Z", source: "server" },
      { role: "user", content: "I live in Beijing", part: 1, ts: "2026-04-25T10:00:05Z", source: "server" },
      { role: "assistant", content: "nice", part: 1, ts: "2026-04-25T10:00:05Z", source: "server" },
    ]);
  });

  it("appends a trailing user turn from client buffer when server buffer is shorter", () => {
    const server: BufferedTurn[] = [
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
    ];
    const client: ClientTranscriptTurn[] = [
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "akool_stt" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:01Z", source: "akool_stt" },
      { role: "user", content: "I live in Beijing", part: 1, ts: "2026-04-25T10:00:05Z", source: "akool_stt" },
    ];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });

    // First two entries come from server; last user turn from client backup.
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ role: "user", content: "hi", source: "server" });
    expect(out[1]).toMatchObject({ role: "assistant", content: "hello", source: "server" });
    expect(out[2]).toMatchObject({
      role: "user",
      content: "I live in Beijing",
      source: "client_fallback",
    });
  });

  it("falls back to client buffer entirely when server buffer is empty", () => {
    const server: BufferedTurn[] = [];
    const client: ClientTranscriptTurn[] = [
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "akool_stt" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:01Z", source: "akool_stt" },
    ];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.source === "client_fallback")).toBe(true);
  });

  it("returns an empty array when both are empty", () => {
    expect(
      reconcileTranscript({ serverBuffer: [], clientBuffer: [] }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 12.2: Run failing test**

```bash
pnpm vitest run src/lib/speaking/__tests__/transcript-reconciler.test.ts
```

Expected: `Cannot find module '../transcript-reconciler'`.

- [ ] **Step 12.3: Implement `transcript-reconciler.ts`**

Create `apps/web/src/lib/speaking/transcript-reconciler.ts`:

```typescript
import type { BufferedTurn } from "./turn-buffer";

export type TranscriptSource = "server" | "akool_stt" | "client_fallback";

export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  part: number;
  ts: string;
  source: TranscriptSource;
}

export interface ClientTranscriptTurn {
  role: "user" | "assistant";
  content: string;
  part: number;
  ts: string;
  source: Exclude<TranscriptSource, "server">; // client only sees akool_stt or client_fallback
}

export function reconcileTranscript(args: {
  serverBuffer: BufferedTurn[];
  clientBuffer: ClientTranscriptTurn[];
}): TranscriptTurn[] {
  const { serverBuffer, clientBuffer } = args;

  const fromServer: TranscriptTurn[] = [];
  for (const turn of serverBuffer) {
    fromServer.push({
      role: "user",
      content: turn.userText,
      part: turn.partNumber,
      ts: turn.ts,
      source: "server",
    });
    fromServer.push({
      role: "assistant",
      content: turn.replyText,
      part: turn.partNumber,
      ts: turn.ts,
      source: "server",
    });
  }

  if (fromServer.length === 0) {
    return clientBuffer.map((t) => ({
      role: t.role,
      content: t.content,
      part: t.part,
      ts: t.ts,
      source: "client_fallback" as const,
    }));
  }

  // Append any client turns not already represented server-side.
  // Strategy: if client buffer has N entries and server has exactly N
  // user turns represented, we return server as-is. If client has more,
  // the tail entries are the gap.
  const serverUserCount = serverBuffer.length;
  const clientUserCount = clientBuffer.filter((t) => t.role === "user").length;

  if (clientUserCount <= serverUserCount) {
    return fromServer;
  }

  // Otherwise append trailing client turns beyond what the server saw.
  const tail: TranscriptTurn[] = [];
  let seenUsers = 0;
  for (const t of clientBuffer) {
    if (t.role === "user") {
      seenUsers += 1;
      if (seenUsers <= serverUserCount) continue;
    } else {
      // An assistant turn only "counts" if its preceding user was beyond
      // the server's view. Keep it too.
      if (seenUsers <= serverUserCount) continue;
    }
    tail.push({
      role: t.role,
      content: t.content,
      part: t.part,
      ts: t.ts,
      source: "client_fallback",
    });
  }

  return [...fromServer, ...tail];
}
```

- [ ] **Step 12.4: Run tests and verify they pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/transcript-reconciler.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 12.5: Commit**

```bash
git add apps/web/src/lib/speaking/transcript-reconciler.ts \
        apps/web/src/lib/speaking/__tests__/transcript-reconciler.test.ts
git commit -m "feat(speaking): add transcript-reconciler for submit-time merge"
```

---

## Task 13: `lib/speaking/persona-config.ts` + `scoring-client.ts`

Small wrappers. Kept together because they're each <40 lines and testable as a pair.

**Files:**
- Create: `apps/web/src/lib/speaking/persona-config.ts`
- Create: `apps/web/src/lib/speaking/scoring-client.ts`
- Create: `apps/web/src/lib/speaking/__tests__/persona-config.test.ts`

- [ ] **Step 13.1: Failing test**

Create `apps/web/src/lib/speaking/__tests__/persona-config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildPersonaSummary } from "../persona-config";

describe("buildPersonaSummary", () => {
  it("builds KET-level summary", () => {
    const out = buildPersonaSummary({
      level: "KET",
      initialGreeting: "Hello, I'm Mina.",
      partCount: 2,
    });
    expect(out).toContain("KET");
    expect(out).toContain("Mina");
    expect(out).toContain("2 parts");
  });

  it("builds PET-level summary", () => {
    const out = buildPersonaSummary({
      level: "PET",
      initialGreeting: "Hi, I'm Mina.",
      partCount: 4,
    });
    expect(out).toContain("PET");
    expect(out).toContain("4 parts");
  });
});
```

- [ ] **Step 13.2: Run failing test**

```bash
pnpm vitest run src/lib/speaking/__tests__/persona-config.test.ts
```

Expected: `Cannot find module '../persona-config'`.

- [ ] **Step 13.3: Implement both libs**

Create `apps/web/src/lib/speaking/persona-config.ts`:

```typescript
/**
 * Human-readable summary of the Mina persona for the current attempt.
 * Shown to students in the pre-flight UI and bundled in logs.
 * NB: the actual examiner system prompt lives in Python
 * (services/ai/app/prompts/speaking_examiner_system.py). This file just
 * renders a short client-facing blurb.
 */

export interface PersonaSummaryInput {
  level: "KET" | "PET";
  initialGreeting: string;
  partCount: number;
}

export function buildPersonaSummary(input: PersonaSummaryInput): string {
  return `Mina — a British Cambridge ${input.level} examiner (practice mode, light coaching). `
    + `Today's session has ${input.partCount} parts. `
    + `She'll open with: "${input.initialGreeting}"`;
}
```

Create `apps/web/src/lib/speaking/scoring-client.ts`:

```typescript
import "server-only";

import type { TranscriptTurn } from "./transcript-reconciler";

export interface SpeakingScoreResult {
  grammarVocab: number;
  discourseManagement: number;
  pronunciation: number;
  interactive: number;
  overall: number;
  justification: string;
  weakPoints: Array<{ tag: string; quote: string; suggestion: string }>;
}

export async function scoreSpeakingAttempt(args: {
  level: "KET" | "PET";
  transcript: TranscriptTurn[];
}): Promise<SpeakingScoreResult> {
  const base = process.env.INTERNAL_AI_URL;
  if (!base) throw new Error("Missing INTERNAL_AI_URL env");

  const res = await fetch(`${base}/speaking/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-shared-secret": process.env.INTERNAL_AI_SHARED_SECRET ?? "",
    },
    body: JSON.stringify({
      level: args.level,
      transcript: args.transcript.map((t) => ({
        role: t.role,
        content: t.content,
        part: t.part,
      })),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`speaking/score HTTP ${res.status}`);
  }
  return (await res.json()) as SpeakingScoreResult;
}
```

- [ ] **Step 13.4: Run persona tests and verify pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/persona-config.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 13.5: Commit**

```bash
git add apps/web/src/lib/speaking/persona-config.ts \
        apps/web/src/lib/speaking/scoring-client.ts \
        apps/web/src/lib/speaking/__tests__/persona-config.test.ts
git commit -m "feat(speaking): add persona-config + scoring-client"
```

---

# Phase D2 — Next.js API routes

All routes go under `apps/web/src/app/api/speaking/`. They all:
- Call `auth()` and 401 on missing session
- Verify `TestAttempt.userId === session.user.id` for `[attemptId]` routes (teachers/admins bypass via the existing RBAC helpers used in Phase 2)
- Return JSON responses with a stable shape — no SSE in MVP

## Task 14: `POST /api/speaking/tests/generate`

**Files:**
- Create: `apps/web/src/app/api/speaking/tests/generate/route.ts`
- Create: `apps/web/src/app/api/speaking/tests/__tests__/generate.test.ts`

- [ ] **Step 14.1: Write failing integration test**

Create `apps/web/src/app/api/speaking/tests/__tests__/generate.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../generate/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkAndRecordGeneration: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    test: { create: vi.fn() },
    testAttempt: { create: vi.fn() },
  },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_AI_URL = "http://localhost:8001";
  fetchMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/speaking/tests/generate", () => {
  it("generates a test + attempt and returns the attemptId", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          level: "KET",
          initialGreeting: "Hello, I'm Mina.",
          parts: [
            { partNumber: 1, title: "Interview", targetMinutes: 3, examinerScript: ["What's your name?"], coachingHints: "", photoKey: null },
            { partNumber: 2, title: "Photo", targetMinutes: 5, examinerScript: ["Describe this photo."], coachingHints: "", photoKey: "speaking/photos/park-01.jpg" },
          ],
        }),
        { status: 200 },
      ),
    );

    const { db } = await import("@/lib/db");
    (db.test.create as any).mockResolvedValue({ id: "test-1" });
    (db.testAttempt.create as any).mockResolvedValue({ id: "attempt-1" });

    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attemptId).toBe("attempt-1");
    expect(db.test.create).toHaveBeenCalled();
    expect(db.testAttempt.create).toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { checkAndRecordGeneration } = await import("@/lib/rate-limit");
    (checkAndRecordGeneration as any).mockResolvedValueOnce({
      ok: false,
      retryAfterSeconds: 3600,
    });
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 401 without a session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValueOnce(null);
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid level", async () => {
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "IELTS" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 14.2: Run failing test**

```bash
pnpm vitest run src/app/api/speaking/tests/__tests__/generate.test.ts
```

Expected: `Cannot find module '../generate/route'`.

- [ ] **Step 14.3: Implement the route**

Create `apps/web/src/app/api/speaking/tests/generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkAndRecordGeneration } from "@/lib/rate-limit";
import { pickPhotoKeys, PHOTO_LIBRARY_MANIFEST } from "@/lib/speaking/photo-library";

const bodySchema = z.object({
  level: z.enum(["KET", "PET"]),
  sourceTestId: z.string().optional(),
});

type SpeakingPromptsPayload = {
  level: "KET" | "PET";
  initialGreeting: string;
  parts: Array<{
    partNumber: number;
    title: string;
    targetMinutes: number;
    examinerScript: string[];
    coachingHints: string;
    photoKey: string | null;
  }>;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const rate = await checkAndRecordGeneration(session.user.id, "SPEAKING_ATTEMPT", 3);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429 },
    );
  }

  // Pick 1 photo for KET Part 2; 2 photos for PET (Part 2 + Part 3).
  const photoCount = body.level === "KET" ? 1 : 2;
  const photoKeys = pickPhotoKeys({
    level: body.level,
    count: photoCount,
  });
  const photoBriefs = photoKeys.map((key) => ({
    key,
    description:
      PHOTO_LIBRARY_MANIFEST.find((p) => p.key === key)?.description ?? "",
  }));

  // Call the Python generator.
  const aiBase = process.env.INTERNAL_AI_URL;
  if (!aiBase) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }
  const genRes = await fetch(`${aiBase}/speaking/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-shared-secret": process.env.INTERNAL_AI_SHARED_SECRET ?? "",
    },
    body: JSON.stringify({ level: body.level, photo_briefs: photoBriefs }),
    cache: "no-store",
  });
  if (!genRes.ok) {
    return NextResponse.json(
      { error: "generate failed", detail: `AI HTTP ${genRes.status}` },
      { status: 502 },
    );
  }
  const speakingPrompts = (await genRes.json()) as SpeakingPromptsPayload;

  const test = await db.test.create({
    data: {
      userId: session.user.id,
      examType: body.level,
      kind: "SPEAKING",
      mode: "PRACTICE",
      difficulty: body.level === "KET" ? "A2" : "B1",
      payload: {}, // Phase 1/2 compatibility; speaking uses its own column.
      generatedBy: "deepseek-chat",
      timeLimitSec: null,
      speakingPrompts,
      speakingPhotoKeys: speakingPrompts.parts
        .map((p) => p.photoKey)
        .filter((k): k is string => !!k),
      speakingPersona: body.level,
    },
  });

  const attempt = await db.testAttempt.create({
    data: {
      userId: session.user.id,
      testId: test.id,
      mode: "PRACTICE",
      speakingStatus: "IDLE",
    },
  });

  return NextResponse.json({ attemptId: attempt.id });
}
```

- [ ] **Step 14.4: Run test + verify pass**

```bash
pnpm vitest run src/app/api/speaking/tests/__tests__/generate.test.ts
```

Expected: all 4 tests pass. If the test complains about zod not being installed, `pnpm add zod` (most Phase 2 routes use zod; it's likely already in the lockfile).

- [ ] **Step 14.5: Commit**

```bash
git add apps/web/src/app/api/speaking/tests/generate/route.ts \
        apps/web/src/app/api/speaking/tests/__tests__/generate.test.ts
git commit -m "feat(speaking): POST /api/speaking/tests/generate"
```

---

## Task 15: `POST /api/speaking/[attemptId]/session` — mint Akool session

**Files:**
- Create: `apps/web/src/app/api/speaking/[attemptId]/session/route.ts`
- Create: `apps/web/src/app/api/speaking/[attemptId]/__tests__/session.test.ts`

- [ ] **Step 15.1: Write failing test**

Create `apps/web/src/app/api/speaking/[attemptId]/__tests__/session.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../session/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    testAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(async (args) => ({ id: args.where.id, ...args.data })),
    },
    test: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/speaking/akool-client", () => ({
  createAkoolSession: vi.fn(async () => ({
    akoolSessionId: "sess-1",
    streamType: "trtc",
    trtc: { sdkAppId: 111, roomId: "r1", userId: "u1", userSig: "s1" },
  })),
}));
vi.mock("@/lib/r2-signed-url", () => ({
  signR2PublicUrl: vi.fn((key: string, _ttl: number) => `https://r2.example/${key}`),
}));

beforeEach(() => {
  process.env.AKOOL_AVATAR_ID = "avatar-1";
  process.env.AKOOL_VOICE_ID = "voice-1";
  process.env.AKOOL_SESSION_DURATION_SEC = "900";
  process.env.AKOOL_VAD_THRESHOLD = "0.6";
  process.env.AKOOL_VAD_SILENCE_MS = "500";
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

const makeReq = (id: string) =>
  new Request(`http://x/api/speaking/${id}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

describe("POST /api/speaking/[attemptId]/session", () => {
  it("mints an Akool session for an IDLE attempt and returns TRTC creds", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "IDLE",
    });
    (db.test.findUnique as any).mockResolvedValue({
      id: "test-1",
      speakingPrompts: {
        level: "KET",
        initialGreeting: "Hello",
        parts: [
          { partNumber: 1, title: "Interview", targetMinutes: 3, examinerScript: ["q"], coachingHints: "", photoKey: null },
          { partNumber: 2, title: "Photo", targetMinutes: 5, examinerScript: ["q"], coachingHints: "", photoKey: "speaking/photos/park-01.jpg" },
        ],
      },
      speakingPhotoKeys: ["speaking/photos/park-01.jpg"],
    });

    const res = await POST(makeReq("attempt-1"), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.akoolSessionId).toBe("sess-1");
    expect(json.streamType).toBe("trtc");
    expect(json.trtc).toEqual({ sdkAppId: 111, roomId: "r1", userId: "u1", userSig: "s1" });
    expect(json.test.parts).toHaveLength(2);
    expect(json.test.photoUrls["speaking/photos/park-01.jpg"]).toMatch(/^https:\/\/r2\./);
    expect(db.testAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          speakingStatus: "IN_PROGRESS",
          akoolSessionId: "sess-1",
        }),
      }),
    );
  });

  it("returns 409 if the attempt is already IN_PROGRESS", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "IN_PROGRESS",
    });
    const res = await POST(makeReq("attempt-1"), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 when attempt not found or not owned", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue(null);
    const res = await POST(makeReq("nope"), { params: Promise.resolve({ attemptId: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 15.2: Run failing test**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/session.test.ts
```

Expected: `Cannot find module '../session/route'`.

- [ ] **Step 15.3: Implement the route**

Create `apps/web/src/app/api/speaking/[attemptId]/session/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAkoolSession } from "@/lib/speaking/akool-client";
import { signR2PublicUrl } from "@/lib/r2-signed-url";

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (attempt.speakingStatus !== "IDLE") {
    return NextResponse.json(
      { error: "session already in progress or finished" },
      { status: 409 },
    );
  }

  const test = await db.test.findUnique({ where: { id: attempt.testId } });
  if (!test?.speakingPrompts) {
    return NextResponse.json(
      { error: "test has no speaking prompts" },
      { status: 500 },
    );
  }

  const avatarId = process.env.AKOOL_AVATAR_ID;
  if (!avatarId) {
    return NextResponse.json(
      { error: "AKOOL_AVATAR_ID not configured" },
      { status: 500 },
    );
  }

  const created = await createAkoolSession({
    avatarId,
    voiceId: process.env.AKOOL_VOICE_ID || null,
    durationSeconds: Number(process.env.AKOOL_SESSION_DURATION_SEC ?? 900),
    vadThreshold: Number(process.env.AKOOL_VAD_THRESHOLD ?? 0.6),
    vadSilenceMs: Number(process.env.AKOOL_VAD_SILENCE_MS ?? 500),
  });

  await db.testAttempt.update({
    where: { id: attempt.id },
    data: {
      speakingStatus: "IN_PROGRESS",
      akoolSessionId: created.akoolSessionId,
    },
  });

  // Sign R2 photo URLs for the duration of the session.
  const ttl = Number(process.env.AKOOL_SESSION_DURATION_SEC ?? 900) + 120;
  const photoUrls: Record<string, string> = {};
  for (const key of (test.speakingPhotoKeys ?? [])) {
    photoUrls[key] = signR2PublicUrl(key, ttl);
  }

  return NextResponse.json({
    akoolSessionId: created.akoolSessionId,
    streamType: created.streamType,
    trtc: created.trtc,
    agora: created.agora,
    test: {
      parts: (test.speakingPrompts as any).parts,
      initialGreeting: (test.speakingPrompts as any).initialGreeting,
      photoUrls,
      level: test.speakingPersona,
    },
  });
}
```

**Note:** `@/lib/r2-signed-url` is the existing Phase 2 helper that signs R2 public URLs via the Next.js stream-proxy route. If the project uses a different helper (e.g. Phase 2 spec §6.1 mentions `/api/listening/[attemptId]/audio` as the stream proxy), reuse that same signing helper. The test mocks it directly.

- [ ] **Step 15.4: Run test + verify pass**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/session.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 15.5: Commit**

```bash
git add apps/web/src/app/api/speaking/[attemptId]/session/route.ts \
        apps/web/src/app/api/speaking/[attemptId]/__tests__/session.test.ts
git commit -m "feat(speaking): POST /api/speaking/[attemptId]/session"
```

---

## Task 16: `POST /api/speaking/[attemptId]/reply` — BYO-LLM turn handler

**Files:**
- Create: `apps/web/src/app/api/speaking/[attemptId]/reply/route.ts`
- Create: `apps/web/src/app/api/speaking/[attemptId]/__tests__/reply.test.ts`

- [ ] **Step 16.1: Write failing test**

Create `apps/web/src/app/api/speaking/[attemptId]/__tests__/reply.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../reply/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    testAttempt: { findUnique: vi.fn() },
    test: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/speaking/turn-buffer", () => ({
  appendTurn: vi.fn(),
  __resetAllBuffers: vi.fn(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_AI_URL = "http://localhost:8001";
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

function makeReq(attemptId: string, body: any) {
  return new Request(`http://x/api/speaking/${attemptId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const stubAttempt = async () => {
  const { db } = await import("@/lib/db");
  (db.testAttempt.findUnique as any).mockResolvedValue({
    id: "attempt-1",
    userId: "user-1",
    testId: "test-1",
    speakingStatus: "IN_PROGRESS",
  });
  (db.test.findUnique as any).mockResolvedValue({
    id: "test-1",
    speakingPrompts: {
      level: "KET",
      initialGreeting: "Hi",
      parts: [
        { partNumber: 1, title: "Interview", targetMinutes: 3, examinerScript: ["What's your name?"], coachingHints: "", photoKey: null },
        { partNumber: 2, title: "Photo", targetMinutes: 5, examinerScript: ["Describe this photo."], coachingHints: "", photoKey: null },
      ],
    },
  });
};

describe("POST /api/speaking/[attemptId]/reply", () => {
  it("happy path: calls examiner, buffers the turn, returns structured reply", async () => {
    await stubAttempt();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        reply: "Where do you live?",
        advancePart: null,
        sessionEnd: false,
      }), { status: 200 }),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "My name is Li Wei." }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe("Where do you live?");
    expect(json.flags.advancePart).toBeNull();
    expect(json.flags.sessionEnd).toBe(false);

    const { appendTurn } = await import("@/lib/speaking/turn-buffer");
    expect(appendTurn).toHaveBeenCalledWith("attempt-1", expect.objectContaining({
      userText: "My name is Li Wei.",
      replyText: "Where do you live?",
      partNumber: 1,
    }));
  });

  it("passes advancePart from the examiner through", async () => {
    await stubAttempt();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        reply: "Now describe this photo.",
        advancePart: 2,
        sessionEnd: false,
      }), { status: 200 }),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "I live in Beijing." }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    const json = await res.json();
    expect(json.flags.advancePart).toBe(2);
  });

  it("returns a polite filler reply when the AI service times out", async () => {
    await stubAttempt();
    fetchMock.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5)),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "hi" }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toMatch(/one moment|could you say/i);
    expect(json.flags.retry).toBe(true);
  });

  it("returns 409 when the attempt is not IN_PROGRESS", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "SUBMITTED",
    });
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "hi" }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 16.2: Run failing test**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/reply.test.ts
```

Expected: `Cannot find module '../reply/route'`.

- [ ] **Step 16.3: Implement the route**

Create `apps/web/src/app/api/speaking/[attemptId]/reply/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { appendTurn } from "@/lib/speaking/turn-buffer";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  currentPart: z.number().int().min(1).max(6),
});

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

const REPLY_TIMEOUT_MS = 10_000;
const FILLER_REPLY = "One moment — could you say that again?";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (attempt.speakingStatus !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "attempt not in progress" },
      { status: 409 },
    );
  }

  const test = await db.test.findUnique({ where: { id: attempt.testId } });
  if (!test?.speakingPrompts) {
    return NextResponse.json({ error: "no prompts" }, { status: 500 });
  }

  const aiBase = process.env.INTERNAL_AI_URL;
  if (!aiBase) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

  try {
    const aiRes = await fetchWithTimeout(
      `${aiBase}/speaking/examiner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-shared-secret": process.env.INTERNAL_AI_SHARED_SECRET ?? "",
        },
        body: JSON.stringify({
          prompts: test.speakingPrompts,
          history: body.messages,
          current_part: body.currentPart,
        }),
        cache: "no-store",
      },
      REPLY_TIMEOUT_MS,
    );
    if (!aiRes.ok) throw new Error(`AI HTTP ${aiRes.status}`);

    const parsed = (await aiRes.json()) as {
      reply: string;
      advancePart: number | null;
      sessionEnd: boolean;
    };

    if (lastUser) {
      appendTurn(attemptId, {
        userText: lastUser.content,
        replyText: parsed.reply,
        partNumber: body.currentPart,
        ts: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      reply: parsed.reply,
      flags: {
        advancePart: parsed.advancePart ?? null,
        sessionEnd: parsed.sessionEnd ?? false,
      },
    });
  } catch (err) {
    console.warn("[speaking/reply] upstream failure; returning filler", err);
    return NextResponse.json({
      reply: FILLER_REPLY,
      flags: { advancePart: null, sessionEnd: false, retry: true },
    });
  }
}
```

- [ ] **Step 16.4: Run test + verify pass**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/reply.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 16.5: Commit**

```bash
git add apps/web/src/app/api/speaking/[attemptId]/reply/route.ts \
        apps/web/src/app/api/speaking/[attemptId]/__tests__/reply.test.ts
git commit -m "feat(speaking): POST /api/speaking/[attemptId]/reply"
```

---

## Task 17: `POST /api/speaking/[attemptId]/submit` — finalize + score

**Files:**
- Create: `apps/web/src/app/api/speaking/[attemptId]/submit/route.ts`
- Create: `apps/web/src/app/api/speaking/[attemptId]/__tests__/submit.test.ts`

- [ ] **Step 17.1: Write failing test**

Create `apps/web/src/app/api/speaking/[attemptId]/__tests__/submit.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../submit/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    testAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(async (args) => ({ id: args.where.id, ...args.data })),
    },
  },
}));
vi.mock("@/lib/speaking/akool-client", () => ({
  closeAkoolSession: vi.fn(async () => {}),
}));
vi.mock("@/lib/speaking/turn-buffer", () => ({
  readTurns: vi.fn(),
  clearTurns: vi.fn(),
  __resetAllBuffers: vi.fn(),
}));
vi.mock("@/lib/speaking/scoring-client", () => ({
  scoreSpeakingAttempt: vi.fn(async () => ({
    grammarVocab: 3, discourseManagement: 3, pronunciation: 3, interactive: 3,
    overall: 3.0, justification: "ok",
    weakPoints: [],
  })),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function makeReq(id: string, body: any) {
  return new Request(`http://x/api/speaking/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speaking/[attemptId]/submit", () => {
  it("idempotent: returns ok when already past IN_PROGRESS", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t", speakingStatus: "SCORED",
    });
    const res = await POST(makeReq("attempt-1", {}), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("happy path: reconciles transcript, closes Akool, fires scoring", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
    ]);

    const res = await POST(makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);

    const { closeAkoolSession } = await import("@/lib/speaking/akool-client");
    expect(closeAkoolSession).toHaveBeenCalledWith("sess-1");
    expect(db.testAttempt.update).toHaveBeenCalledTimes(2);
    // 1st update: SUBMITTED + transcript
    expect((db.testAttempt.update as any).mock.calls[0][0].data.speakingStatus).toBe("SUBMITTED");
    // 2nd update: SCORING → SCORED with scores
    // (Depending on waitUntil mocking, scoring may happen later. For test
    // purposes, the route returns as soon as SUBMITTED is persisted.)
  });

  it("FAILED when both server + client transcripts are empty", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([]);

    const res = await POST(makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    expect((db.testAttempt.update as any).mock.calls[0][0].data.speakingStatus).toBe("FAILED");
  });
});
```

- [ ] **Step 17.2: Run failing test**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/submit.test.ts
```

Expected: `Cannot find module '../submit/route'`.

- [ ] **Step 17.3: Implement the route**

Create `apps/web/src/app/api/speaking/[attemptId]/submit/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { closeAkoolSession } from "@/lib/speaking/akool-client";
import {
  readTurns,
  clearTurns,
} from "@/lib/speaking/turn-buffer";
import {
  reconcileTranscript,
  type ClientTranscriptTurn,
} from "@/lib/speaking/transcript-reconciler";
import { scoreSpeakingAttempt } from "@/lib/speaking/scoring-client";

const clientTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  part: z.number().int().min(1).max(6),
  ts: z.string(),
  source: z.enum(["akool_stt", "client_fallback"]),
});

const bodySchema = z.object({
  clientTranscript: z.array(clientTurnSchema).default([]),
});

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const attempt = await db.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Idempotency: once we're past IN_PROGRESS, no-op.
  if (attempt.speakingStatus !== "IN_PROGRESS") {
    return NextResponse.json({ ok: true });
  }

  // Fire-and-forget the Akool close.
  if (attempt.akoolSessionId) {
    closeAkoolSession(attempt.akoolSessionId).catch((err) =>
      console.warn("akool session/close failed (ignored)", err),
    );
  }

  const serverBuffer = readTurns(attemptId);
  const clientBuffer = body.clientTranscript as ClientTranscriptTurn[];
  const transcript = reconcileTranscript({ serverBuffer, clientBuffer });

  if (transcript.length === 0) {
    await db.testAttempt.update({
      where: { id: attempt.id },
      data: {
        speakingStatus: "FAILED",
        speakingError: "No transcript captured",
      },
    });
    clearTurns(attemptId);
    return NextResponse.json({ ok: true });
  }

  await db.testAttempt.update({
    where: { id: attempt.id },
    data: {
      speakingStatus: "SUBMITTED",
      transcript,
      submittedAt: new Date(),
    },
  });
  clearTurns(attemptId);

  // Fire scoring asynchronously. We return to the client now; the status
  // endpoint will surface SCORING → SCORED / FAILED.
  runScoringInBackground(attempt.id, attempt.testId, transcript);

  return NextResponse.json({ ok: true });
}

async function runScoringInBackground(
  attemptId: string,
  testId: string,
  transcript: ReturnType<typeof reconcileTranscript>,
) {
  try {
    await db.testAttempt.update({
      where: { id: attemptId },
      data: { speakingStatus: "SCORING" },
    });
    const test = await db.test.findUnique({ where: { id: testId } });
    const level = (test?.speakingPersona as "KET" | "PET" | null) ?? "KET";
    const scored = await scoreSpeakingAttempt({ level, transcript });

    const totalPossible = 20; // 5 × 4 criteria
    const rawScore = Math.round(
      scored.grammarVocab +
        scored.discourseManagement +
        scored.pronunciation +
        scored.interactive,
    );
    const scaledScore = Math.round((rawScore / totalPossible) * 100);

    await db.testAttempt.update({
      where: { id: attemptId },
      data: {
        speakingStatus: "SCORED",
        rubricScores: scored,
        rawScore,
        totalPossible,
        scaledScore,
        weakPoints: scored.weakPoints,
      },
    });
  } catch (err) {
    console.error("scoring failed", err);
    await db.testAttempt.update({
      where: { id: attemptId },
      data: {
        speakingStatus: "FAILED",
        speakingError: `scoring failed: ${(err as Error).message}`.slice(0, 200),
      },
    });
  }
}
```

- [ ] **Step 17.4: Run test + verify**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/submit.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 17.5: Commit**

```bash
git add apps/web/src/app/api/speaking/[attemptId]/submit/route.ts \
        apps/web/src/app/api/speaking/[attemptId]/__tests__/submit.test.ts
git commit -m "feat(speaking): POST /api/speaking/[attemptId]/submit + async scoring"
```

---

## Task 18: `GET /api/speaking/[attemptId]/status`

**Files:**
- Create: `apps/web/src/app/api/speaking/[attemptId]/status/route.ts`
- Create: `apps/web/src/app/api/speaking/[attemptId]/__tests__/status.test.ts`

- [ ] **Step 18.1: Failing test**

Create `apps/web/src/app/api/speaking/[attemptId]/__tests__/status.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../status/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/db", () => ({
  db: { testAttempt: { findUnique: vi.fn() } },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const makeReq = (id: string) =>
  new Request(`http://x/api/speaking/${id}/status`, { method: "GET" });

describe("GET /api/speaking/[attemptId]/status", () => {
  it("returns the full status payload", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      speakingStatus: "SCORED",
      rubricScores: { overall: 3.5 },
      speakingError: null,
    });
    const res = await GET(makeReq("attempt-1"),
      { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.speakingStatus).toBe("SCORED");
    expect(json.rubricScores.overall).toBe(3.5);
  });

  it("returns 404 when not owned", async () => {
    const { db } = await import("@/lib/db");
    (db.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "other-user",
      speakingStatus: "SCORED",
    });
    const res = await GET(makeReq("attempt-1"),
      { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 18.2: Run failing test**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/status.test.ts
```

Expected: `Cannot find module '../status/route'`.

- [ ] **Step 18.3: Implement**

Create `apps/web/src/app/api/speaking/[attemptId]/status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      userId: true,
      speakingStatus: true,
      rubricScores: true,
      speakingError: true,
    },
  });
  if (!attempt || attempt.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    speakingStatus: attempt.speakingStatus,
    rubricScores: attempt.rubricScores ?? null,
    speakingError: attempt.speakingError ?? null,
  });
}
```

- [ ] **Step 18.4: Run test + verify + commit**

```bash
pnpm vitest run src/app/api/speaking/[attemptId]/__tests__/status.test.ts
git add apps/web/src/app/api/speaking/[attemptId]/status/route.ts \
        apps/web/src/app/api/speaking/[attemptId]/__tests__/status.test.ts
git commit -m "feat(speaking): GET /api/speaking/[attemptId]/status"
```

---

# Phase E — Runner UX (TRTC + React components)

## Task 19: `lib/speaking/trtc-client.ts` — client-only TRTC wrapper

Small client-only wrapper around `trtc-sdk-v5` that (1) joins a room with given credentials, (2) exposes helpers to send and receive Akool's custom messages, (3) publishes the student's mic, (4) cleanly exits. This file is pure module-level and is testable without a browser using a light mock.

**Files:**
- Create: `apps/web/src/lib/speaking/trtc-client.ts`
- Create: `apps/web/src/lib/speaking/__tests__/trtc-client.test.ts`
- Modify: `apps/web/package.json` — add `"trtc-sdk-v5": "^5.10.0"`

- [ ] **Step 19.1: Install the SDK**

```bash
cd apps/web
pnpm add trtc-sdk-v5
```

- [ ] **Step 19.2: Failing test**

Create `apps/web/src/lib/speaking/__tests__/trtc-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock trtc-sdk-v5 before import.
const trtcMock = {
  enterRoom: vi.fn(async () => {}),
  exitRoom: vi.fn(async () => {}),
  startLocalAudio: vi.fn(async () => {}),
  stopLocalAudio: vi.fn(async () => {}),
  sendCustomMessage: vi.fn(() => true),
  on: vi.fn(),
  off: vi.fn(),
  subscribeRemoteVideo: vi.fn(async () => {}),
};
vi.mock("trtc-sdk-v5", () => ({
  default: { create: vi.fn(() => trtcMock), EVENT: {
    REMOTE_AUDIO_AVAILABLE: "remote-audio-available",
    REMOTE_VIDEO_AVAILABLE: "remote-video-available",
    CUSTOM_MESSAGE: "custom-message",
    KICKED_OUT: "kicked-out",
    ROOM_DISCONNECTED: "room-disconnected",
  } },
}));

import { createMinaTrtcSession, type StreamMessage } from "../trtc-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trtc-client", () => {
  it("joins room, publishes mic, exposes send() and onMessage()", async () => {
    const receivedMessages: StreamMessage[] = [];
    const session = await createMinaTrtcSession({
      credentials: {
        sdkAppId: 111, roomId: "room-1", userId: "user-1", userSig: "sig-1",
      },
      onMessage: (m) => receivedMessages.push(m),
      onRemoteVideoAvailable: vi.fn(),
    });

    expect(trtcMock.enterRoom).toHaveBeenCalled();
    expect(trtcMock.startLocalAudio).toHaveBeenCalled();

    // Simulate an incoming CUSTOM_MESSAGE event.
    const onHandlerArgs = (trtcMock.on as any).mock.calls.find(
      (c: any[]) => c[0] === "custom-message",
    );
    expect(onHandlerArgs).toBeTruthy();
    onHandlerArgs[1]({ data: new TextEncoder().encode(JSON.stringify({
      v: 2, type: "chat", pld: { from: "user", text: "hello" }, fin: true, idx: 0,
    })) });
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].pld.from).toBe("user");

    // sendChat
    await session.sendChat("hello there");
    expect(trtcMock.sendCustomMessage).toHaveBeenCalled();
    const payload = (trtcMock.sendCustomMessage as any).mock.calls.at(-1)[0];
    const decoded = JSON.parse(new TextDecoder().decode(payload.data));
    expect(decoded.type).toBe("chat");
    expect(decoded.pld.text).toBe("hello there");

    // interrupt
    await session.interrupt();
    const last = (trtcMock.sendCustomMessage as any).mock.calls.at(-1)[0];
    const lastDecoded = JSON.parse(new TextDecoder().decode(last.data));
    expect(lastDecoded.type).toBe("command");
    expect(lastDecoded.pld.cmd).toBe("interrupt");

    // close
    await session.close();
    expect(trtcMock.stopLocalAudio).toHaveBeenCalled();
    expect(trtcMock.exitRoom).toHaveBeenCalled();
  });
});
```

- [ ] **Step 19.3: Run failing test**

```bash
pnpm vitest run src/lib/speaking/__tests__/trtc-client.test.ts
```

Expected: `Cannot find module '../trtc-client'`.

- [ ] **Step 19.4: Implement**

Create `apps/web/src/lib/speaking/trtc-client.ts`:

```typescript
"use client";

import TRTC from "trtc-sdk-v5";

export interface MinaTrtcCredentials {
  sdkAppId: number;
  roomId: string;
  userId: string;
  userSig: string;
}

export interface StreamMessage {
  v: number;
  type: "chat" | "command";
  mid?: string;
  idx?: number;
  fin?: boolean;
  pld: {
    from?: "user" | "bot";
    text?: string;
    cmd?: string;
    code?: number;
    msg?: string;
  };
}

export interface MinaTrtcSession {
  sendChat(text: string): Promise<void>;
  interrupt(): Promise<void>;
  close(): Promise<void>;
}

export async function createMinaTrtcSession(args: {
  credentials: MinaTrtcCredentials;
  onMessage: (m: StreamMessage) => void;
  onRemoteVideoAvailable?: (userId: string) => void;
  onRemoteAudioAvailable?: (userId: string) => void;
  onDisconnected?: () => void;
}): Promise<MinaTrtcSession> {
  const client = TRTC.create();

  client.on(TRTC.EVENT.CUSTOM_MESSAGE, (event: { data: Uint8Array | ArrayBuffer }) => {
    try {
      const buf = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : (event.data as Uint8Array);
      const text = new TextDecoder().decode(buf);
      const msg = JSON.parse(text) as StreamMessage;
      args.onMessage(msg);
    } catch (err) {
      console.warn("[trtc] failed to parse custom message", err);
    }
  });

  if (args.onRemoteVideoAvailable) {
    client.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (e: { userId: string }) =>
      args.onRemoteVideoAvailable!(e.userId),
    );
  }
  if (args.onRemoteAudioAvailable) {
    client.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, (e: { userId: string }) =>
      args.onRemoteAudioAvailable!(e.userId),
    );
  }
  if (args.onDisconnected) {
    client.on(TRTC.EVENT.ROOM_DISCONNECTED, args.onDisconnected);
    client.on(TRTC.EVENT.KICKED_OUT, args.onDisconnected);
  }

  await client.enterRoom({
    sdkAppId: args.credentials.sdkAppId,
    userId: args.credentials.userId,
    userSig: args.credentials.userSig,
    strRoomId: args.credentials.roomId, // Akool uses strRoomId
    role: "anchor",
  } as any);

  await client.startLocalAudio();

  let sentCount = 0;

  async function sendRaw(msg: StreamMessage): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(msg));
    await client.sendCustomMessage({ data });
  }

  return {
    async sendChat(text: string) {
      sentCount += 1;
      await sendRaw({
        v: 2,
        type: "chat",
        mid: `msg-${Date.now()}-${sentCount}`,
        idx: 0,
        fin: true,
        pld: { text },
      });
    },
    async interrupt() {
      await sendRaw({
        v: 2,
        type: "command",
        mid: `cmd-${Date.now()}`,
        pld: { cmd: "interrupt" },
      });
    },
    async close() {
      try {
        await client.stopLocalAudio();
      } catch {
        /* ignore */
      }
      try {
        await client.exitRoom();
      } catch {
        /* ignore */
      }
    },
  };
}
```

- [ ] **Step 19.5: Run test + verify pass**

```bash
pnpm vitest run src/lib/speaking/__tests__/trtc-client.test.ts
```

Expected: 1 test passes (multiple assertions within).

- [ ] **Step 19.6: Commit**

```bash
git add apps/web/src/lib/speaking/trtc-client.ts \
        apps/web/src/lib/speaking/__tests__/trtc-client.test.ts \
        apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(speaking): add client-only trtc-client wrapper"
```

---

## Task 20: `lib/speaking/client-transcript-buffer.ts`

Tiny client helper. Buffers every `stream-message` with `fin:true` into an in-memory array tagged with the current part. Flushed into the `/submit` body as the backup transcript.

**Files:**
- Create: `apps/web/src/lib/speaking/client-transcript-buffer.ts`
- Create: `apps/web/src/lib/speaking/__tests__/client-transcript-buffer.test.ts`

- [ ] **Step 20.1: Failing test + impl combined (small)**

Create `apps/web/src/lib/speaking/__tests__/client-transcript-buffer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createClientTranscriptBuffer } from "../client-transcript-buffer";

describe("client-transcript-buffer", () => {
  it("captures user + bot turns with current part", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: true, idx: 0,
      pld: { from: "user", text: "hello" },
    });
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: true, idx: 0,
      pld: { from: "bot", text: "hi there" },
    });
    const turns = buf.snapshot();
    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe("user");
    expect(turns[1].role).toBe("assistant");
    expect(turns[0].source).toBe("akool_stt");
  });

  it("ignores non-fin messages (chunked mid-stream)", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: false, idx: 0,
      pld: { from: "bot", text: "partial" },
    });
    expect(buf.snapshot()).toHaveLength(0);
  });

  it("ignores non-chat types (commands)", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "command", pld: { cmd: "set-params", code: 1000 },
    });
    expect(buf.snapshot()).toHaveLength(0);
  });
});
```

- [ ] **Step 20.2: Implement**

Create `apps/web/src/lib/speaking/client-transcript-buffer.ts`:

```typescript
"use client";

import type { StreamMessage } from "./trtc-client";
import type { ClientTranscriptTurn } from "./transcript-reconciler";

export interface ClientTranscriptBuffer {
  setCurrentPart(part: number): void;
  captureStreamMessage(msg: StreamMessage): void;
  snapshot(): ClientTranscriptTurn[];
  clear(): void;
}

export function createClientTranscriptBuffer(): ClientTranscriptBuffer {
  let currentPart = 1;
  const turns: ClientTranscriptTurn[] = [];

  return {
    setCurrentPart(part) {
      currentPart = part;
    },
    captureStreamMessage(msg) {
      if (msg.type !== "chat" || !msg.fin) return;
      const text = msg.pld.text;
      if (!text) return;
      const from = msg.pld.from;
      if (from !== "user" && from !== "bot") return;
      turns.push({
        role: from === "user" ? "user" : "assistant",
        content: text,
        part: currentPart,
        ts: new Date().toISOString(),
        source: "akool_stt",
      });
    },
    snapshot() {
      return turns.slice();
    },
    clear() {
      turns.length = 0;
    },
  };
}
```

- [ ] **Step 20.3: Run + commit**

```bash
pnpm vitest run src/lib/speaking/__tests__/client-transcript-buffer.test.ts
git add apps/web/src/lib/speaking/client-transcript-buffer.ts \
        apps/web/src/lib/speaking/__tests__/client-transcript-buffer.test.ts
git commit -m "feat(speaking): add client transcript buffer for submit-time backup"
```

---

## Task 21: Minimum runner — one-turn happy path

Goal: a barebones `/runner/[attemptId]` page that opens an Akool session, joins TRTC, shows Mina's video track, captures one user turn end, posts `/reply`, sends the reply text back over TRTC, and confirms the turn completes end-to-end against a real Akool session + real DeepSeek. No photo panel / progress bar yet.

**Files:**
- Create: `apps/web/src/components/speaking/SpeakingRunner.tsx`
- Create: `apps/web/src/components/speaking/MinaAvatarPanel.tsx`
- Create: `apps/web/src/components/speaking/StatusPill.tsx`
- Create: `apps/web/src/app/ket/speaking/runner/[attemptId]/page.tsx`
- Create: `apps/web/src/app/pet/speaking/runner/[attemptId]/page.tsx`

- [ ] **Step 21.1: Write `StatusPill.tsx`**

```tsx
"use client";

export type SpeakingStatusLabel = "connecting" | "listening" | "thinking" | "speaking" | "ended";

const COPY: Record<SpeakingStatusLabel, string> = {
  connecting: "正在连接…",
  listening: "请开始讲话",
  thinking: "Mina 正在思考…",
  speaking: "Mina 正在讲话",
  ended: "已结束",
};

const DOT: Record<SpeakingStatusLabel, string> = {
  connecting: "bg-neutral-400 animate-pulse",
  listening: "bg-emerald-500",
  thinking: "bg-amber-500 animate-pulse",
  speaking: "bg-blue-500",
  ended: "bg-neutral-500",
};

export function StatusPill({ status }: { status: SpeakingStatusLabel }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-sm text-neutral-100">
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
      <span>{COPY[status]}</span>
    </div>
  );
}
```

- [ ] **Step 21.2: Write `MinaAvatarPanel.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import TRTC from "trtc-sdk-v5";

interface Props {
  remoteUserId: string | null;
}

export function MinaAvatarPanel({ remoteUserId }: Props) {
  const viewRef = useRef<HTMLDivElement | null>(null);

  // The actual track-to-view binding happens in SpeakingRunner via
  // client.subscribeRemoteVideo({ userId, view }); this component
  // just provides the DOM mount point identified by id.
  return (
    <div
      ref={viewRef}
      id="mina-video"
      className="relative aspect-[9/16] w-full max-w-[480px] overflow-hidden rounded-2xl bg-neutral-950 md:aspect-[3/4]"
    >
      {!remoteUserId && (
        <div className="absolute inset-0 grid place-items-center text-neutral-500 text-sm">
          正在加载 Mina…
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 21.3: Write `SpeakingRunner.tsx` (minimum version)**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TRTC from "trtc-sdk-v5";

import {
  createMinaTrtcSession,
  type MinaTrtcCredentials,
  type MinaTrtcSession,
  type StreamMessage,
} from "@/lib/speaking/trtc-client";
import {
  createClientTranscriptBuffer,
  type ClientTranscriptBuffer,
} from "@/lib/speaking/client-transcript-buffer";
import { MinaAvatarPanel } from "./MinaAvatarPanel";
import { StatusPill, type SpeakingStatusLabel } from "./StatusPill";

interface SpeakingTestContext {
  parts: Array<{
    partNumber: number;
    title: string;
    targetMinutes: number;
    photoKey: string | null;
  }>;
  initialGreeting: string;
  photoUrls: Record<string, string>;
  level: "KET" | "PET";
}

interface SessionInit {
  akoolSessionId: string;
  streamType: "trtc";
  trtc: MinaTrtcCredentials;
  test: SpeakingTestContext;
}

interface Props {
  attemptId: string;
  level: "KET" | "PET";
}

export function SpeakingRunner({ attemptId, level }: Props) {
  const [status, setStatus] = useState<SpeakingStatusLabel>("connecting");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const sessionRef = useRef<MinaTrtcSession | null>(null);
  const bufRef = useRef<ClientTranscriptBuffer>(createClientTranscriptBuffer());
  const currentPartRef = useRef(1);
  const testCtxRef = useRef<SpeakingTestContext | null>(null);
  const endedRef = useRef(false);

  // Sync currentPart → buffer
  useEffect(() => {
    currentPartRef.current = currentPart;
    bufRef.current.setCurrentPart(currentPart);
  }, [currentPart]);

  const handleMessage = useCallback(async (msg: StreamMessage) => {
    if (endedRef.current) return;
    bufRef.current.captureStreamMessage(msg);

    // Only trigger /reply on the end of a USER turn.
    if (msg.type !== "chat" || !msg.fin) return;
    if (msg.pld.from !== "user") return;
    if (!msg.pld.text) return;

    setStatus("thinking");

    // Build full history from the local buffer (user + bot turns).
    const history = bufRef.current.snapshot().map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch(`/api/speaking/${attemptId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentPart: currentPartRef.current }),
      });
      if (!res.ok) throw new Error(`/reply HTTP ${res.status}`);
      const json = await res.json() as {
        reply: string;
        flags: { advancePart: number | null; sessionEnd: boolean; retry?: boolean };
      };

      if (json.flags.advancePart != null) {
        setCurrentPart(json.flags.advancePart);
      }
      setStatus("speaking");
      await sessionRef.current?.sendChat(json.reply);

      if (json.flags.sessionEnd) {
        endedRef.current = true;
        setStatus("ended");
        // Small delay so Akool finishes TTS.
        setTimeout(() => void submitAndNavigate(), 1200);
      } else {
        // Listening resumes when Akool STT fires the next user turn.
        setStatus("listening");
      }
    } catch (err) {
      console.error("[runner] reply failed", err);
      setStatus("listening");
    }
  }, [attemptId]);

  const submitAndNavigate = useCallback(async () => {
    try {
      await fetch(`/api/speaking/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientTranscript: bufRef.current.snapshot() }),
        keepalive: true,
      });
    } finally {
      await sessionRef.current?.close();
      const resultBase = level === "KET" ? "/ket" : "/pet";
      window.location.href = `${resultBase}/speaking/result/${attemptId}`;
    }
  }, [attemptId, level]);

  // Mount: create session → TRTC join → start listening
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) throw new Error(`/session HTTP ${res.status}`);
        const init = (await res.json()) as SessionInit;
        if (cancelled) return;
        testCtxRef.current = init.test;

        // Pre-warm the examiner LLM
        fetch((process.env.NEXT_PUBLIC_AI_WARMUP_URL ?? "/api/speaking/warmup"), {
          method: "POST", body: "{}",
        }).catch(() => {});

        const session = await createMinaTrtcSession({
          credentials: init.trtc,
          onMessage: handleMessage,
          onRemoteVideoAvailable: (userId) => {
            setRemoteUserId(userId);
            // Bind the remote video track to #mina-video.
            const client = (session as any)._client ?? null;
            if (client?.subscribeRemoteVideo) {
              client.subscribeRemoteVideo({ userId, view: "mina-video", streamType: 0 });
            }
          },
          onDisconnected: () => {
            setError("连接已断开,请刷新重试。");
            setStatus("ended");
          },
        });
        sessionRef.current = session;
        setStatus("listening");

        // Send the initial greeting so Mina opens the conversation.
        if (init.test.initialGreeting) {
          await session.sendChat(init.test.initialGreeting);
        }
      } catch (err) {
        console.error("[runner] bootstrap failed", err);
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.close();
    };
  }, [attemptId, handleMessage]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-500">{error}</p>
        <a className="mt-4 inline-block underline" href={`/${level.toLowerCase()}/speaking/new`}>返回</a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 p-6">
      <div className="flex w-full justify-end">
        <StatusPill status={status} />
      </div>
      <MinaAvatarPanel remoteUserId={remoteUserId} />
    </div>
  );
}
```

- [ ] **Step 21.4: Create the two runner pages**

Create `apps/web/src/app/ket/speaking/runner/[attemptId]/page.tsx`:

```tsx
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <SpeakingRunner attemptId={attemptId} level="KET" />;
}
```

Create `apps/web/src/app/pet/speaking/runner/[attemptId]/page.tsx`:

```tsx
import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <SpeakingRunner attemptId={attemptId} level="PET" />;
}
```

- [ ] **Step 21.5: Update `next.config.ts`** — exclude `trtc-sdk-v5` from server-component bundling

Modify `apps/web/next.config.ts`. In the existing `serverExternalPackages` array (added during Phase 2 for ffmpeg-static), append:

```ts
"trtc-sdk-v5",
```

This prevents Turbopack from trying to resolve the SDK in server contexts (it's strictly client-only).

- [ ] **Step 21.6: Typecheck**

```bash
cd apps/web
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 21.7: Browser verify (requires real Akool session + real DeepSeek)**

Start the three services (see Conventions at top of plan). Manually create a speaking attempt for the signed-in user:

```bash
cd apps/web
pnpm dlx tsx -e "
import { PrismaClient } from '@prisma/client';
(async () => {
  const db = new PrismaClient();
  // TODO: replace with your seed user id
  const userId = (await db.user.findFirstOrThrow()).id;
  const test = await db.test.create({
    data: {
      userId, examType: 'KET', kind: 'SPEAKING', mode: 'PRACTICE',
      difficulty: 'A2', generatedBy: 'manual',
      payload: {},
      speakingPrompts: {
        level: 'KET',
        initialGreeting: \"Hello, I'm Mina. Let's begin with some questions about you.\",
        parts: [
          { partNumber: 1, title: 'Interview', targetMinutes: 3, examinerScript: ['What is your name?', 'Where do you live?'], coachingHints: '', photoKey: null },
          { partNumber: 2, title: 'Photo', targetMinutes: 5, examinerScript: ['Describe this photo.'], coachingHints: '', photoKey: 'speaking/photos/park-03.jpg' },
        ],
      },
      speakingPhotoKeys: ['speaking/photos/park-03.jpg'],
      speakingPersona: 'KET',
    },
  });
  const attempt = await db.testAttempt.create({
    data: { userId, testId: test.id, mode: 'PRACTICE', speakingStatus: 'IDLE' },
  });
  console.log('Open: /ket/speaking/runner/' + attempt.id);
})().catch(console.error);
"
```

Open the printed URL in Chrome/Edge, accept mic permission, and observe:
- Status pill flips connecting → listening
- Mina's video loads in `#mina-video`
- Mina speaks the initial greeting
- After you answer, status flips thinking → speaking → listening for the next turn

Acceptance: one full user → Mina round-trip works. Part advancement + session-end not yet required (they come in Task 22).

- [ ] **Step 21.8: Commit**

```bash
git add apps/web/src/components/speaking/SpeakingRunner.tsx \
        apps/web/src/components/speaking/MinaAvatarPanel.tsx \
        apps/web/src/components/speaking/StatusPill.tsx \
        apps/web/src/app/ket/speaking/runner/[attemptId]/page.tsx \
        apps/web/src/app/pet/speaking/runner/[attemptId]/page.tsx \
        apps/web/next.config.ts
git commit -m "feat(speaking): minimum viable runner — one-turn TRTC ↔ DeepSeek loop"
```

---

## Task 22: Full runner UX — photo panel, progress bar, End Test, beacon submit, safety cap

Expand the runner with all spec §9 features.

**Files:**
- Create: `apps/web/src/components/speaking/PhotoPanel.tsx`
- Create: `apps/web/src/components/speaking/PartProgressBar.tsx`
- Create: `apps/web/src/components/speaking/EndTestButton.tsx`
- Modify: `apps/web/src/components/speaking/SpeakingRunner.tsx`

- [ ] **Step 22.1: Write `PhotoPanel.tsx`**

```tsx
"use client";

interface Props {
  photoUrl: string | null;
  caption?: string;
}

export function PhotoPanel({ photoUrl, caption }: Props) {
  if (!photoUrl) return null;
  return (
    <div className="w-full max-w-[480px] animate-fade-in rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow">
      <img
        src={photoUrl}
        alt={caption ?? "discussion photo"}
        className="w-full rounded-lg object-cover"
        loading="eager"
      />
      {caption && (
        <p className="mt-2 text-center text-sm text-neutral-400">{caption}</p>
      )}
    </div>
  );
}
```

Add the animation to `apps/web/src/app/globals.css` (or the project's Tailwind layer) if `animate-fade-in` isn't defined — otherwise skip:

```css
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
.animate-fade-in { animation: fade-in 180ms ease-out both; }
```

- [ ] **Step 22.2: Write `PartProgressBar.tsx`**

```tsx
"use client";

interface Props {
  totalParts: number;
  currentPart: number;
}

export function PartProgressBar({ totalParts, currentPart }: Props) {
  return (
    <div className="flex w-full max-w-[480px] items-center gap-2 text-sm text-neutral-300">
      <span className="whitespace-nowrap">
        第 {currentPart} 部分 / 共 {totalParts} 部分
      </span>
      <div className="flex flex-1 gap-1" aria-hidden>
        {Array.from({ length: totalParts }, (_, i) => {
          const n = i + 1;
          const active = n <= currentPart;
          return (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                active ? "bg-emerald-500" : "bg-neutral-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 22.3: Write `EndTestButton.tsx`**

```tsx
"use client";

import { useState } from "react";

interface Props {
  onConfirm: () => void;
  disabled?: boolean;
}

export function EndTestButton({ onConfirm, disabled }: Props) {
  const [showing, setShowing] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowing(true)}
        disabled={disabled}
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
      >
        结束测试
      </button>
      {showing && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-neutral-950 p-6 text-center shadow-xl">
            <p className="text-base text-neutral-100">确认结束本次测试?</p>
            <p className="mt-1 text-sm text-neutral-400">尚未完成的部分将计为 0 分。</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowing(false)}
                className="rounded px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800">
                继续测试
              </button>
              <button
                type="button"
                onClick={() => { setShowing(false); onConfirm(); }}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500">
                结束
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 22.4: Update `SpeakingRunner.tsx` with the full features**

Replace the minimum `SpeakingRunner.tsx` body with:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createMinaTrtcSession,
  type MinaTrtcCredentials,
  type MinaTrtcSession,
  type StreamMessage,
} from "@/lib/speaking/trtc-client";
import {
  createClientTranscriptBuffer,
  type ClientTranscriptBuffer,
} from "@/lib/speaking/client-transcript-buffer";
import { MinaAvatarPanel } from "./MinaAvatarPanel";
import { StatusPill, type SpeakingStatusLabel } from "./StatusPill";
import { PhotoPanel } from "./PhotoPanel";
import { PartProgressBar } from "./PartProgressBar";
import { EndTestButton } from "./EndTestButton";

interface SpeakingPart {
  partNumber: number;
  title: string;
  targetMinutes: number;
  photoKey: string | null;
}

interface SpeakingTestContext {
  parts: SpeakingPart[];
  initialGreeting: string;
  photoUrls: Record<string, string>;
  level: "KET" | "PET";
}

interface SessionInit {
  akoolSessionId: string;
  streamType: "trtc";
  trtc: MinaTrtcCredentials;
  test: SpeakingTestContext;
}

interface Props {
  attemptId: string;
  level: "KET" | "PET";
}

function targetTotalMinutes(parts: SpeakingPart[]) {
  return parts.reduce((a, p) => a + p.targetMinutes, 0);
}

export function SpeakingRunner({ attemptId, level }: Props) {
  const [status, setStatus] = useState<SpeakingStatusLabel>("connecting");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const [testCtx, setTestCtx] = useState<SpeakingTestContext | null>(null);
  const sessionRef = useRef<MinaTrtcSession | null>(null);
  const bufRef = useRef<ClientTranscriptBuffer>(createClientTranscriptBuffer());
  const currentPartRef = useRef(1);
  const endedRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    currentPartRef.current = currentPart;
    bufRef.current.setCurrentPart(currentPart);
  }, [currentPart]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      await fetch(`/api/speaking/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientTranscript: bufRef.current.snapshot() }),
        keepalive: true,
      });
    } finally {
      await sessionRef.current?.close();
      const base = level === "KET" ? "/ket" : "/pet";
      window.location.href = `${base}/speaking/result/${attemptId}`;
    }
  }, [attemptId, level]);

  const handleMessage = useCallback(async (msg: StreamMessage) => {
    if (endedRef.current) return;
    bufRef.current.captureStreamMessage(msg);
    if (msg.type !== "chat" || !msg.fin) return;
    if (msg.pld.from !== "user" || !msg.pld.text) return;

    setStatus("thinking");
    const history = bufRef.current.snapshot().map((t) => ({
      role: t.role, content: t.content,
    }));

    try {
      const res = await fetch(`/api/speaking/${attemptId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentPart: currentPartRef.current }),
      });
      if (!res.ok) throw new Error(`/reply HTTP ${res.status}`);
      const json = await res.json() as {
        reply: string;
        flags: { advancePart: number | null; sessionEnd: boolean; retry?: boolean };
      };

      if (json.flags.advancePart != null) setCurrentPart(json.flags.advancePart);

      setStatus("speaking");
      await sessionRef.current?.sendChat(json.reply);

      if (json.flags.sessionEnd) {
        endedRef.current = true;
        setStatus("ended");
        setTimeout(() => void submit(), 1200);
      } else {
        setStatus("listening");
      }
    } catch (err) {
      console.error("[runner] reply failed", err);
      setStatus("listening");
    }
  }, [attemptId, submit]);

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/session`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        if (!res.ok) throw new Error(`/session HTTP ${res.status}`);
        const init = (await res.json()) as SessionInit;
        if (cancelled) return;
        setTestCtx(init.test);
        startedAtRef.current = Date.now();

        const session = await createMinaTrtcSession({
          credentials: init.trtc,
          onMessage: handleMessage,
          onRemoteVideoAvailable: (userId) => {
            setRemoteUserId(userId);
            const client = (session as any)._client ?? null;
            if (client?.subscribeRemoteVideo) {
              client.subscribeRemoteVideo({ userId, view: "mina-video", streamType: 0 });
            }
          },
          onDisconnected: () => {
            setError("连接已断开,请刷新重试。");
            setStatus("ended");
          },
        });
        sessionRef.current = session;
        setStatus("listening");

        if (init.test.initialGreeting) await session.sendChat(init.test.initialGreeting);
      } catch (err) {
        console.error("[runner] bootstrap failed", err);
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.close();
    };
  }, [attemptId, handleMessage]);

  // Safety cap: auto-submit if elapsed > (target + 3 min)
  useEffect(() => {
    if (!testCtx) return;
    const capMs = (targetTotalMinutes(testCtx.parts) + 3) * 60_000;
    const t = setInterval(() => {
      if (!startedAtRef.current) return;
      if (Date.now() - startedAtRef.current > capMs && !endedRef.current) {
        endedRef.current = true;
        setStatus("ended");
        void submit();
      }
    }, 5_000);
    return () => clearInterval(t);
  }, [testCtx, submit]);

  // beforeunload → beacon submit
  useEffect(() => {
    const handler = () => {
      if (submittedRef.current) return;
      try {
        const body = JSON.stringify({ clientTranscript: bufRef.current.snapshot() });
        navigator.sendBeacon(
          `/api/speaking/${attemptId}/submit`,
          new Blob([body], { type: "application/json" }),
        );
        submittedRef.current = true;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [attemptId]);

  const currentPartObj = useMemo(
    () => testCtx?.parts.find((p) => p.partNumber === currentPart) ?? null,
    [testCtx, currentPart],
  );
  const photoUrl = currentPartObj?.photoKey
    ? testCtx?.photoUrls[currentPartObj.photoKey] ?? null
    : null;

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-500">{error}</p>
        <a className="mt-4 inline-block underline" href={`/${level.toLowerCase()}/speaking/new`}>返回</a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 p-4 md:p-6">
      <div className="flex w-full items-center justify-between gap-2">
        {testCtx && <PartProgressBar totalParts={testCtx.parts.length} currentPart={currentPart} />}
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <EndTestButton onConfirm={submit} disabled={status === "ended"} />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <div className="flex justify-center">
          <MinaAvatarPanel remoteUserId={remoteUserId} />
        </div>
        <div className="flex justify-center">
          <PhotoPanel photoUrl={photoUrl} caption={currentPartObj?.title} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 22.5: Typecheck**

```bash
cd apps/web
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 22.6: Browser verify**

Run the three services. Create a KET speaking attempt via the helper command in Task 21.7, open the runner URL, and walk through a full 2-part KET session. Verify:
- Part 1 → Part 2 transition fires the progress bar, photo fades in.
- `[[SESSION_END]]` sentinel from the examiner auto-submits and redirects to `/ket/speaking/result/<id>` (the result page doesn't exist yet, will 404 — fine; that's Task 24).
- End Test button → confirm modal → submit works.
- Close the tab mid-session → verify in DB that `speakingStatus` flipped past `IN_PROGRESS` via the beacon.

- [ ] **Step 22.7: Commit**

```bash
git add apps/web/src/components/speaking/PhotoPanel.tsx \
        apps/web/src/components/speaking/PartProgressBar.tsx \
        apps/web/src/components/speaking/EndTestButton.tsx \
        apps/web/src/components/speaking/SpeakingRunner.tsx \
        apps/web/src/app/globals.css
git commit -m "feat(speaking): full runner UX — photo panel, progress bar, end-test, beacon submit, safety cap"
```

---

## Task 23: `/new` pre-flight page

**Files:**
- Create: `apps/web/src/components/speaking/MicPermissionGate.tsx`
- Create: `apps/web/src/components/speaking/ConnectionTest.tsx`
- Create: `apps/web/src/components/speaking/SpeakingNewPage.tsx`
- Create: `apps/web/src/app/ket/speaking/new/page.tsx`
- Create: `apps/web/src/app/pet/speaking/new/page.tsx`

- [ ] **Step 23.1: Write `MicPermissionGate.tsx`**

```tsx
"use client";

import { useState } from "react";

export function MicPermissionGate({
  onReady,
}: {
  onReady: (stream: MediaStream) => void;
}) {
  const [state, setState] = useState<"idle" | "granted" | "denied" | "testing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setState("granted");
      onReady(stream);
    } catch (err) {
      setState("denied");
      setError((err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <p className="text-sm text-neutral-200">允许麦克风权限后方可开始测试。</p>
      {state === "idle" && (
        <button
          type="button"
          onClick={request}
          className="mt-3 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
        >
          允许麦克风
        </button>
      )}
      {state === "testing" && <p className="mt-3 text-sm text-neutral-400">请求权限中…</p>}
      {state === "granted" && <p className="mt-3 text-sm text-emerald-400">✓ 麦克风已就绪</p>}
      {state === "denied" && (
        <p className="mt-3 text-sm text-red-500">
          麦克风权限被拒绝。请在浏览器地址栏的锁图标中手动允许,然后刷新本页。
          {error && <span className="block text-xs text-neutral-400">({error})</span>}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 23.2: Write `ConnectionTest.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import TRTC from "trtc-sdk-v5";

export function ConnectionTest({ onResult }: { onResult: (ok: boolean) => void }) {
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");

  useEffect(() => {
    (async () => {
      try {
        const res = await TRTC.checkSystemRequirements();
        if (res.result) {
          setState("ok");
          onResult(true);
        } else {
          setState("fail");
          onResult(false);
        }
      } catch {
        setState("fail");
        onResult(false);
      }
    })();
  }, [onResult]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm">
      {state === "pending" && <p className="text-neutral-400">正在检查浏览器…</p>}
      {state === "ok" && <p className="text-emerald-400">✓ 浏览器支持实时视频</p>}
      {state === "fail" && (
        <p className="text-red-500">
          当前浏览器不支持实时视频。请使用最新版 Chrome 或 Edge 桌面浏览器。
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 23.3: Write `SpeakingNewPage.tsx`**

```tsx
"use client";

import { useState } from "react";

import { MicPermissionGate } from "./MicPermissionGate";
import { ConnectionTest } from "./ConnectionTest";

interface Props {
  level: "KET" | "PET";
}

export function SpeakingNewPage({ level }: Props) {
  const [micOk, setMicOk] = useState(false);
  const [netOk, setNetOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/speaking/tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("今天已达到生成次数限制,请明天再试。");
        } else {
          setError(`生成测试失败:HTTP ${res.status}`);
        }
        return;
      }
      const json = (await res.json()) as { attemptId: string };
      const base = level === "KET" ? "/ket" : "/pet";
      window.location.href = `${base}/speaking/runner/${json.attemptId}`;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">口语测试 — {level}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          本次练习由 AI 考官 Mina 全程对话。请在安静环境下佩戴耳机,并允许麦克风权限。
        </p>
      </header>

      <MicPermissionGate onReady={() => setMicOk(true)} />
      <ConnectionTest onResult={setNetOk} />

      {error && (
        <div className="rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!micOk || !netOk || loading}
        onClick={startTest}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        {loading ? "正在准备…" : "开始测试"}
      </button>

      <p className="text-xs text-neutral-500">
        注意:为保护隐私,请勿在回答中提及具体姓名、学校、家庭住址等敏感信息。
      </p>
    </div>
  );
}
```

- [ ] **Step 23.4: Wire up the pages**

Create `apps/web/src/app/ket/speaking/new/page.tsx`:

```tsx
import { SpeakingNewPage } from "@/components/speaking/SpeakingNewPage";

export default function Page() {
  return <SpeakingNewPage level="KET" />;
}
```

Create `apps/web/src/app/pet/speaking/new/page.tsx`:

```tsx
import { SpeakingNewPage } from "@/components/speaking/SpeakingNewPage";

export default function Page() {
  return <SpeakingNewPage level="PET" />;
}
```

- [ ] **Step 23.5: Typecheck + browser verify**

```bash
pnpm typecheck
pnpm dev
```

Open `http://localhost:3000/ket/speaking/new`. Verify:
- Mic permission flow completes
- TRTC connection test shows ✓
- "开始测试" calls `/tests/generate` and redirects to runner

- [ ] **Step 23.6: Commit**

```bash
git add apps/web/src/components/speaking/MicPermissionGate.tsx \
        apps/web/src/components/speaking/ConnectionTest.tsx \
        apps/web/src/components/speaking/SpeakingNewPage.tsx \
        apps/web/src/app/ket/speaking/new/page.tsx \
        apps/web/src/app/pet/speaking/new/page.tsx
git commit -m "feat(speaking): /new pre-flight page with mic + connection checks"
```

---

# Phase F — Result page + dashboards

## Task 24: Result page + rubric display

**Files:**
- Create: `apps/web/src/components/speaking/RubricBar.tsx`
- Create: `apps/web/src/components/speaking/TranscriptViewer.tsx`
- Create: `apps/web/src/components/speaking/SpeakingResult.tsx`
- Create: `apps/web/src/app/ket/speaking/result/[attemptId]/page.tsx`
- Create: `apps/web/src/app/pet/speaking/result/[attemptId]/page.tsx`

- [ ] **Step 24.1: Write `RubricBar.tsx`**

```tsx
"use client";

interface Props {
  label: string;
  score: number; // 0..5
  max?: number;
}

export function RubricBar({ label, score, max = 5 }: Props) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-neutral-200">{label}</span>
        <span className="tabular-nums text-sm text-neutral-400">
          {score} / {max}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={score}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 24.2: Write `TranscriptViewer.tsx`**

```tsx
"use client";

import { useState } from "react";

interface Turn {
  role: "user" | "assistant";
  content: string;
  part: number;
}

export function TranscriptViewer({ transcript }: { transcript: Turn[] }) {
  const [open, setOpen] = useState(false);
  if (!transcript?.length) return null;
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-neutral-200">对话记录</span>
        <span className="text-sm text-neutral-500">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="divide-y divide-neutral-900">
          {transcript.map((t, i) => (
            <div key={i} className="flex gap-3 p-3 text-sm">
              <span
                className={`mt-0.5 inline-block w-14 shrink-0 text-xs uppercase tracking-wide ${
                  t.role === "assistant" ? "text-emerald-400" : "text-sky-400"
                }`}
              >
                {t.role === "assistant" ? "Mina" : "你"}
              </span>
              <span className="text-neutral-200">{t.content}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 24.3: Write `SpeakingResult.tsx` (client: polls /status)**

```tsx
"use client";

import { useEffect, useState } from "react";

import { RubricBar } from "./RubricBar";
import { TranscriptViewer } from "./TranscriptViewer";

interface Rubric {
  grammarVocab: number;
  discourseManagement: number;
  pronunciation: number;
  interactive: number;
  overall: number;
  justification: string;
  weakPoints: Array<{ tag: string; quote: string; suggestion: string }>;
}

interface Props {
  attemptId: string;
  level: "KET" | "PET";
  initialTranscript: Array<{ role: "user" | "assistant"; content: string; part: number }>;
  initialRubric: Rubric | null;
  initialStatus: string;
  initialError: string | null;
}

export function SpeakingResult({
  attemptId, level, initialTranscript, initialRubric, initialStatus, initialError,
}: Props) {
  const [rubric, setRubric] = useState<Rubric | null>(initialRubric);
  const [status, setStatus] = useState<string>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (status === "SCORED" || status === "FAILED") return;
    const deadline = Date.now() + 2 * 60_000; // 2 min cap
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json() as {
          speakingStatus: string;
          rubricScores: Rubric | null;
          speakingError: string | null;
        };
        setStatus(json.speakingStatus);
        if (json.rubricScores) setRubric(json.rubricScores);
        if (json.speakingError) setError(json.speakingError);
        if (json.speakingStatus === "SCORED" || json.speakingStatus === "FAILED") {
          clearInterval(t);
        }
      } catch {/* ignore */}
      if (Date.now() > deadline) {
        clearInterval(t);
        setError((e) => e ?? "评分超时,请稍后重试或重做。");
      }
    }, 2_000);
    return () => clearInterval(t);
  }, [attemptId, status]);

  const portalBase = level === "KET" ? "/ket" : "/pet";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">口语成绩</h1>
          <p className="mt-1 text-sm text-neutral-400">等级:{level}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${portalBase}/speaking/new`}
            className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            重做
          </a>
          <a
            href={portalBase}
            className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
          >
            返回主页
          </a>
        </div>
      </header>

      {status === "SCORING" || status === "SUBMITTED" ? (
        <div className="rounded border border-neutral-800 bg-neutral-950 p-4 text-neutral-300">
          正在评分…
        </div>
      ) : null}

      {error && (
        <div className="rounded border border-red-800 bg-red-950/50 p-4 text-red-300">
          {error}
        </div>
      )}

      {rubric && (
        <>
          <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-neutral-200">总评</h2>
              <span className="text-3xl font-semibold tabular-nums text-emerald-400">
                {rubric.overall.toFixed(1)}
                <span className="ml-1 text-base text-neutral-500">/ 5</span>
              </span>
            </div>
            <div className="space-y-3">
              <RubricBar label="Grammar & Vocabulary" score={rubric.grammarVocab} />
              <RubricBar label="Discourse Management" score={rubric.discourseManagement} />
              <RubricBar label="Pronunciation" score={rubric.pronunciation} />
              <RubricBar label="Interactive Communication" score={rubric.interactive} />
            </div>
            {rubric.justification && (
              <p className="mt-4 border-t border-neutral-900 pt-3 text-sm text-neutral-300">
                {rubric.justification}
              </p>
            )}
          </section>

          {rubric.weakPoints?.length > 0 && (
            <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <h2 className="text-base font-semibold text-neutral-200">易错点</h2>
              <ul className="mt-3 space-y-2">
                {rubric.weakPoints.map((wp, i) => (
                  <li key={i} className="rounded border border-neutral-900 bg-neutral-950 p-3 text-sm">
                    <span className="text-xs uppercase tracking-wide text-neutral-500">{wp.tag}</span>
                    <p className="mt-1 italic text-neutral-400">"{wp.quote}"</p>
                    <p className="mt-1 text-neutral-200">建议:{wp.suggestion}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <TranscriptViewer transcript={initialTranscript} />
    </div>
  );
}
```

- [ ] **Step 24.4: Result page server component**

Create `apps/web/src/app/ket/speaking/result/[attemptId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SpeakingResult } from "@/components/speaking/SpeakingResult";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: { select: { speakingPersona: true } } },
  });
  if (!attempt || attempt.userId !== session.user.id) notFound();

  const transcript = (attempt.transcript as any[] | null) ?? [];

  return (
    <SpeakingResult
      attemptId={attempt.id}
      level="KET"
      initialTranscript={transcript}
      initialRubric={(attempt.rubricScores as any) ?? null}
      initialStatus={attempt.speakingStatus ?? "SUBMITTED"}
      initialError={attempt.speakingError}
    />
  );
}
```

Create `apps/web/src/app/pet/speaking/result/[attemptId]/page.tsx` — same shape with `level="PET"`.

- [ ] **Step 24.5: Typecheck + browser verify**

```bash
pnpm typecheck
pnpm dev
```

Complete a speaking attempt through `/new` → `runner` → redirect to `/ket/speaking/result/<id>`. Verify:
- Status poller flips SUBMITTED → SCORING → SCORED within ~15s on the happy path.
- Overall + 4 rubric bars render correctly.
- Transcript viewer expands/collapses.
- Retake and back-to-dashboard links work.

- [ ] **Step 24.6: Commit**

```bash
git add apps/web/src/components/speaking/RubricBar.tsx \
        apps/web/src/components/speaking/TranscriptViewer.tsx \
        apps/web/src/components/speaking/SpeakingResult.tsx \
        apps/web/src/app/ket/speaking/result/[attemptId]/page.tsx \
        apps/web/src/app/pet/speaking/result/[attemptId]/page.tsx
git commit -m "feat(speaking): result page with rubric bars + transcript viewer"
```

---

## Task 25: Dashboard integration (portal tiles + history + teacher views)

Speaking attempts already write `scaledScore` via the submit route (Task 17), so Phase 2's aggregate views will pick them up. This task only adds the portal tile + makes sure speaking rows render with a distinct icon on history/teacher pages.

**Files:**
- Modify: `apps/web/src/app/ket/page.tsx`
- Modify: `apps/web/src/app/pet/page.tsx`
- Modify: `apps/web/src/app/history/page.tsx` (or equivalent existing Phase 2 history page)
- Modify: `apps/web/src/components/<existing-TestAttemptCard or similar>` — add a speech-bubble icon for `kind === 'SPEAKING'`

- [ ] **Step 25.1: Add Speaking tile to KET and PET portal pages**

Find the existing KET / PET portal page that renders tile cards for Reading, Writing, Listening. Pattern-match and add:

```tsx
<SkillTile
  title="口语"
  subtitle="Mina AI 考官 · 实时对话练习"
  href="/ket/speaking/new"   // or "/pet/speaking/new"
  icon={/* an existing speech-bubble/lucide icon — reuse whichever icon lib the project uses */}
/>
```

Check if the existing skill-tile component has a `disabled` prop used for Phase 2 listening that was enabled progressively — if yes, you just flip the speaking tile to `enabled` the same way. If the tiles live inline in the page file, add a new entry mirroring the listening one.

- [ ] **Step 25.2: History / attempt lists — speaking icon**

In the existing Test Attempt list component (the one Phase 2 used to add the headset/listening icon), add a branch for `kind === 'SPEAKING'` that renders a speech-bubble icon and a short label ("口语"). The row should link to `/{level}/speaking/result/<attemptId>`.

- [ ] **Step 25.3: Teacher per-student view — transcript panel**

Wherever the teacher's per-student attempt detail page lives (Phase 2 seeded it under `/class/[classId]/student/[studentId]/[attemptId]`), add a branch for SPEAKING attempts that renders the `TranscriptViewer` from Task 24.2 with `transcript={attempt.transcript}`.

- [ ] **Step 25.4: Manual verification**

Start the dev server. Log in as a student with at least one scored speaking attempt. Verify:
- Portal shows the 口语 tile at full opacity.
- Clicking a speaking attempt from `/history` navigates to the speaking result page.
- Log in as a teacher, open the student's detail page, confirm the transcript renders.

- [ ] **Step 25.5: Commit**

```bash
git add apps/web/src/app/ket/page.tsx \
        apps/web/src/app/pet/page.tsx \
        apps/web/src/app/history/page.tsx \
        apps/web/src/components/<whatever-attempt-row.tsx> \
        apps/web/src/app/class/<teacher detail>.tsx
git commit -m "feat(speaking): portal tile + history row + teacher transcript panel"
```

---

# Phase G — Rate limits, verification, sign-off

## Task 26: Rate limiting + FAILED-state UX paths

Hook `SPEAKING_ATTEMPT` into the existing `GenerationEvent` rate limiter. The `/generate` route already calls `checkAndRecordGeneration(userId, "SPEAKING_ATTEMPT", 3)`, so this task verifies the rate-limit helper knows the kind and adds UX handling on `/new` for the 429 response (already written in Task 23.3).

**Files:**
- Modify: `apps/web/src/lib/rate-limit.ts` (or whichever file houses `checkAndRecordGeneration` — discover with grep)

- [ ] **Step 26.1: Locate the rate-limit helper**

```bash
cd apps/web
grep -rn "checkAndRecordGeneration" src
```

Open the discovered file. Confirm it accepts a `kind` string.

- [ ] **Step 26.2: Ensure `"SPEAKING_ATTEMPT"` is in the allow-list**

Most Phase 2 rate limiters accept any string and write it straight to a `GenerationEvent.kind` column. If yours has an explicit enum/union, extend it with `"SPEAKING_ATTEMPT"`:

```typescript
// In the existing enum
export type GenerationKind =
  | "READING_ATTEMPT"
  | "WRITING_ATTEMPT"
  | "LISTENING_ATTEMPT"
  | "SPEAKING_ATTEMPT";
```

If `GenerationEvent.kind` is a Prisma enum, add the value to `schema.prisma` and migrate. If it's a plain string column, skip this step.

- [ ] **Step 26.3: Verify the FAILED path UX**

Manually induce a FAILED state (e.g. temporarily misconfigure `INTERNAL_AI_URL` to a dead host, start a session, end it). Expected:
- Result page shows the red error banner with `speakingError`.
- Retake button returns to `/new`.

- [ ] **Step 26.4: Commit (if any change)**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/prisma/schema.prisma apps/web/prisma/migrations
git commit -m "feat(speaking): register SPEAKING_ATTEMPT kind with rate limiter"
```

If no code change was required, this is a zero-commit task.

---

## Task 27: Manual QA checklist document

Ship a short test-plan doc for the end-to-end verification step. This isn't a code artifact — it's the document future operators will run through in §20 of the spec.

**Files:**
- Create: `docs/superpowers/specs/phase3-speaking-manual-test.md`

- [ ] **Step 27.1: Write the checklist**

Create `docs/superpowers/specs/phase3-speaking-manual-test.md`:

```markdown
# Phase 3 Speaking — manual QA checklist

**Prerequisites**
- `AKOOL_*`, DeepSeek, R2, DATABASE_URL all set in `apps/web/.env`
- Three services up: Postgres (Docker), `services/ai` (uvicorn 8001), `apps/web` (next dev 3000)
- A seeded student user account + at least one teacher + one class containing the student
- ~50 photos uploaded to R2 via `pnpm seed:speaking-photos`
- `AKOOL_AVATAR_ID` + `AKOOL_VOICE_ID` filled in and smoke-tested per Task 8

## KET happy path (~15 min)

- [ ] Log in as student. Open `/ket/speaking/new`.
- [ ] Mic permission modal fires and is accepted.
- [ ] Connection test shows ✓.
- [ ] Click "开始测试". `/tests/generate` fires; spinner visible.
- [ ] Redirects to `/ket/speaking/runner/<id>`.
- [ ] Status pill: connecting → listening within 3s.
- [ ] Mina appears in the video panel and speaks her opening greeting within 5s.
- [ ] Answer all Part 1 questions. After the scripted questions complete, the progress bar ticks to Part 2.
- [ ] Part 2 photo panel fades in. Mina prompts for description.
- [ ] After the scripted Part 2 questions, Mina says a sign-off line and the session ends automatically (`[[SESSION_END]]`).
- [ ] Redirect to `/ket/speaking/result/<id>`.
- [ ] Result page:
  - [ ] Overall + 4 rubric bars render within 30s.
  - [ ] Justification paragraph is non-empty and level-appropriate.
  - [ ] At least 1 weak point is listed.
  - [ ] Transcript viewer shows interleaved user + Mina turns.

## PET happy path (~18 min)

- [ ] Same flow against `/pet/speaking/new`. 4 parts, progress bar ticks three times.
- [ ] Part 2 and Part 3 both show photo panels (can be the same photo or distinct — depends on generator).
- [ ] Result page renders PET-level justification.

## Error + edge paths

- [ ] Rate limit: trigger `/tests/generate` 4 times in a row → the 4th returns 429 and the UI shows "今天已达到生成次数限制".
- [ ] Mic permission denied: MicPermissionGate shows the red help text; "开始测试" stays disabled.
- [ ] Close tab mid-session → re-open the result URL → attempt is in `SUBMITTED` or later (sendBeacon worked). Check DB: `SELECT "speakingStatus", "akoolSessionId" FROM "TestAttempt" WHERE id = '<id>';`.
- [ ] Kill `services/ai` mid-turn → runner falls back to filler reply, continues. Restart the service and complete the session — result page still scores (fresh /reply call succeeds).
- [ ] Duplicate tab: open the same runner URL in a second tab → the second `/session` call 409s and shows "session already in progress".

## Dashboard

- [ ] Speaking tile on `/ket` and `/pet` links to `/new` without error.
- [ ] `/history` includes the new speaking attempt rows with the speech-bubble icon.
- [ ] Teacher view on `/class/<id>/student/<studentId>/<attemptId>` shows the transcript.

## Latency sample (Chinese residential network)

- [ ] Run on a residential connection in mainland China with no VPN.
- [ ] Record 10 turn latencies (student stops speaking → first syllable of Mina audible). Target median ≤ 2.0s, p95 ≤ 3.0s.
- [ ] Paste the latencies + conditions into the commit message for the sign-off commit (Task 28).
```

- [ ] **Step 27.2: Commit**

```bash
git add docs/superpowers/specs/phase3-speaking-manual-test.md
git commit -m "docs(phase3): add manual QA checklist for Speaking E2E"
```

---

## Task 28: Phase 3 sign-off

- [ ] **Step 28.1: Run the full checklist from Task 27**

If any step fails: fix, re-commit, re-run. Don't skip.

- [ ] **Step 28.2: Final green check — all automated suites**

```bash
cd apps/web
pnpm typecheck
pnpm vitest run
```

```bash
cd services/ai
pytest -v
```

Expected: 0 TS errors; all vitest tests green; all pytest tests green.

- [ ] **Step 28.3: Working tree + git log check**

```bash
git -C C:/Users/wul82/Desktop/cambridge-ket-pet status --short
git -C C:/Users/wul82/Desktop/cambridge-ket-pet log --oneline origin/phase2-listening..HEAD
```

Expected: `status` is clean (apart from intentionally-untracked `.firecrawl/` and `Mina (2).png`). `log` shows the Phase 3 commit sequence from spec-pivot (`23af19b`) through the sign-off commit about to be made.

- [ ] **Step 28.4: Produce a sign-off commit documenting latency + verification**

```bash
git -C C:/Users/wul82/Desktop/cambridge-ket-pet commit --allow-empty -m "$(cat <<'EOF'
chore(phase3): Phase 3 Speaking sign-off

Manual E2E (KET + PET) verified per docs/superpowers/specs/phase3-speaking-manual-test.md.

Latency (Chinese residential network, <N> turns):
  median: <Xs>   p95: <Xs>

All automated suites green:
  - apps/web: tsc exit 0, vitest <N/N> passing
  - services/ai: pytest <N/N> passing

Phase 3 joins Phase 2 in the deferred cross-phase E2E bucket. No push to
origin until the user explicitly asks.
EOF
)"
```

- [ ] **Step 28.5: DO NOT push**

Per memory (feedback_verify_before_push.md and Conventions in this plan), push to origin requires an explicit "push" instruction from the user. Stop here.

---

# Self-review

Ran against the spec (commit `4864117`, `docs/superpowers/specs/2026-04-24-phase3-speaking-design.md`).

## Spec coverage

| Spec section | Task(s) | Notes |
|---|---|---|
| §1 context + §2.1 in-scope | 1–28 | All in-scope items are covered. |
| §2.2 out-of-scope | — | Chunked `type:'chat'` streaming, audio recording, 2-candidate sim, AI photos, CI E2E, shared bank UI are all deferred by design. |
| §2.3 success criteria | 27, 28 | Captured in the manual QA checklist (Task 27) and sign-off latency record (Task 28). |
| §3 exam format | 4, 5 | Enforced by generator + examiner prompts. |
| §4 locked decisions | 1 (SpeakingStatus + fields), 9 (akool-client enforces `mode_type:1` + TRTC), 10 (session-state sentinels), 12 (transcript-reconciler dual-source), 22 (barge-in dev-only), 26 (rate limits). |
| §5 data model | 1. |
| §5.1–5.3 JSON shapes | 3 (schemas), 4 (generator output), 6 (scorer output), 12 (transcript shape). |
| §6.1 Akool flow | 9 (auth + session), 15 (session route), 19 (TRTC client), 21 (runner wires it). |
| §6.2 DeepSeek integration | 4–7. |
| §7 API routes | 14, 15, 16, 17, 18. |
| §8 Python services/ai additions | 3–7. |
| §9 Runner UX | 21, 22. |
| §9.2 pre-flight | 23. |
| §10 Result page + integrations | 24, 25. |
| §11 Error handling | 14 (400/401/429), 15 (404/409), 16 (filler on timeout, 409), 17 (idempotent, FAILED path), 21 (onDisconnected), 22 (safety-cap auto-submit, beacon). |
| §12 Performance mitigations | 9 (create-time VAD), 21 (warm-up ping), 16 (`max_tokens: 150` via examiner prompt), 5 (scorer terseness), 2.2 (chunk streaming deferred). |
| §13 Security + cost | 9 (server-only client), 14 (rate limit), 26. |
| §13.7 Env vars | .env updated earlier in spec-pivot commit; Tasks assume the names. |
| §14 File layout | matches exactly. |
| §15 Build order | Tasks 1–28 follow the 21-step order 1:1, with step 7 (audition) = Task 8 and the two extra tasks (19 TRTC client, 20 client transcript buffer) which were implicit in step 13's "minimum runner UX" but warrant their own TDD cycles. |
| §16 Testing strategy | matches: unit (vitest + pytest) per task, browser-dev verification at 21.7, 22.6, 23.5, 24.5, manual checklist 27, CI E2E explicitly deferred. |
| §17 open decisions | No-op here (they are deferred). |
| §18 risks | Flagged to be monitored post-launch (concurrency cap, overage). No plan tasks needed. |

## Placeholder scan

- No "TBD", "implement later", "similar to Task N", "fill in details" in code blocks.
- Task 25 has small blanks where the exact existing file paths are project-specific (the pattern "`<whatever-attempt-row.tsx>`"). These are intentional — the operator is told to discover the matching Phase 2 file via grep. Not a placeholder failure per the skill; they are labelled "discover with grep" and have concrete guidance.
- Task 28.4 commit message has `<N>`, `<Xs>` placeholders that the operator fills from their real measurement — this IS the intended form of a sign-off commit.

## Type / signature consistency

- `SpeakingStatus` Prisma enum = `SpeakingStatus` Pydantic field values — both use `IDLE | IN_PROGRESS | SUBMITTED | SCORING | SCORED | FAILED`.
- `SpeakingPrompts.parts[].photoKey` is `string | null` on both sides.
- `SpeakingExaminerReply.advancePart` is `number | null` / `Optional[int]` consistently.
- `ClientTranscriptTurn.source` = `"akool_stt" | "client_fallback"`; the reconciler upgrades all client-sourced turns it appends to `"client_fallback"` to keep the post-submit transcript unambiguous.
- `StreamMessage.type` is `"chat" | "command"`; both `trtc-client.ts` and `client-transcript-buffer.ts` agree.
- `createAkoolSession` input field names (`avatarId`, `voiceId`, `durationSeconds`, `vadThreshold`, `vadSilenceMs`) match exactly where the session route calls it (Task 15.3).
- The session route's response shape (`streamType`, `trtc`, `test.parts`, `test.photoUrls`, `test.initialGreeting`, `test.level`) matches what `SpeakingRunner.tsx` reads in Task 22.4.

No gaps found in this review.

---

# Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-25-phase3-speaking-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with full repo context, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans` — batch execution with checkpoints for review.

**Which approach?**
