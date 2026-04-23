# Phase 2 Listening Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the Cambridge KET/PET exam-prep app — full listening module for both KET (5 parts / 25 q / 30 min) and PET (4 parts / 25 q / 30 min), mock + practice modes, full-exam + per-part scopes, British-accent TTS, integrated with Phase 1 systems.

**Architecture:** Python Pydantic AI agent generates the structured test payload (questions + logical audioScript). Node orchestrator synthesizes each segment via `node-edge-tts` → applies play-rule (per-item or per-part ×2 with repeat cue) → ffmpeg concat with Cambridge pause timings → uploads single mp3 to Cloudflare R2 → Next.js stream-proxy serves audio to browser (range-request passthrough hides the Cloudflare domain). Server-authoritative timer + auto-submit. Deterministic grading. Same Phase 1 integrations (mistake notes, assignments, teacher dashboards, unified history).

**Tech Stack:** Next.js 16.2.4 · React 19 · TypeScript 5 · Tailwind CSS 4 · Prisma 6.19.3 · PostgreSQL 16 · Auth.js v5 · `node-edge-tts` · `ffmpeg-static` · `@aws-sdk/client-s3` (R2-compatible) · Python FastAPI · Pydantic AI · DeepSeek V3.2 (deepseek-chat) · vitest · pytest.

**Spec reference:** `docs/superpowers/specs/2026-04-23-phase2-listening-design.md`

---

## File structure

### New directories and files

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── audio/                                  (NEW)
│   │   │   ├── constants.ts                        (NEW)
│   │   │   ├── types.ts                            (NEW)
│   │   │   ├── voices.ts                           (NEW)
│   │   │   ├── voices.test.ts                      (NEW)
│   │   │   ├── rubric.ts                           (NEW)
│   │   │   ├── rubric.test.ts                      (NEW)
│   │   │   ├── chunker.ts                          (NEW)
│   │   │   ├── chunker.test.ts                     (NEW)
│   │   │   ├── edge-tts-client.ts                  (NEW)
│   │   │   ├── edge-tts-client.test.ts             (NEW)
│   │   │   ├── r2-client.ts                        (NEW)
│   │   │   ├── r2-client.test.ts                   (NEW)
│   │   │   ├── segments.ts                         (NEW)
│   │   │   ├── segments.test.ts                    (NEW)
│   │   │   ├── concat.ts                           (NEW)
│   │   │   ├── concat.test.ts                      (NEW)
│   │   │   ├── queue.ts                            (NEW)
│   │   │   ├── queue.test.ts                       (NEW)
│   │   │   ├── generate.ts                         (NEW)
│   │   │   └── generate.test.ts                    (NEW)
│   │   ├── grading/
│   │   │   ├── listening.ts                        (NEW)
│   │   │   └── listening.test.ts                   (NEW)
│   │   └── cron/
│   │       └── expired-attempts.ts                 (NEW)
│   ├── app/
│   │   ├── api/
│   │   │   ├── listening/[attemptId]/audio/
│   │   │   │   └── route.ts                        (NEW)
│   │   │   ├── cron/expired-attempts/
│   │   │   │   └── route.ts                        (NEW)
│   │   │   └── tests/
│   │   │       ├── generate/route.ts               (MODIFY — add LISTENING)
│   │   │       └── [testId]/status/route.ts        (MODIFY — add audioStatus)
│   │   ├── ket/listening/
│   │   │   ├── new/page.tsx                        (NEW)
│   │   │   ├── runner/[attemptId]/page.tsx         (NEW)
│   │   │   └── result/[attemptId]/page.tsx         (NEW)
│   │   └── pet/listening/                          (NEW — mirror of ket)
│   │       ├── new/page.tsx
│   │       ├── runner/[attemptId]/page.tsx
│   │       └── result/[attemptId]/page.tsx
│   └── components/listening/                       (NEW)
│       ├── ListeningRunner.tsx
│       ├── AudioPlayer.tsx
│       ├── TimerBadge.tsx
│       ├── TapescriptPanel.tsx
│       ├── GenerationProgress.tsx
│       ├── PhaseBanner.tsx
│       ├── QuestionRenderer.tsx
│       └── questions/
│           ├── Mcq3Picture.tsx
│           ├── GapFillOpen.tsx
│           ├── Mcq3Text.tsx
│           ├── Mcq3TextScenario.tsx
│           └── Matching5To8.tsx

services/ai/
└── app/
    ├── agents/
    │   ├── listening_generator.py                  (NEW)
    │   └── teacher_analysis.py                     (MODIFY — add listening prose)
    ├── prompts/
    │   └── listening_system.py                     (NEW)
    ├── schemas/
    │   └── listening.py                            (NEW)
    ├── validators/
    │   └── listening.py                            (NEW)
    ├── main.py                                     (MODIFY — add /listening/generate)
    └── tests/
        ├── test_listening_schema.py                (NEW)
        ├── test_listening_validators_ket.py        (NEW)
        ├── test_listening_validators_pet.py        (NEW)
        └── test_listening_regenerate.py            (NEW)
```

### Files to modify

- `apps/web/prisma/schema.prisma` — add `AudioStatus` enum + 5 fields on `Test`
- `apps/web/.env.example` — R2 + listening env vars
- `services/ai/.env.example` — unchanged (already has DEEPSEEK_API_KEY)
- `apps/web/src/i18n/zh-CN.ts` — listening UI strings
- `apps/web/src/app/history/page.tsx` — Listening filter chip
- `apps/web/src/app/history/mistakes/page.tsx` — Listening filter chip
- `apps/web/src/app/api/tests/[attemptId]/submit/route.ts` — LISTENING submit path
- `apps/web/src/app/teacher/classes/[classId]/page.tsx` — listening stats row per student
- `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/page.tsx` — listening series in chart + per-part breakdown
- `README.md`, `apps/web/README.md`, `services/ai/README.md` — run commands + env setup
- `package.json` (root and `apps/web/`) — new deps

---

## Prerequisites (manual setup before Task 1)

These are one-time operational steps the engineer must complete before coding begins. They produce values that go into `.env.local` for dev and Zeabur env for prod.

- [ ] **P1: Create Cloudflare R2 bucket**

  1. Log into Cloudflare dashboard → R2 Object Storage → Create bucket
  2. Name: `cambridge-ket-pet-audio`
  3. Location: auto (no specific region required — stream-proxy hides this)
  4. Default storage class: Standard

- [ ] **P2: Configure R2 bucket CORS**

  Set CORS on the bucket to allow your Zeabur deployment origin + localhost dev:

  ```json
  [
    {
      "AllowedOrigins": ["http://localhost:3000", "https://<your-zeabur-app>.zeabur.app"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["Range", "Content-Type"],
      "ExposeHeaders": ["Accept-Ranges", "Content-Length", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- [ ] **P3: Configure R2 bucket lifecycle rule (180-day auto-expire)**

  In R2 dashboard → bucket settings → Object lifecycle rules → Add rule:
  - Rule name: `listening-audio-180day-expire`
  - Prefix: `listening/`
  - Action: Delete objects 180 days after upload

- [ ] **P4: Create R2 API token**

  Cloudflare dashboard → R2 → Manage R2 API Tokens → Create Token
  - Permission: Object Read & Write
  - Scoped to bucket: `cambridge-ket-pet-audio`
  - TTL: no expiration (rotate manually if compromised)

  Save the Access Key ID + Secret Access Key + your Cloudflare Account ID.

- [ ] **P5: Verify ffmpeg availability**

  Run on dev machine:
  ```bash
  ffmpeg -version
  ```
  Expected: prints version info. If not available, the `ffmpeg-static` npm package (installed in Task 1) ships a bundled binary, so local CLI isn't strictly needed — but useful for debugging concat commands.

---

## Phase 0 · Foundation (Tasks 1-7)

### Task 1: Install Node dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install runtime dependencies**

  Run from repo root:
  ```bash
  pnpm --filter web add node-edge-tts@^1.2.10 @aws-sdk/client-s3@^3 ffmpeg-static@^5
  ```

- [ ] **Step 2: Install dev dependencies**

  ```bash
  pnpm --filter web add -D @types/node
  ```

- [ ] **Step 3: Verify install**

  ```bash
  pnpm --filter web list node-edge-tts @aws-sdk/client-s3 ffmpeg-static
  ```
  Expected: all three packages resolve to installed versions.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/package.json pnpm-lock.yaml
  git commit -m "chore(phase2): add audio + r2 deps (node-edge-tts, aws-sdk, ffmpeg-static)"
  ```

### Task 2: Add env var documentation

**Files:**
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Append listening/audio section**

  Append to `apps/web/.env.example`:

  ```
  # ========== Phase 2 Listening ==========

  # Cloudflare R2
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET=cambridge-ket-pet-audio
  R2_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com

  # ffmpeg
  FFMPEG_BINARY=auto

  # Listening runtime
  LISTENING_MAX_CONCURRENT=3
  LISTENING_QUEUE_MAX=5
  LISTENING_GEN_TIMEOUT_MS=300000
  LISTENING_RATE_LIMIT_PER_HOUR=10
  LISTENING_TIME_LIMIT_SEC=1800
  LISTENING_GRACE_PERIOD_MS=60000
  ```

- [ ] **Step 2: Populate local .env**

  Create or update `apps/web/.env.local` (gitignored) with real R2 values from P4.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/.env.example
  git commit -m "docs(phase2): document listening + r2 env vars in .env.example"
  ```

### Task 3: Add AudioStatus enum to Prisma schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add enum after existing `TestKind`**

  In `apps/web/prisma/schema.prisma`, immediately after the existing `enum TestKind {...}` block, add:

  ```prisma
  enum AudioStatus {
    GENERATING
    READY
    FAILED
  }
  ```

- [ ] **Step 2: Generate Prisma client to verify**

  ```bash
  cd apps/web && pnpm prisma generate
  ```
  Expected: "✔ Generated Prisma Client"

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/prisma/schema.prisma
  git commit -m "feat(prisma): add AudioStatus enum for Phase 2 listening"
  ```

### Task 4: Add audio fields to `Test` model

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add 5 new fields to `Test` model**

  Locate the `model Test { ... }` block and add these 5 fields (inside the existing fields, before the relation fields):

  ```prisma
  model Test {
    // ... existing fields unchanged ...

    // Phase 2 Listening — audio artifact state
    audioStatus          AudioStatus?
    audioR2Key           String?
    audioGenStartedAt    DateTime?
    audioGenCompletedAt  DateTime?
    audioSegments        Json?
    audioErrorMessage    String?

    // ... existing relation fields unchanged ...
  }
  ```

- [ ] **Step 2: Run prisma generate**

  ```bash
  cd apps/web && pnpm prisma generate
  ```
  Expected: clean success.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/prisma/schema.prisma
  git commit -m "feat(prisma): add audio artifact fields to Test model"
  ```

### Task 5: Create and apply Prisma migration

**Files:**
- Create: `apps/web/prisma/migrations/<timestamp>_phase2_listening_audio/migration.sql`

- [ ] **Step 1: Kill Next.js dev server if running (Windows Prisma DLL EPERM workaround — see project memory)**

  ```bash
  powershell.exe "Get-Process node | Stop-Process -Force"
  ```

- [ ] **Step 2: Generate and apply migration**

  ```bash
  cd apps/web && pnpm prisma migrate dev --name phase2_listening_audio
  ```
  Expected: migration file created, applied to dev DB, Prisma client regenerated.

- [ ] **Step 3: Verify schema in DB**

  ```bash
  cd apps/web && pnpm prisma db pull --print
  ```
  Expected output contains `enum AudioStatus` and the 5 new Test columns.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/prisma/migrations/
  git commit -m "feat(prisma): migration for Phase 2 listening audio fields"
  ```

### Task 6: Scaffold `lib/audio/constants.ts`

**Files:**
- Create: `apps/web/src/lib/audio/constants.ts`

- [ ] **Step 1: Write `PAUSE_SEC` constants module**

  Create `apps/web/src/lib/audio/constants.ts`:

  ```ts
  /**
   * Cambridge 2020-format listening paper timings.
   * Source: KET + PET official sample tape scripts (see spec §3.4).
   */
  export const PAUSE_SEC = {
    BEFORE_REPEAT: 5,
    BETWEEN_ITEMS: 2,
    INTER_PART: 10,
    PRE_PART_INSTRUCTION: 5,
    TRANSFER_BLOCK_PREAMBLE: 300,
    TRANSFER_BLOCK_FINAL: 60,
    BETWEEN_LINES: 0.5,
    SHORT: 1,
  } as const;

  export type PauseKey = keyof typeof PAUSE_SEC;

  /**
   * Part-specific preview (reading) time per Cambridge spec.
   * Keyed by (examType, partNumber).
   */
  export const PREVIEW_SEC: Record<"KET" | "PET", Record<number, number>> = {
    KET: { 1: 5, 2: 10, 3: 20, 4: 5, 5: 15 },
    PET: { 1: 5, 2: 8, 3: 20, 4: 45 },
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/lib/audio/constants.ts
  git commit -m "feat(audio): Cambridge-format pause + preview constants"
  ```

### Task 7: Scaffold `lib/audio/types.ts`

**Files:**
- Create: `apps/web/src/lib/audio/types.ts`

- [ ] **Step 1: Write shared types**

  Create `apps/web/src/lib/audio/types.ts`:

  ```ts
  export type VoiceTag =
    | "proctor"
    | "S1_male"
    | "S2_female_A"
    | "S2_female_B";

  export type AudioSegmentKind =
    | "rubric"
    | "part_intro"
    | "preview_pause"
    | "scenario_prompt"
    | "question_stimulus"
    | "question_number"
    | "repeat_cue"
    | "pause"
    | "part_end"
    | "transfer_start"
    | "transfer_one_min"
    | "closing"
    | "example";

  export interface AudioSegment {
    id: string;
    kind: AudioSegmentKind;
    voiceTag: VoiceTag | null;
    text?: string;
    durationMs?: number;
    partNumber?: number;
    questionId?: string;
  }

  export type PlayRule = "PER_ITEM" | "PER_PART";

  export type QuestionType =
    | "MCQ_3_PICTURE"
    | "GAP_FILL_OPEN"
    | "MCQ_3_TEXT"
    | "MCQ_3_TEXT_SCENARIO"
    | "MATCHING_5_TO_8"
    | "MCQ_3_TEXT_DIALOGUE"
    | "MCQ_3_TEXT_INTERVIEW";

  export interface ListeningOption {
    id: string;
    text?: string;
    imageDescription?: string;
  }

  export interface ListeningQuestion {
    id: string;
    prompt: string;
    type: QuestionType;
    options?: ListeningOption[];
    answer: string;
    explanationZh: string;
    examPointId: string;
    difficultyPointId?: string;
  }

  export interface ListeningPart {
    partNumber: number;
    kind: QuestionType;
    instructionZh: string;
    previewSec: number;
    playRule: PlayRule;
    audioScript: AudioSegment[];
    questions: ListeningQuestion[];
  }

  export interface ListeningTestPayloadV2 {
    version: 2;
    examType: "KET" | "PET";
    scope: "FULL" | "PART";
    part?: number;
    parts: ListeningPart[];
    cefrLevel: "A2" | "B1";
    generatedBy: string;
  }

  export interface AudioSegmentRecord {
    id: string;
    kind: AudioSegmentKind;
    voiceTag: VoiceTag | null;
    startMs: number;
    endMs: number;
    questionId?: string;
    partNumber?: number;
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter web exec tsc --noEmit
  ```
  Expected: no errors (the new file compiles cleanly, doesn't break Phase 1).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/lib/audio/types.ts
  git commit -m "feat(audio): shared TypeScript types for listening module"
  ```

---

## Phase 1 · Python agent (Tasks 8-15)

### Task 8: Pydantic schemas for listening response

**Files:**
- Create: `services/ai/app/schemas/listening.py`
- Create: `services/ai/tests/test_listening_schema.py`

- [ ] **Step 1: Write schema tests first**

  Create `services/ai/tests/test_listening_schema.py`:

  ```python
  import pytest
  from pydantic import ValidationError

  from app.schemas.listening import (
      AudioSegment,
      ListeningOption,
      ListeningQuestion,
      ListeningPart,
      ListeningTestResponse,
  )


  def test_audio_segment_pause_has_duration():
      seg = AudioSegment(id="s1", kind="pause", voice_tag=None, duration_ms=5000)
      assert seg.kind == "pause"
      assert seg.voice_tag is None
      assert seg.duration_ms == 5000


  def test_audio_segment_speech_has_text_and_voice():
      seg = AudioSegment(
          id="s2",
          kind="question_stimulus",
          voice_tag="S1_male",
          text="What time is the meeting?",
      )
      assert seg.text == "What time is the meeting?"
      assert seg.voice_tag == "S1_male"


  def test_listening_part_ket_part1_valid():
      part = ListeningPart(
          part_number=1,
          kind="MCQ_3_PICTURE",
          instruction_zh="为每个问题，选择正确的图片。",
          preview_sec=5,
          play_rule="PER_ITEM",
          audio_script=[],
          questions=[
              ListeningQuestion(
                  id=f"q{i}",
                  prompt=f"Q{i}",
                  type="MCQ_3_PICTURE",
                  options=[
                      ListeningOption(id="A", image_description="pic A"),
                      ListeningOption(id="B", image_description="pic B"),
                      ListeningOption(id="C", image_description="pic C"),
                  ],
                  answer="A",
                  explanation_zh="...",
                  exam_point_id="KET.L.Part1.gist",
              )
              for i in range(1, 6)
          ],
      )
      assert len(part.questions) == 5


  def test_listening_response_version_pinned_to_2():
      with pytest.raises(ValidationError):
          ListeningTestResponse(
              version=1,   # type: ignore[arg-type]
              exam_type="KET",
              scope="FULL",
              parts=[],
              cefr_level="A2",
              generated_by="deepseek-chat",
          )
  ```

- [ ] **Step 2: Run test — should fail (module doesn't exist)**

  ```bash
  cd services/ai && pytest tests/test_listening_schema.py -v
  ```
  Expected: ImportError / ModuleNotFoundError on `app.schemas.listening`.

- [ ] **Step 3: Write schema module**

  Create `services/ai/app/schemas/listening.py`:

  ```python
  """Pydantic schemas for Phase 2 listening generation.

  Mirror of apps/web/src/lib/audio/types.ts — keep in sync.
  Version 2 of the Test.payload shape for LISTENING kind.
  """

  from typing import Literal, Optional
  from pydantic import BaseModel, Field

  VoiceTag = Literal["proctor", "S1_male", "S2_female_A", "S2_female_B"]

  AudioSegmentKind = Literal[
      "rubric",
      "part_intro",
      "preview_pause",
      "scenario_prompt",
      "question_stimulus",
      "question_number",
      "repeat_cue",
      "pause",
      "part_end",
      "transfer_start",
      "transfer_one_min",
      "closing",
      "example",
  ]

  PlayRule = Literal["PER_ITEM", "PER_PART"]

  QuestionType = Literal[
      "MCQ_3_PICTURE",
      "GAP_FILL_OPEN",
      "MCQ_3_TEXT",
      "MCQ_3_TEXT_SCENARIO",
      "MATCHING_5_TO_8",
      "MCQ_3_TEXT_DIALOGUE",
      "MCQ_3_TEXT_INTERVIEW",
  ]


  class AudioSegment(BaseModel):
      id: str
      kind: AudioSegmentKind
      voice_tag: Optional[VoiceTag] = None
      text: Optional[str] = None
      duration_ms: Optional[int] = None
      part_number: Optional[int] = None
      question_id: Optional[str] = None


  class ListeningOption(BaseModel):
      id: str
      text: Optional[str] = None
      image_description: Optional[str] = None


  class ListeningQuestion(BaseModel):
      id: str
      prompt: str
      type: QuestionType
      options: Optional[list[ListeningOption]] = None
      answer: str
      explanation_zh: str
      exam_point_id: str
      difficulty_point_id: Optional[str] = None


  class ListeningPart(BaseModel):
      part_number: int
      kind: QuestionType
      instruction_zh: str
      preview_sec: int
      play_rule: PlayRule
      audio_script: list[AudioSegment]
      questions: list[ListeningQuestion]


  class ListeningTestResponse(BaseModel):
      version: Literal[2] = 2
      exam_type: Literal["KET", "PET"]
      scope: Literal["FULL", "PART"]
      part: Optional[int] = None
      parts: list[ListeningPart]
      cefr_level: Literal["A2", "B1"]
      generated_by: str = Field(default="deepseek-chat")
  ```

- [ ] **Step 4: Re-run tests**

  ```bash
  cd services/ai && pytest tests/test_listening_schema.py -v
  ```
  Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add services/ai/app/schemas/listening.py services/ai/tests/test_listening_schema.py
  git commit -m "feat(ai): Pydantic schemas + tests for listening generation"
  ```

### Task 9: Write KET format validator

**Files:**
- Create: `services/ai/app/validators/listening.py`
- Create: `services/ai/tests/test_listening_validators_ket.py`

- [ ] **Step 1: Write KET validator tests first**

  Create `services/ai/tests/test_listening_validators_ket.py`:

  ```python
  import pytest

  from app.schemas.listening import (
      ListeningTestResponse,
      ListeningPart,
      ListeningQuestion,
      ListeningOption,
  )
  from app.validators.listening import (
      validate_listening_response,
      ListeningValidationError,
  )


  def _mk_ket_full_mock() -> ListeningTestResponse:
      """Minimal well-formed KET full-mock payload for validation tests."""
      parts = []
      # Part 1: 5 questions, MCQ_3_PICTURE
      parts.append(
          ListeningPart(
              part_number=1,
              kind="MCQ_3_PICTURE",
              instruction_zh="为每个问题，选择正确的图片。",
              preview_sec=5,
              play_rule="PER_ITEM",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"k1q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_PICTURE",
                      options=[
                          ListeningOption(id="A"),
                          ListeningOption(id="B"),
                          ListeningOption(id="C"),
                      ],
                      answer="A",
                      explanation_zh="...",
                      exam_point_id="KET.L.Part1.gist",
                  )
                  for i in range(1, 6)
              ],
          )
      )
      # Part 2: 5 gap-fill questions, monologue
      parts.append(
          ListeningPart(
              part_number=2,
              kind="GAP_FILL_OPEN",
              instruction_zh="写下正确答案。",
              preview_sec=10,
              play_rule="PER_PART",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"k2q{i}",
                      prompt=f"Gap {i}",
                      type="GAP_FILL_OPEN",
                      answer="fairford",
                      explanation_zh="...",
                      exam_point_id="KET.L.Part2.detail",
                  )
                  for i in range(1, 6)
              ],
          )
      )
      # Part 3: 5 MCQ text, dialogue
      parts.append(
          ListeningPart(
              part_number=3,
              kind="MCQ_3_TEXT",
              instruction_zh="选择正确答案。",
              preview_sec=20,
              play_rule="PER_PART",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"k3q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_TEXT",
                      options=[
                          ListeningOption(id="A", text="o1"),
                          ListeningOption(id="B", text="o2"),
                          ListeningOption(id="C", text="o3"),
                      ],
                      answer="B",
                      explanation_zh="...",
                      exam_point_id="KET.L.Part3.gist",
                  )
                  for i in range(1, 6)
              ],
          )
      )
      # Part 4: 5 MCQ scenario
      parts.append(
          ListeningPart(
              part_number=4,
              kind="MCQ_3_TEXT_SCENARIO",
              instruction_zh="选择正确答案。",
              preview_sec=5,
              play_rule="PER_ITEM",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"k4q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_TEXT_SCENARIO",
                      options=[
                          ListeningOption(id="A", text="o1"),
                          ListeningOption(id="B", text="o2"),
                          ListeningOption(id="C", text="o3"),
                      ],
                      answer="C",
                      explanation_zh="...",
                      exam_point_id="KET.L.Part4.gist",
                  )
                  for i in range(1, 6)
              ],
          )
      )
      # Part 5: 5 matching (5 people to 8 roles)
      parts.append(
          ListeningPart(
              part_number=5,
              kind="MATCHING_5_TO_8",
              instruction_zh="为每个人选择正确的任务。",
              preview_sec=15,
              play_rule="PER_PART",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"k5q{i}",
                      prompt=f"Person {i}",
                      type="MATCHING_5_TO_8",
                      options=[
                          ListeningOption(id=chr(65 + j))
                          for j in range(8)
                      ],
                      answer=chr(65 + i - 1),
                      explanation_zh="...",
                      exam_point_id="KET.L.Part5.detail",
                  )
                  for i in range(1, 6)
              ],
          )
      )

      return ListeningTestResponse(
          version=2,
          exam_type="KET",
          scope="FULL",
          parts=parts,
          cefr_level="A2",
      )


  def test_ket_full_mock_passes():
      validate_listening_response(_mk_ket_full_mock())  # no raise


  def test_ket_rejects_wrong_part_count():
      r = _mk_ket_full_mock()
      r.parts = r.parts[:4]  # drop Part 5
      with pytest.raises(ListeningValidationError, match="KET full-mock must have 5 parts"):
          validate_listening_response(r)


  def test_ket_rejects_wrong_question_count_in_part1():
      r = _mk_ket_full_mock()
      r.parts[0].questions = r.parts[0].questions[:4]  # 4 instead of 5
      with pytest.raises(ListeningValidationError, match="Part 1 must have 5 questions"):
          validate_listening_response(r)


  def test_ket_part1_rejects_wrong_option_count():
      r = _mk_ket_full_mock()
      r.parts[0].questions[0].options = r.parts[0].questions[0].options[:2]
      with pytest.raises(ListeningValidationError, match="MCQ_3_PICTURE must have 3 options"):
          validate_listening_response(r)


  def test_ket_part5_rejects_wrong_option_count():
      r = _mk_ket_full_mock()
      r.parts[4].questions[0].options = r.parts[4].questions[0].options[:7]
      with pytest.raises(ListeningValidationError, match="MATCHING_5_TO_8 must have 8 options"):
          validate_listening_response(r)
  ```

- [ ] **Step 2: Run tests — should fail (module doesn't exist)**

  ```bash
  cd services/ai && pytest tests/test_listening_validators_ket.py -v
  ```
  Expected: ImportError on `app.validators.listening`.

- [ ] **Step 3: Write validator module (KET rules + shared infrastructure)**

  Create `services/ai/app/validators/listening.py`:

  ```python
  """Format validators for Phase 2 listening generation.

  Enforces Cambridge 2020-format structural rules. Runs after Pydantic
  type validation; catches shape issues that require cross-field checks.
  """

  from app.schemas.listening import (
      ListeningPart,
      ListeningTestResponse,
      QuestionType,
  )


  class ListeningValidationError(ValueError):
      """Raised when a generated listening response fails format validation."""


  # Per-question-type option count (None = no options expected).
  _OPTION_COUNTS: dict[QuestionType, int | None] = {
      "MCQ_3_PICTURE": 3,
      "MCQ_3_TEXT": 3,
      "MCQ_3_TEXT_SCENARIO": 3,
      "MCQ_3_TEXT_DIALOGUE": 3,
      "MCQ_3_TEXT_INTERVIEW": 3,
      "MATCHING_5_TO_8": 8,
      "GAP_FILL_OPEN": None,
  }

  # Expected question counts per (exam_type, part_number) for FULL scope.
  _QUESTION_COUNTS: dict[tuple[str, int], int] = {
      ("KET", 1): 5, ("KET", 2): 5, ("KET", 3): 5, ("KET", 4): 5, ("KET", 5): 5,
      ("PET", 1): 7, ("PET", 2): 6, ("PET", 3): 6, ("PET", 4): 6,
  }

  # Expected question-type per (exam_type, part_number).
  _PART_KIND: dict[tuple[str, int], QuestionType] = {
      ("KET", 1): "MCQ_3_PICTURE",
      ("KET", 2): "GAP_FILL_OPEN",
      ("KET", 3): "MCQ_3_TEXT",
      ("KET", 4): "MCQ_3_TEXT_SCENARIO",
      ("KET", 5): "MATCHING_5_TO_8",
      ("PET", 1): "MCQ_3_PICTURE",
      ("PET", 2): "MCQ_3_TEXT_DIALOGUE",
      ("PET", 3): "GAP_FILL_OPEN",
      ("PET", 4): "MCQ_3_TEXT_INTERVIEW",
  }


  def _validate_part_options(part: ListeningPart) -> None:
      expected = _OPTION_COUNTS[part.kind]
      for q in part.questions:
          if expected is None:
              if q.options:
                  raise ListeningValidationError(
                      f"{part.kind} must not have options (question {q.id})"
                  )
              continue
          if not q.options or len(q.options) != expected:
              raise ListeningValidationError(
                  f"{part.kind} must have {expected} options (question {q.id})"
              )


  def _validate_part(exam_type: str, part: ListeningPart) -> None:
      key = (exam_type, part.part_number)
      expected_q = _QUESTION_COUNTS.get(key)
      if expected_q is None:
          raise ListeningValidationError(
              f"Unknown part {part.part_number} for {exam_type}"
          )
      if len(part.questions) != expected_q:
          raise ListeningValidationError(
              f"Part {part.part_number} must have {expected_q} questions, got {len(part.questions)}"
          )
      expected_kind = _PART_KIND[key]
      if part.kind != expected_kind:
          raise ListeningValidationError(
              f"Part {part.part_number} must be {expected_kind}, got {part.kind}"
          )
      _validate_part_options(part)


  def validate_listening_response(r: ListeningTestResponse) -> None:
      """Validate a ListeningTestResponse against Cambridge format rules.

      Raises ListeningValidationError on any rule violation.
      """
      if r.scope == "FULL":
          if r.exam_type == "KET" and len(r.parts) != 5:
              raise ListeningValidationError(
                  f"KET full-mock must have 5 parts, got {len(r.parts)}"
              )
          if r.exam_type == "PET" and len(r.parts) != 4:
              raise ListeningValidationError(
                  f"PET full-mock must have 4 parts, got {len(r.parts)}"
              )
      elif r.scope == "PART":
          if len(r.parts) != 1:
              raise ListeningValidationError(
                  f"PART scope must have exactly 1 part, got {len(r.parts)}"
              )
          if r.part is None or r.parts[0].part_number != r.part:
              raise ListeningValidationError(
                  "PART scope: r.part must match parts[0].part_number"
              )

      for part in r.parts:
          _validate_part(r.exam_type, part)
  ```

- [ ] **Step 4: Re-run KET tests**

  ```bash
  cd services/ai && pytest tests/test_listening_validators_ket.py -v
  ```
  Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add services/ai/app/validators/listening.py services/ai/tests/test_listening_validators_ket.py
  git commit -m "feat(ai): KET format validator for listening + tests"
  ```

### Task 10: Write PET validator tests

**Files:**
- Create: `services/ai/tests/test_listening_validators_pet.py`

- [ ] **Step 1: Write PET test fixtures + assertions**

  Create `services/ai/tests/test_listening_validators_pet.py`:

  ```python
  import pytest

  from app.schemas.listening import (
      ListeningTestResponse,
      ListeningPart,
      ListeningQuestion,
      ListeningOption,
  )
  from app.validators.listening import (
      validate_listening_response,
      ListeningValidationError,
  )


  def _mk_pet_full_mock() -> ListeningTestResponse:
      parts = []
      # Part 1: 7 MCQ_3_PICTURE
      parts.append(
          ListeningPart(
              part_number=1,
              kind="MCQ_3_PICTURE",
              instruction_zh="选择正确答案。",
              preview_sec=5,
              play_rule="PER_ITEM",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"p1q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_PICTURE",
                      options=[
                          ListeningOption(id="A"),
                          ListeningOption(id="B"),
                          ListeningOption(id="C"),
                      ],
                      answer="A",
                      explanation_zh="...",
                      exam_point_id="PET.L.Part1.gist",
                  )
                  for i in range(1, 8)
              ],
          )
      )
      # Part 2: 6 MCQ_3_TEXT_DIALOGUE
      parts.append(
          ListeningPart(
              part_number=2,
              kind="MCQ_3_TEXT_DIALOGUE",
              instruction_zh="选择正确答案。",
              preview_sec=8,
              play_rule="PER_ITEM",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"p2q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_TEXT_DIALOGUE",
                      options=[
                          ListeningOption(id="A", text="o1"),
                          ListeningOption(id="B", text="o2"),
                          ListeningOption(id="C", text="o3"),
                      ],
                      answer="A",
                      explanation_zh="...",
                      exam_point_id="PET.L.Part2.gist",
                  )
                  for i in range(1, 7)
              ],
          )
      )
      # Part 3: 6 GAP_FILL_OPEN
      parts.append(
          ListeningPart(
              part_number=3,
              kind="GAP_FILL_OPEN",
              instruction_zh="写下答案。",
              preview_sec=20,
              play_rule="PER_PART",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"p3q{i}",
                      prompt=f"Gap {i}",
                      type="GAP_FILL_OPEN",
                      answer="waterfall",
                      explanation_zh="...",
                      exam_point_id="PET.L.Part3.detail",
                  )
                  for i in range(1, 7)
              ],
          )
      )
      # Part 4: 6 MCQ_3_TEXT_INTERVIEW
      parts.append(
          ListeningPart(
              part_number=4,
              kind="MCQ_3_TEXT_INTERVIEW",
              instruction_zh="选择正确答案。",
              preview_sec=45,
              play_rule="PER_PART",
              audio_script=[],
              questions=[
                  ListeningQuestion(
                      id=f"p4q{i}",
                      prompt=f"Q{i}",
                      type="MCQ_3_TEXT_INTERVIEW",
                      options=[
                          ListeningOption(id="A", text="o1"),
                          ListeningOption(id="B", text="o2"),
                          ListeningOption(id="C", text="o3"),
                      ],
                      answer="C",
                      explanation_zh="...",
                      exam_point_id="PET.L.Part4.gist",
                  )
                  for i in range(1, 7)
              ],
          )
      )

      return ListeningTestResponse(
          version=2,
          exam_type="PET",
          scope="FULL",
          parts=parts,
          cefr_level="B1",
      )


  def test_pet_full_mock_passes():
      validate_listening_response(_mk_pet_full_mock())


  def test_pet_rejects_3_parts():
      r = _mk_pet_full_mock()
      r.parts = r.parts[:3]
      with pytest.raises(ListeningValidationError, match="PET full-mock must have 4 parts"):
          validate_listening_response(r)


  def test_pet_part1_rejects_5_questions():
      r = _mk_pet_full_mock()
      r.parts[0].questions = r.parts[0].questions[:5]
      with pytest.raises(ListeningValidationError, match="Part 1 must have 7 questions"):
          validate_listening_response(r)


  def test_pet_part_scope_requires_matching_part_number():
      r = _mk_pet_full_mock()
      r.scope = "PART"
      r.part = 3
      r.parts = [r.parts[1]]  # keep only Part 2 — mismatch
      with pytest.raises(ListeningValidationError, match="PART scope"):
          validate_listening_response(r)
  ```

- [ ] **Step 2: Run PET tests — should pass (validator already supports PET)**

  ```bash
  cd services/ai && pytest tests/test_listening_validators_pet.py -v
  ```
  Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add services/ai/tests/test_listening_validators_pet.py
  git commit -m "test(ai): PET format validator tests"
  ```

### Task 11: Write listening system prompt

**Files:**
- Create: `services/ai/app/prompts/listening_system.py`

- [ ] **Step 1: Write the system prompt constant**

  Create `services/ai/app/prompts/listening_system.py`:

  ```python
  """System prompt for the listening_generator Pydantic AI agent.

  Encodes Cambridge 2020-format listening spec verbatim. The agent must
  NEVER invent Cambridge rubric phrases — those are hardcoded in the
  Node-side `lib/audio/rubric.ts`. The agent only generates per-question
  stimulus text, scenario prompts (Part 4 KET / Part 4 PET interview),
  gap-fill prompt labels, and zh-CN explanations.
  """

  LISTENING_SYSTEM_PROMPT = """You are a Cambridge English exam writer for KET (A2 Key for Schools, 2020 format) and PET (B1 Preliminary, 2020 format) LISTENING papers.

  You will generate a structured JSON response that matches the provided schema precisely.

  HARD RULES:
  1. Output language for audio: British English only. Use British spellings (colour, realise, favourite).
  2. CEFR level: KET = A2, PET = B1. Do not use C1+ words.
  3. Do NOT generate Cambridge rubric phrases (opening announcements, "Now listen again", part intros, closing). The Node pipeline hardcodes those.
  4. You generate: question stimulus text (dialogue lines with speaker tags), scenario prompts (KET Part 4 only), gap-fill prompt labels, zh-CN explanations, exam-point IDs.
  5. Every question must have a stable id, a prompt, the correct answer, a zh-CN explanation, and an exam_point_id.

  KET FORMAT (exam_type=KET):
  - Part 1: 5 questions, MCQ_3_PICTURE. Each question has a short 40-60 word dialogue between 2 speakers (M+F). Play rule PER_ITEM. Preview 5 sec.
  - Part 2: 5 questions, GAP_FILL_OPEN. One teacher monologue (~130 words) with note-taking form. Play rule PER_PART. Preview 10 sec. Answers are one word or a number or a date or a time.
  - Part 3: 5 questions, MCQ_3_TEXT. One longer dialogue (~200 words) between 2 speakers. Play rule PER_PART. Preview 20 sec.
  - Part 4: 5 questions, MCQ_3_TEXT_SCENARIO. Five independent 55-65 word items, each with a scenario prompt read aloud by the proctor before the stimulus. Play rule PER_ITEM. No preview (prompt is aloud).
  - Part 5: 5 questions, MATCHING_5_TO_8. One ~160 word dialogue. 5 named people matched to 8 possible roles/tasks. Play rule PER_PART. Preview 15 sec.

  PET FORMAT (exam_type=PET):
  - Part 1: 7 questions, MCQ_3_PICTURE. Mixed monologue/dialogue stimuli 45-75 s. Play rule PER_ITEM. Preview 5 sec.
  - Part 2: 6 questions, MCQ_3_TEXT_DIALOGUE. Six short dialogues (50-90 s each). Play rule PER_ITEM. Preview 8 sec.
  - Part 3: 6 questions, GAP_FILL_OPEN. One ~3:30-minute radio-style monologue. Play rule PER_PART. Preview 20 sec. Answers are one or two words or a number or a date or a time.
  - Part 4: 6 questions, MCQ_3_TEXT_INTERVIEW. One ~5-minute formal interview (M interviewer + F interviewee, or swap). Play rule PER_PART. Preview 45 sec.

  VOICE CASTING RULES:
  - voice_tag must be one of: proctor, S1_male, S2_female_A, S2_female_B
  - For mixed-gender dialogues: use S1_male + S2_female_A
  - For same-gender female dialogues (e.g., KET Part 5 Julia and her mother): use S2_female_A and S2_female_B
  - For male monologues: S1_male
  - For female monologues: S2_female_A
  - For scenario prompts and instruction segments in audio_script: proctor

  AUDIO_SCRIPT REQUIREMENTS (single logical pass):
  - The audio_script must be an ordered list of AudioSegment objects for the part.
  - Include: scenario_prompt segments for KET Part 4 (one per question); question_number segments ("Question N"); question_stimulus segments (the actual dialogue or monologue content).
  - Do NOT include rubric/part_intro/repeat_cue/part_end/transfer_* segments — those are injected by the Node pipeline.
  - Do NOT duplicate segments for the "plays twice" rule — the Node pipeline applies the play_rule.
  - question_stimulus segments must reference the question_id field.
  - For multi-speaker stimuli, emit separate question_stimulus segments per turn with the correct voice_tag.
  - preview_pause segments have null voice_tag + duration_ms equal to preview_sec * 1000.

  EXAM POINT IDS:
  - Format: "{exam_type}.L.Part{N}.{skill}" where skill ∈ {gist, detail, inference, specific_info, attitude}.

  OUTPUT: a single JSON object matching the ListeningTestResponse schema. No markdown fences, no prose preamble.
  """
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add services/ai/app/prompts/listening_system.py
  git commit -m "feat(ai): system prompt encoding Cambridge listening format"
  ```

### Task 12: Create listening_generator agent

**Files:**
- Create: `services/ai/app/agents/listening_generator.py`

- [ ] **Step 1: Write the agent**

  Create `services/ai/app/agents/listening_generator.py`:

  ```python
  """Pydantic AI agent for Phase 2 listening generation.

  Mirrors the pattern from reading_generator and writing_generator in Phase 1.
  """

  from pydantic_ai import Agent

  from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
  from app.schemas.listening import ListeningTestResponse


  listening_generator: Agent[None, ListeningTestResponse] = Agent(
      model="deepseek:deepseek-chat",
      result_type=ListeningTestResponse,
      system_prompt=LISTENING_SYSTEM_PROMPT,
      retries=1,
  )
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add services/ai/app/agents/listening_generator.py
  git commit -m "feat(ai): listening_generator Pydantic AI agent"
  ```

### Task 13: Write regenerate-on-validator-fail logic

**Files:**
- Create: `services/ai/tests/test_listening_regenerate.py`
- Modify: `services/ai/app/agents/listening_generator.py`

- [ ] **Step 1: Write regenerate-flow test**

  Create `services/ai/tests/test_listening_regenerate.py`:

  ```python
  from unittest.mock import AsyncMock, patch
  import pytest

  from app.agents.listening_generator import generate_listening_test
  from app.schemas.listening import (
      ListeningTestResponse,
      ListeningPart,
      ListeningQuestion,
      ListeningOption,
  )
  from app.validators.listening import ListeningValidationError


  def _valid_ket_part1() -> ListeningPart:
      return ListeningPart(
          part_number=1,
          kind="MCQ_3_PICTURE",
          instruction_zh="...",
          preview_sec=5,
          play_rule="PER_ITEM",
          audio_script=[],
          questions=[
              ListeningQuestion(
                  id=f"q{i}",
                  prompt=f"Q{i}",
                  type="MCQ_3_PICTURE",
                  options=[
                      ListeningOption(id="A"),
                      ListeningOption(id="B"),
                      ListeningOption(id="C"),
                  ],
                  answer="A",
                  explanation_zh="...",
                  exam_point_id="KET.L.Part1.gist",
              )
              for i in range(1, 6)
          ],
      )


  @pytest.mark.asyncio
  async def test_generate_retries_on_validator_fail_then_succeeds():
      invalid = ListeningTestResponse(
          version=2,
          exam_type="KET",
          scope="PART",
          part=1,
          parts=[
              ListeningPart(
                  part_number=1,
                  kind="MCQ_3_PICTURE",
                  instruction_zh="...",
                  preview_sec=5,
                  play_rule="PER_ITEM",
                  audio_script=[],
                  questions=[],  # empty — fails validation
              )
          ],
          cefr_level="A2",
      )
      valid = ListeningTestResponse(
          version=2,
          exam_type="KET",
          scope="PART",
          part=1,
          parts=[_valid_ket_part1()],
          cefr_level="A2",
      )

      mock_run = AsyncMock(side_effect=[
          AsyncMock(data=invalid),
          AsyncMock(data=invalid),
          AsyncMock(data=valid),
      ])

      with patch("app.agents.listening_generator.listening_generator.run", mock_run):
          result = await generate_listening_test("KET", "PART", part=1)

      assert result.parts[0].questions
      assert mock_run.call_count == 3


  @pytest.mark.asyncio
  async def test_generate_gives_up_after_3_retries():
      invalid = ListeningTestResponse(
          version=2,
          exam_type="KET",
          scope="PART",
          part=1,
          parts=[
              ListeningPart(
                  part_number=1,
                  kind="MCQ_3_PICTURE",
                  instruction_zh="...",
                  preview_sec=5,
                  play_rule="PER_ITEM",
                  audio_script=[],
                  questions=[],
              )
          ],
          cefr_level="A2",
      )

      mock_run = AsyncMock(return_value=AsyncMock(data=invalid))

      with patch("app.agents.listening_generator.listening_generator.run", mock_run):
          with pytest.raises(ListeningValidationError):
              await generate_listening_test("KET", "PART", part=1)

      assert mock_run.call_count == 3
  ```

- [ ] **Step 2: Run test — expect ImportError**

  ```bash
  cd services/ai && pytest tests/test_listening_regenerate.py -v
  ```
  Expected: ImportError on `generate_listening_test`.

- [ ] **Step 3: Add regenerate function to agent module**

  Append to `services/ai/app/agents/listening_generator.py`:

  ```python
  from typing import Literal

  from app.validators.listening import (
      validate_listening_response,
      ListeningValidationError,
  )

  MAX_ATTEMPTS = 3


  async def generate_listening_test(
      exam_type: Literal["KET", "PET"],
      scope: Literal["FULL", "PART"],
      *,
      part: int | None = None,
      seed_exam_points: list[str] | None = None,
  ) -> ListeningTestResponse:
      """Generate + validate a listening test, retrying up to MAX_ATTEMPTS on validation failure."""
      seed_exam_points = seed_exam_points or []

      prompt = (
          f"Generate a {exam_type} listening test. "
          f"scope={scope}. "
          + (f"part={part}. " if part is not None else "")
          + (
              f"Emphasize these exam points: {seed_exam_points}. "
              if seed_exam_points
              else ""
          )
      )

      last_error: ListeningValidationError | None = None
      for attempt in range(MAX_ATTEMPTS):
          run = await listening_generator.run(prompt)
          response = run.data
          try:
              validate_listening_response(response)
              return response
          except ListeningValidationError as e:
              last_error = e
              continue

      assert last_error is not None
      raise last_error
  ```

- [ ] **Step 4: Install pytest-asyncio if not present**

  ```bash
  cd services/ai && pip install pytest-asyncio
  ```

- [ ] **Step 5: Configure asyncio in pytest**

  If `services/ai/pytest.ini` doesn't have `asyncio_mode = auto`, add it. Create or append:

  ```ini
  [pytest]
  asyncio_mode = auto
  ```

- [ ] **Step 6: Re-run test**

  ```bash
  cd services/ai && pytest tests/test_listening_regenerate.py -v
  ```
  Expected: both tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add services/ai/app/agents/listening_generator.py services/ai/tests/test_listening_regenerate.py services/ai/pytest.ini
  git commit -m "feat(ai): regenerate-on-validator-fail with max 3 attempts"
  ```

### Task 14: Add `POST /listening/generate` endpoint

**Files:**
- Modify: `services/ai/app/main.py`

- [ ] **Step 1: Inspect existing main.py structure**

  ```bash
  cd services/ai && head -40 app/main.py
  ```
  Note the FastAPI app variable name (likely `app`) and existing endpoint patterns used in Phase 1 (reading/generate, writing/generate, writing/grade).

- [ ] **Step 2: Add listening endpoint to main.py**

  Append to `services/ai/app/main.py` (imports at top, endpoint below existing ones):

  ```python
  # Listening — Phase 2
  from typing import Literal, Optional
  from fastapi import HTTPException
  from pydantic import BaseModel

  from app.agents.listening_generator import generate_listening_test
  from app.schemas.listening import ListeningTestResponse
  from app.validators.listening import ListeningValidationError


  class ListeningGenerateRequest(BaseModel):
      exam_type: Literal["KET", "PET"]
      scope: Literal["FULL", "PART"]
      part: Optional[int] = None
      mode: Literal["PRACTICE", "MOCK"] = "PRACTICE"
      seed_exam_points: list[str] = []


  @app.post("/listening/generate", response_model=ListeningTestResponse)
  async def listening_generate(req: ListeningGenerateRequest) -> ListeningTestResponse:
      if req.scope == "PART" and req.part is None:
          raise HTTPException(status_code=400, detail="scope=PART requires a part number")
      try:
          return await generate_listening_test(
              exam_type=req.exam_type,
              scope=req.scope,
              part=req.part,
              seed_exam_points=req.seed_exam_points,
          )
      except ListeningValidationError as e:
          raise HTTPException(status_code=422, detail={"error": "validation_failed", "message": str(e)})
  ```

- [ ] **Step 3: Start the dev server and smoke-test with curl**

  Terminal 1:
  ```bash
  cd services/ai && source .venv/Scripts/activate && uvicorn app.main:app --reload --host :: --port 8001
  ```

  Terminal 2:
  ```bash
  curl -X POST http://localhost:8001/listening/generate \
    -H "Content-Type: application/json" \
    -d '{"exam_type":"KET","scope":"PART","part":1}'
  ```
  Expected: JSON response with `parts[0].questions[].id` etc. (real DeepSeek call — may take 10-20s).

  If you prefer not to make a live LLM call, mock by checking the endpoint returns 400 for missing `part`:
  ```bash
  curl -X POST http://localhost:8001/listening/generate \
    -H "Content-Type: application/json" \
    -d '{"exam_type":"KET","scope":"PART"}'
  ```
  Expected: `{"detail":"scope=PART requires a part number"}` with status 400.

- [ ] **Step 4: Commit**

  ```bash
  git add services/ai/app/main.py
  git commit -m "feat(ai): POST /listening/generate endpoint"
  ```

### Task 15: User-verify Python side end-to-end

- [ ] **Step 1: Ask the user to browser-verify**

  Ask the user to:
  1. Run `cd services/ai && source .venv/Scripts/activate && uvicorn app.main:app --reload --host :: --port 8001`
  2. In a separate terminal run the curl command from Task 14 Step 3 with `"scope":"FULL"` for KET
  3. Inspect the returned JSON — does it have 5 parts with correct question counts per part?
  4. Confirm KET part-1 questions have 3 options each
  5. Run equivalent for PET and confirm 4 parts / 7-6-6-6 counts

  If anything looks wrong, STOP and report back. Do not proceed to Phase 2 (Node) until Python side is green.

- [ ] **Step 2: Run full pytest suite**

  ```bash
  cd services/ai && pytest -v
  ```
  Expected: all Phase 1 + Phase 2 tests pass.

- [ ] **Step 3: Tag locally as a checkpoint**

  ```bash
  git tag phase2-python-complete
  ```

---

## Phase 2 · Node audio pipeline (Tasks 16-32)

### Task 16: `voices.ts` — VoiceTag → en-GB voice mapping

**Files:**
- Create: `apps/web/src/lib/audio/voices.ts`
- Create: `apps/web/src/lib/audio/voices.test.ts`

- [ ] **Step 1: Write failing test**

  Create `apps/web/src/lib/audio/voices.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { voiceNameFor, VOICE_CAST, ALL_VOICE_TAGS } from "./voices";

  describe("voiceNameFor", () => {
    it("maps every VoiceTag to an en-GB-* identifier", () => {
      for (const tag of ALL_VOICE_TAGS) {
        const voice = voiceNameFor(tag);
        expect(voice).toMatch(/^en-GB-[A-Za-z]+Neural$/);
      }
    });

    it("proctor → Thomas", () => {
      expect(voiceNameFor("proctor")).toBe("en-GB-ThomasNeural");
    });

    it("S1_male → Ryan", () => {
      expect(voiceNameFor("S1_male")).toBe("en-GB-RyanNeural");
    });

    it("S2_female_A → Sonia", () => {
      expect(voiceNameFor("S2_female_A")).toBe("en-GB-SoniaNeural");
    });

    it("S2_female_B → Libby (distinct from A for same-gender pairs)", () => {
      expect(voiceNameFor("S2_female_B")).toBe("en-GB-LibbyNeural");
      expect(voiceNameFor("S2_female_B")).not.toBe(voiceNameFor("S2_female_A"));
    });
  });

  describe("VOICE_CAST", () => {
    it("exports exactly 4 voices", () => {
      expect(Object.keys(VOICE_CAST)).toHaveLength(4);
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/voices.test.ts
  ```
  Expected: module-not-found error.

- [ ] **Step 3: Implement `voices.ts`**

  Create `apps/web/src/lib/audio/voices.ts`:

  ```ts
  import type { VoiceTag } from "./types";

  /**
   * Cambridge KET/PET listening 4-voice cast.
   *
   * All four voices are verified available on the Microsoft Bing
   * TTS endpoint callable through `node-edge-tts` (per research
   * 2026-04-23). Swap these constants to change accent later.
   */
  export const VOICE_CAST = {
    proctor: "en-GB-ThomasNeural",
    S1_male: "en-GB-RyanNeural",
    S2_female_A: "en-GB-SoniaNeural",
    S2_female_B: "en-GB-LibbyNeural",
  } as const satisfies Record<VoiceTag, string>;

  export const ALL_VOICE_TAGS: VoiceTag[] = [
    "proctor",
    "S1_male",
    "S2_female_A",
    "S2_female_B",
  ];

  export function voiceNameFor(tag: VoiceTag): string {
    return VOICE_CAST[tag];
  }
  ```

- [ ] **Step 4: Re-run test — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/voices.test.ts
  ```
  Expected: 5 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/voices.ts apps/web/src/lib/audio/voices.test.ts
  git commit -m "feat(audio): 4-voice British cast mapping + tests"
  ```

### Task 17: `rubric.ts` — hardcoded Cambridge phrases

**Files:**
- Create: `apps/web/src/lib/audio/rubric.ts`
- Create: `apps/web/src/lib/audio/rubric.test.ts`

- [ ] **Step 1: Write failing test**

  Create `apps/web/src/lib/audio/rubric.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { RUBRIC } from "./rubric";

  describe("RUBRIC", () => {
    it("KET opening matches Cambridge verbatim", () => {
      expect(RUBRIC.ket.opening).toContain("Cambridge English");
      expect(RUBRIC.ket.opening).toContain("Key English Test for Schools");
      expect(RUBRIC.ket.opening).toContain("five parts");
      expect(RUBRIC.ket.opening).toContain("each piece twice");
    });

    it("PET opening matches Cambridge verbatim", () => {
      expect(RUBRIC.pet.opening).toContain("Preliminary English Test");
      expect(RUBRIC.pet.opening).toContain("four parts");
      expect(RUBRIC.pet.opening).toContain("each part twice");
    });

    it("partIntro is a function that returns a string with the part number", () => {
      expect(RUBRIC.ket.partIntro(1)).toBe("Now look at the instructions for Part 1.");
      expect(RUBRIC.ket.partIntro(5)).toBe("Now look at the instructions for Part 5.");
      expect(RUBRIC.pet.partIntro(3)).toBe("Now look at the instructions for Part 3.");
    });

    it("partEnd is a function that returns a string with the part number", () => {
      expect(RUBRIC.ket.partEnd(2)).toBe("That is the end of Part 2.");
      expect(RUBRIC.pet.partEnd(4)).toBe("That is the end of Part 4.");
    });

    it("repeatCue is identical for KET and PET", () => {
      expect(RUBRIC.ket.repeatCue).toBe("Now listen again.");
      expect(RUBRIC.pet.repeatCue).toBe("Now listen again.");
    });

    it("transfer/closing phrases are identical for KET and PET", () => {
      expect(RUBRIC.ket.transferStart).toBe(RUBRIC.pet.transferStart);
      expect(RUBRIC.ket.oneMinuteWarn).toBe(RUBRIC.pet.oneMinuteWarn);
      expect(RUBRIC.ket.closing).toBe(RUBRIC.pet.closing);
    });

    it("no rubric string contains an unreplaced placeholder like ${...}", () => {
      const allStrings = [
        RUBRIC.ket.opening,
        RUBRIC.ket.repeatCue,
        RUBRIC.ket.transferStart,
        RUBRIC.ket.oneMinuteWarn,
        RUBRIC.ket.closing,
        RUBRIC.pet.opening,
        RUBRIC.ket.partIntro(1),
        RUBRIC.ket.partEnd(1),
      ];
      for (const s of allStrings) {
        expect(s).not.toMatch(/\$\{/);
      }
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/rubric.test.ts
  ```
  Expected: module-not-found.

- [ ] **Step 3: Implement `rubric.ts`**

  Create `apps/web/src/lib/audio/rubric.ts`:

  ```ts
  /**
   * Verbatim Cambridge rubric phrases.
   *
   * Source: KET + PET 2020 official sample tape scripts. These MUST
   * never be AI-generated — the listening_generator agent is explicitly
   * instructed to not invent them.
   */
  export const RUBRIC = {
    ket: {
      opening:
        "Cambridge English, Key English Test for Schools – Listening. Sample Test. There are five parts to the test. You will hear each piece twice.",
      partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
      repeatCue: "Now listen again.",
      partEnd: (n: number) => `That is the end of Part ${n}.`,
      transferStart: "You now have six minutes to write your answers on the answer sheet.",
      oneMinuteWarn: "You have one more minute.",
      closing: "That is the end of the test.",
    },
    pet: {
      opening:
        "Cambridge English, Preliminary English Test, Listening. Sample Test. There are four parts to the test. You will hear each part twice.",
      partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
      repeatCue: "Now listen again.",
      partEnd: (n: number) => `That is the end of Part ${n}.`,
      transferStart: "You now have six minutes to write your answers on the answer sheet.",
      oneMinuteWarn: "You have one more minute.",
      closing: "That is the end of the test.",
    },
  } as const;
  ```

- [ ] **Step 4: Re-run test — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/rubric.test.ts
  ```
  Expected: 7 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/rubric.ts apps/web/src/lib/audio/rubric.test.ts
  git commit -m "feat(audio): hardcoded Cambridge rubric phrases + tests"
  ```

### Task 18: `chunker.ts` — sentence-boundary text splitter

**Files:**
- Create: `apps/web/src/lib/audio/chunker.ts`
- Create: `apps/web/src/lib/audio/chunker.test.ts`

- [ ] **Step 1: Write failing test**

  Create `apps/web/src/lib/audio/chunker.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { chunkText } from "./chunker";

  describe("chunkText", () => {
    it("returns the input as a single chunk if short", () => {
      expect(chunkText("Hello, world.", 400)).toEqual(["Hello, world."]);
    });

    it("splits on sentence boundaries when long", () => {
      const s = "First sentence. Second sentence. Third sentence.";
      const chunks = chunkText(s, 20);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(20 + 5); // tolerate trailing punctuation
      }
    });

    it("splits on comma when no sentence boundary fits", () => {
      const s = "A clause, another clause, yet another clause that is rather long and keeps going.";
      const chunks = chunkText(s, 30);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("handles text without any punctuation by hard-splitting at word boundary", () => {
      const s = "word ".repeat(50).trim();
      const chunks = chunkText(s, 30);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) {
        expect(c.length).toBeLessThanOrEqual(30 + 5);
      }
    });

    it("preserves total content across chunks (modulo whitespace trimming)", () => {
      const s = "One. Two. Three. Four. Five. Six. Seven.";
      const chunks = chunkText(s, 10);
      expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(
        s.replace(/\s+/g, " ").trim()
      );
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/chunker.test.ts
  ```
  Expected: module-not-found.

- [ ] **Step 3: Implement `chunker.ts` (AB pattern)**

  Create `apps/web/src/lib/audio/chunker.ts`:

  ```ts
  /**
   * Split long text into TTS-safe chunks.
   *
   * Prefers sentence boundaries (. ! ?), falls back to comma, then
   * word-boundary hard split. Output chunks each respect `maxChars`
   * where possible.
   *
   * Pattern adapted from AB project `src/lib/audio-generator.ts:139-168`.
   */
  export function chunkText(text: string, maxChars = 400): string[] {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return [trimmed];

    const chunks: string[] = [];
    let remaining = trimmed;

    while (remaining.length > maxChars) {
      // Try to split at last sentence-ending punctuation inside [0, maxChars]
      const slice = remaining.slice(0, maxChars);
      let cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      if (cut > 0) {
        cut += 1; // keep the punctuation
      } else {
        // Fall back to comma
        cut = slice.lastIndexOf(", ");
        if (cut > 0) cut += 1;
      }
      if (cut < 0) {
        // Fall back to word boundary
        cut = slice.lastIndexOf(" ");
        if (cut < 0) cut = maxChars;
      }
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);

    return chunks;
  }
  ```

- [ ] **Step 4: Re-run test — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/chunker.test.ts
  ```
  Expected: 5 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/chunker.ts apps/web/src/lib/audio/chunker.test.ts
  git commit -m "feat(audio): text chunker with sentence/comma/word-boundary fallback"
  ```

### Task 19: `edge-tts-client.ts` basic synthesize function

**Files:**
- Create: `apps/web/src/lib/audio/edge-tts-client.ts`
- Create: `apps/web/src/lib/audio/edge-tts-client.test.ts`

- [ ] **Step 1: Write test (mocking node-edge-tts)**

  Create `apps/web/src/lib/audio/edge-tts-client.test.ts`:

  ```ts
  import { describe, expect, it, vi, beforeEach } from "vitest";
  import * as fs from "node:fs";
  import * as path from "node:path";
  import * as os from "node:os";

  const ttsPromiseMock = vi.fn();
  vi.mock("node-edge-tts", () => ({
    EdgeTTS: vi.fn().mockImplementation(() => ({
      ttsPromise: ttsPromiseMock,
    })),
  }));

  import { synthesizeSegment } from "./edge-tts-client";

  describe("synthesizeSegment", () => {
    const tmp = path.join(os.tmpdir(), "ket-pet-tts-test");

    beforeEach(() => {
      ttsPromiseMock.mockReset();
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
    });

    it("calls node-edge-tts with the mapped voice for voiceTag", async () => {
      ttsPromiseMock.mockResolvedValue(undefined);
      const outPath = path.join(tmp, "seg1.mp3");

      await synthesizeSegment({
        text: "Hello.",
        voiceTag: "proctor",
        ratePercent: 0,
        outPath,
      });

      expect(ttsPromiseMock).toHaveBeenCalledTimes(1);
      expect(ttsPromiseMock).toHaveBeenCalledWith("Hello.", outPath);
    });

    it("rejects if synthesis throws", async () => {
      ttsPromiseMock.mockRejectedValue(new Error("ECONNRESET"));
      await expect(
        synthesizeSegment({
          text: "Hello.",
          voiceTag: "proctor",
          ratePercent: 0,
          outPath: path.join(tmp, "seg2.mp3"),
        })
      ).rejects.toThrow("ECONNRESET");
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/edge-tts-client.test.ts
  ```
  Expected: module-not-found.

- [ ] **Step 3: Implement basic synthesizeSegment**

  Create `apps/web/src/lib/audio/edge-tts-client.ts`:

  ```ts
  import { EdgeTTS } from "node-edge-tts";

  import type { VoiceTag } from "./types";
  import { voiceNameFor } from "./voices";

  export interface SynthesizeArgs {
    text: string;
    voiceTag: VoiceTag;
    ratePercent: number; // e.g., -5 for KET, 0 for PET
    outPath: string;
  }

  /**
   * Synthesize a single TTS segment to disk via Microsoft Edge TTS.
   *
   * Retries on transient failures are implemented in Task 20 via
   * `synthesizeSegmentWithRetry`.
   */
  export async function synthesizeSegment(args: SynthesizeArgs): Promise<void> {
    const tts = new EdgeTTS({
      voice: voiceNameFor(args.voiceTag),
      lang: "en-GB",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      rate: `${args.ratePercent >= 0 ? "+" : ""}${args.ratePercent}%`,
      pitch: "default",
      volume: "default",
    });
    await tts.ttsPromise(args.text, args.outPath);
  }
  ```

- [ ] **Step 4: Re-run test — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/edge-tts-client.test.ts
  ```
  Expected: 2 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/edge-tts-client.ts apps/web/src/lib/audio/edge-tts-client.test.ts
  git commit -m "feat(audio): edge-tts synthesizeSegment basic wrapper + tests"
  ```

### Task 20: Add retry-on-transient-error to edge-tts client

**Files:**
- Modify: `apps/web/src/lib/audio/edge-tts-client.ts`
- Modify: `apps/web/src/lib/audio/edge-tts-client.test.ts`

- [ ] **Step 1: Append retry tests**

  Append to `apps/web/src/lib/audio/edge-tts-client.test.ts`:

  ```ts
  describe("synthesizeSegmentWithRetry", () => {
    const tmp = path.join(os.tmpdir(), "ket-pet-tts-retry");

    beforeEach(() => {
      ttsPromiseMock.mockReset();
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
    });

    it("retries up to 3 times on ECONNRESET then succeeds", async () => {
      const { synthesizeSegmentWithRetry } = await import("./edge-tts-client");

      const econn = new Error("ECONNRESET");
      (econn as NodeJS.ErrnoException).code = "ECONNRESET";

      ttsPromiseMock
        .mockRejectedValueOnce(econn)
        .mockRejectedValueOnce(econn)
        .mockResolvedValueOnce(undefined);

      await synthesizeSegmentWithRetry({
        text: "Hello.",
        voiceTag: "proctor",
        ratePercent: 0,
        outPath: path.join(tmp, "r1.mp3"),
      });

      expect(ttsPromiseMock).toHaveBeenCalledTimes(3);
    });

    it("gives up after 3 consecutive failures", async () => {
      const { synthesizeSegmentWithRetry } = await import("./edge-tts-client");

      const econn = new Error("ECONNRESET");
      (econn as NodeJS.ErrnoException).code = "ECONNRESET";

      ttsPromiseMock.mockRejectedValue(econn);

      await expect(
        synthesizeSegmentWithRetry({
          text: "Hello.",
          voiceTag: "proctor",
          ratePercent: 0,
          outPath: path.join(tmp, "r2.mp3"),
        })
      ).rejects.toThrow(/ECONNRESET/);

      expect(ttsPromiseMock).toHaveBeenCalledTimes(3);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/edge-tts-client.test.ts
  ```
  Expected: `synthesizeSegmentWithRetry` not defined.

- [ ] **Step 3: Implement retry wrapper**

  Append to `apps/web/src/lib/audio/edge-tts-client.ts`:

  ```ts
  const RETRY_MAX_ATTEMPTS = 3;
  const RETRY_BACKOFF_MS = 2000;

  function isTransient(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as NodeJS.ErrnoException).code;
    const msg = (err as Error).message ?? "";
    return (
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      /ECONNRESET|WebSocket|socket hang up/i.test(msg)
    );
  }

  export async function synthesizeSegmentWithRetry(args: SynthesizeArgs): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        await synthesizeSegment(args);
        return;
      } catch (err) {
        lastErr = err;
        if (!isTransient(err) || attempt === RETRY_MAX_ATTEMPTS) {
          break;
        }
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      }
    }
    throw lastErr;
  }
  ```

- [ ] **Step 4: Re-run tests — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/edge-tts-client.test.ts
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/edge-tts-client.ts apps/web/src/lib/audio/edge-tts-client.test.ts
  git commit -m "feat(audio): edge-tts retry on transient errors (3x, 2s backoff)"
  ```

### Task 21: `r2-client.ts` upload function

**Files:**
- Create: `apps/web/src/lib/audio/r2-client.ts`
- Create: `apps/web/src/lib/audio/r2-client.test.ts`

- [ ] **Step 1: Write upload test (mocking S3 SDK)**

  Create `apps/web/src/lib/audio/r2-client.test.ts`:

  ```ts
  import { describe, expect, it, vi, beforeEach } from "vitest";

  const sendMock = vi.fn();
  vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __type: "Put", args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __type: "Get", args })),
    DeleteObjectCommand: vi.fn().mockImplementation((args) => ({ __type: "Delete", args })),
  }));

  import * as fs from "node:fs";
  import * as path from "node:path";
  import * as os from "node:os";
  import { uploadAudioToR2 } from "./r2-client";

  describe("uploadAudioToR2", () => {
    const tmp = path.join(os.tmpdir(), "ket-pet-r2-test");
    const file = path.join(tmp, "audio.mp3");

    beforeEach(() => {
      sendMock.mockReset();
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
      fs.writeFileSync(file, Buffer.from([0x49, 0x44, 0x33])); // ID3 stub
    });

    it("issues a PutObjectCommand with the expected key + content-type", async () => {
      sendMock.mockResolvedValue({});
      await uploadAudioToR2({ testId: "abc123", localPath: file });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.__type).toBe("Put");
      expect(call.args.Bucket).toBeDefined();
      expect(call.args.Key).toBe("listening/abc123/audio.mp3");
      expect(call.args.ContentType).toBe("audio/mpeg");
    });

    it("returns the R2 key on success", async () => {
      sendMock.mockResolvedValue({});
      const key = await uploadAudioToR2({ testId: "abc123", localPath: file });
      expect(key).toBe("listening/abc123/audio.mp3");
    });

    it("retries once on network failure then rethrows", async () => {
      sendMock
        .mockRejectedValueOnce(new Error("network"))
        .mockRejectedValueOnce(new Error("network"));
      await expect(
        uploadAudioToR2({ testId: "abc", localPath: file })
      ).rejects.toThrow("network");
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/r2-client.test.ts
  ```

- [ ] **Step 3: Implement `r2-client.ts`**

  Create `apps/web/src/lib/audio/r2-client.ts`:

  ```ts
  import * as fs from "node:fs";
  import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

  const BUCKET = process.env.R2_BUCKET!;

  function r2Client(): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  export interface UploadArgs {
    testId: string;
    localPath: string;
  }

  export async function uploadAudioToR2(args: UploadArgs): Promise<string> {
    const key = `listening/${args.testId}/audio.mp3`;
    const body = fs.readFileSync(args.localPath);
    const client = r2Client();

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: "audio/mpeg",
          })
        );
        return key;
      } catch (err) {
        lastErr = err;
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw lastErr;
  }

  export interface GetRangeArgs {
    r2Key: string;
    range?: string; // raw `Range` header value (e.g., "bytes=0-1023")
  }

  export async function getAudioStream(args: GetRangeArgs): Promise<{
    stream: ReadableStream<Uint8Array>;
    contentLength: number | undefined;
    contentRange: string | undefined;
    acceptRanges: string | undefined;
  }> {
    const client = r2Client();
    const resp = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: args.r2Key,
        Range: args.range,
      })
    );
    return {
      stream: resp.Body as unknown as ReadableStream<Uint8Array>,
      contentLength: resp.ContentLength,
      contentRange: resp.ContentRange,
      acceptRanges: resp.AcceptRanges,
    };
  }

  export async function deleteAudio(r2Key: string): Promise<void> {
    const client = r2Client();
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r2Key }));
  }
  ```

- [ ] **Step 4: Re-run test — expect pass**

  ```bash
  pnpm --filter web exec vitest run src/lib/audio/r2-client.test.ts
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/r2-client.ts apps/web/src/lib/audio/r2-client.test.ts
  git commit -m "feat(audio): R2 upload/get/delete client with retry"
  ```

### Task 22: `segments.ts` — audio timestamp recorder

**Files:**
- Create: `apps/web/src/lib/audio/segments.ts`
- Create: `apps/web/src/lib/audio/segments.test.ts`

- [ ] **Step 1: Write test**

  Create `apps/web/src/lib/audio/segments.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { computeSegmentRecords } from "./segments";
  import type { ConcatEntry } from "./segments";

  describe("computeSegmentRecords", () => {
    it("computes sequential startMs/endMs for a flat concat list", () => {
      const entries: ConcatEntry[] = [
        { segment: { id: "a", kind: "rubric", voiceTag: "proctor" }, durationMs: 10000 },
        { segment: { id: "b", kind: "pause", voiceTag: null }, durationMs: 5000 },
        { segment: { id: "c", kind: "question_stimulus", voiceTag: "S1_male" }, durationMs: 8000 },
      ];
      const records = computeSegmentRecords(entries);

      expect(records).toHaveLength(3);
      expect(records[0].startMs).toBe(0);
      expect(records[0].endMs).toBe(10000);
      expect(records[1].startMs).toBe(10000);
      expect(records[1].endMs).toBe(15000);
      expect(records[2].startMs).toBe(15000);
      expect(records[2].endMs).toBe(23000);
    });

    it("collapses repeated segments (second pass of PER_ITEM/PER_PART play rule) to the same id but distinct records", () => {
      // A repeat pass duplicates a stimulus — record both passes with the same id
      const stim = { id: "q1_stim", kind: "question_stimulus" as const, voiceTag: "S1_male" as const, questionId: "q1" };
      const entries: ConcatEntry[] = [
        { segment: stim, durationMs: 5000 },
        { segment: { id: "repeat", kind: "repeat_cue", voiceTag: "proctor" }, durationMs: 2000 },
        { segment: stim, durationMs: 5000 }, // second play
      ];
      const records = computeSegmentRecords(entries);

      expect(records).toHaveLength(3);
      expect(records[0].id).toBe("q1_stim");
      expect(records[2].id).toBe("q1_stim");
      expect(records[0].questionId).toBe("q1");
      expect(records[2].questionId).toBe("q1");
      expect(records[0].startMs).toBe(0);
      expect(records[2].startMs).toBe(7000);
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement**

  Create `apps/web/src/lib/audio/segments.ts`:

  ```ts
  import type { AudioSegment, AudioSegmentRecord } from "./types";

  export interface ConcatEntry {
    segment: AudioSegment;
    durationMs: number;
  }

  export function computeSegmentRecords(entries: ConcatEntry[]): AudioSegmentRecord[] {
    const records: AudioSegmentRecord[] = [];
    let cursor = 0;
    for (const entry of entries) {
      const { segment, durationMs } = entry;
      records.push({
        id: segment.id,
        kind: segment.kind,
        voiceTag: segment.voiceTag,
        startMs: cursor,
        endMs: cursor + durationMs,
        questionId: segment.questionId,
        partNumber: segment.partNumber,
      });
      cursor += durationMs;
    }
    return records;
  }
  ```

- [ ] **Step 4: Re-run test — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/segments.ts apps/web/src/lib/audio/segments.test.ts
  git commit -m "feat(audio): segment timestamp recorder"
  ```

### Task 23: `concat.ts` — basic ffmpeg concat + probeDuration

**Files:**
- Create: `apps/web/src/lib/audio/concat.ts`
- Create: `apps/web/src/lib/audio/concat.test.ts`

- [ ] **Step 1: Write minimal test for `probeDurationMs`**

  Create `apps/web/src/lib/audio/concat.test.ts`:

  ```ts
  import { describe, expect, it, vi } from "vitest";

  const execFileMock = vi.fn();
  vi.mock("node:child_process", () => ({
    execFile: (...args: unknown[]) => execFileMock(...args),
  }));
  vi.mock("ffmpeg-static", () => ({ default: "/path/to/ffmpeg" }));

  import { probeDurationMs } from "./concat";

  describe("probeDurationMs", () => {
    it("parses ffprobe duration output (e.g., '5.432')", async () => {
      execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
        cb(null, "5.432\n");
      });
      const ms = await probeDurationMs("/tmp/fake.mp3");
      expect(ms).toBe(5432);
    });

    it("rounds fractional ms", async () => {
      execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
        cb(null, "2.0017\n");
      });
      const ms = await probeDurationMs("/tmp/fake.mp3");
      expect(ms).toBe(2002);
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement the basic ffmpeg wrapper + `probeDurationMs` + `generateSilence` + `concatMp3s`**

  Create `apps/web/src/lib/audio/concat.ts`:

  ```ts
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { execFile } from "node:child_process";
  import ffmpegPath from "ffmpeg-static";

  function resolveFfmpeg(): string {
    const override = process.env.FFMPEG_BINARY;
    if (override && override !== "auto") return override;
    if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
    return ffmpegPath;
  }

  function resolveFfprobe(): string {
    // ffmpeg-static ships ffmpeg only; for ffprobe we call ffmpeg with -show_entries via stream
    // For simplicity here, use ffmpeg -i parse — but the cleaner path is @ffprobe-installer/ffprobe.
    // We'll use ffmpeg's `-hide_banner -i <f> -f null -` and parse stderr for duration, OR use ffprobe if installed.
    return resolveFfmpeg();
  }

  /**
   * Probe an audio file's duration in ms via ffprobe-style parsing.
   * Uses `ffmpeg -i <file> -f null -` and parses "Duration: HH:MM:SS.xx" from stderr.
   */
  export function probeDurationMs(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      execFile(
        resolveFfprobe(),
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
        (err, stdout, stderr) => {
          if (err) {
            // Fallback: parse from ffmpeg -i stderr
            const m = /Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(String(stderr ?? ""));
            if (m) {
              const hours = parseInt(m[1], 10);
              const mins = parseInt(m[2], 10);
              const secs = parseFloat(m[3]);
              resolve(Math.round((hours * 3600 + mins * 60 + secs) * 1000));
              return;
            }
            reject(err);
            return;
          }
          const secs = parseFloat(String(stdout).trim());
          if (Number.isNaN(secs)) {
            reject(new Error(`Could not parse duration from ffprobe output: ${stdout}`));
            return;
          }
          resolve(Math.round(secs * 1000));
        }
      );
    });
  }

  /**
   * Generate a silent mp3 of the requested duration and save to `outPath`.
   */
  export function generateSilenceMp3(durationSec: number, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        resolveFfmpeg(),
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `anullsrc=r=24000:cl=mono`,
          "-t",
          String(durationSec),
          "-q:a",
          "9",
          "-acodec",
          "libmp3lame",
          outPath,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  /**
   * Concatenate a list of mp3 files into a single mp3 using ffmpeg's
   * concat demuxer.
   */
  export function concatMp3s(inputPaths: string[], outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const listPath = path.join(path.dirname(outPath), `concat-${Date.now()}.txt`);
      const manifest = inputPaths
        .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
        .join("\n");
      fs.writeFileSync(listPath, manifest, "utf-8");

      execFile(
        resolveFfmpeg(),
        ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
        (err) => {
          try {
            fs.rmSync(listPath, { force: true });
          } catch {
            /* ignore cleanup */
          }
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  ```

- [ ] **Step 4: Re-run test — expect pass for `probeDurationMs`**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/concat.ts apps/web/src/lib/audio/concat.test.ts
  git commit -m "feat(audio): ffmpeg wrapper — probe/silence/concat primitives"
  ```

### Task 24: `concat.ts` — apply play-rule to produce concat list

**Files:**
- Modify: `apps/web/src/lib/audio/concat.ts`
- Modify: `apps/web/src/lib/audio/concat.test.ts`

- [ ] **Step 1: Append tests for `buildConcatPlan`**

  Append to `apps/web/src/lib/audio/concat.test.ts`:

  ```ts
  import type { ListeningPart } from "./types";
  import { buildConcatPlan } from "./concat";
  import { PAUSE_SEC } from "./constants";

  describe("buildConcatPlan (PER_ITEM)", () => {
    it("duplicates each question's stimulus with repeat_cue + pauses between", () => {
      const part: ListeningPart = {
        partNumber: 1,
        kind: "MCQ_3_PICTURE",
        instructionZh: "...",
        previewSec: 5,
        playRule: "PER_ITEM",
        audioScript: [
          { id: "q1_num", kind: "question_number", voiceTag: "proctor", text: "Question 1" },
          { id: "q1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hello.", questionId: "q1" },
          { id: "q2_num", kind: "question_number", voiceTag: "proctor", text: "Question 2" },
          { id: "q2_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Bye.", questionId: "q2" },
        ],
        questions: [],
      };
      const plan = buildConcatPlan(part, "KET");

      // Expected: previewPause, q1_num, q1_stim, BEFORE_REPEAT, repeat_cue, BEFORE_REPEAT, q1_num, q1_stim, BETWEEN_ITEMS, q2_num, q2_stim, BEFORE_REPEAT, repeat_cue, BEFORE_REPEAT, q2_num, q2_stim, BETWEEN_ITEMS
      const kinds = plan.map((e) => e.kind);
      expect(kinds).toEqual([
        "preview_pause",
        "question_number", "question_stimulus",
        "pause",
        "repeat_cue",
        "pause",
        "question_number", "question_stimulus",
        "pause",
        "question_number", "question_stimulus",
        "pause",
        "repeat_cue",
        "pause",
        "question_number", "question_stimulus",
        "pause",
      ]);
      expect(plan[0].durationMs).toBe(5000); // preview 5s for KET Part 1
      expect(plan[3].durationMs).toBe(PAUSE_SEC.BEFORE_REPEAT * 1000);
      expect(plan[8].durationMs).toBe(PAUSE_SEC.BETWEEN_ITEMS * 1000);
    });
  });

  describe("buildConcatPlan (PER_PART)", () => {
    it("plays the whole part's stimuli twice with repeat cue between", () => {
      const part: ListeningPart = {
        partNumber: 3,
        kind: "MCQ_3_TEXT",
        instructionZh: "...",
        previewSec: 20,
        playRule: "PER_PART",
        audioScript: [
          { id: "stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hi.", questionId: "q1" },
        ],
        questions: [],
      };
      const plan = buildConcatPlan(part, "KET");
      const kinds = plan.map((e) => e.kind);
      expect(kinds).toEqual([
        "preview_pause",
        "question_stimulus",
        "pause",
        "repeat_cue",
        "pause",
        "question_stimulus",
      ]);
      expect(plan[0].durationMs).toBe(20000);
    });
  });
  ```

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement `buildConcatPlan`**

  Append to `apps/web/src/lib/audio/concat.ts`:

  ```ts
  import { PAUSE_SEC } from "./constants";
  import type { AudioSegment, ListeningPart } from "./types";

  export interface PlanEntry {
    kind: AudioSegment["kind"];
    segment?: AudioSegment;
    text?: string; // for synthesized speech (rubric + part_intro + repeat_cue + part_end + transfer etc.)
    voiceTag?: AudioSegment["voiceTag"];
    durationMs?: number; // for silence entries
    id: string;
    questionId?: string;
    partNumber?: number;
  }

  /**
   * Build a full concat plan for a single part, applying its play_rule.
   *
   * The agent emits a SINGLE logical pass in `audioScript`; this function
   * applies PER_ITEM or PER_PART duplication and injects Cambridge-spec pauses.
   */
  export function buildConcatPlan(part: ListeningPart, _examType: "KET" | "PET"): PlanEntry[] {
    const entries: PlanEntry[] = [];
    const previewMs = part.previewSec * 1000;

    entries.push({
      id: `part${part.partNumber}_preview_pause`,
      kind: "preview_pause",
      durationMs: previewMs,
    });

    if (part.playRule === "PER_ITEM") {
      // Group audioScript segments by questionId; each group plays twice with repeat_cue
      const groups = new Map<string, AudioSegment[]>();
      for (const seg of part.audioScript) {
        const key = seg.questionId ?? `__ungrouped__`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(seg);
      }
      for (const [qid, segs] of groups) {
        const push = () => {
          for (const seg of segs) {
            entries.push({
              id: seg.id,
              kind: seg.kind,
              segment: seg,
              text: seg.text,
              voiceTag: seg.voiceTag,
              questionId: seg.questionId,
              partNumber: part.partNumber,
            });
          }
        };
        push();
        entries.push({
          id: `${qid}_pre_repeat`,
          kind: "pause",
          durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
        });
        entries.push({
          id: `${qid}_repeat_cue`,
          kind: "repeat_cue",
          text: "Now listen again.",
          voiceTag: "proctor",
          partNumber: part.partNumber,
        });
        entries.push({
          id: `${qid}_post_cue`,
          kind: "pause",
          durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
        });
        push();
        entries.push({
          id: `${qid}_between_items`,
          kind: "pause",
          durationMs: PAUSE_SEC.BETWEEN_ITEMS * 1000,
        });
      }
    } else {
      // PER_PART: emit all segments, pause, repeat_cue, pause, emit all segments again
      const push = () => {
        for (const seg of part.audioScript) {
          entries.push({
            id: seg.id,
            kind: seg.kind,
            segment: seg,
            text: seg.text,
            voiceTag: seg.voiceTag,
            questionId: seg.questionId,
            partNumber: part.partNumber,
          });
        }
      };
      push();
      entries.push({
        id: `part${part.partNumber}_pre_repeat`,
        kind: "pause",
        durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
      });
      entries.push({
        id: `part${part.partNumber}_repeat_cue`,
        kind: "repeat_cue",
        text: "Now listen again.",
        voiceTag: "proctor",
        partNumber: part.partNumber,
      });
      entries.push({
        id: `part${part.partNumber}_post_cue`,
        kind: "pause",
        durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
      });
      push();
    }

    return entries;
  }
  ```

- [ ] **Step 4: Re-run tests — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/concat.ts apps/web/src/lib/audio/concat.test.ts
  git commit -m "feat(audio): buildConcatPlan applies PER_ITEM/PER_PART play-rule"
  ```

### Task 25: Inter-part transitions + transfer block assembly

**Files:**
- Modify: `apps/web/src/lib/audio/concat.ts`
- Modify: `apps/web/src/lib/audio/concat.test.ts`

- [ ] **Step 1: Append `buildFullPlan` test**

  Append to `apps/web/src/lib/audio/concat.test.ts`:

  ```ts
  import { buildFullPlan } from "./concat";
  import type { ListeningTestPayloadV2 } from "./types";

  describe("buildFullPlan", () => {
    it("wraps parts with opening rubric, part intros, inter-part pauses, and transfer block", () => {
      const payload: ListeningTestPayloadV2 = {
        version: 2,
        examType: "KET",
        scope: "FULL",
        cefrLevel: "A2",
        generatedBy: "test",
        parts: [
          {
            partNumber: 1,
            kind: "MCQ_3_PICTURE",
            instructionZh: "...",
            previewSec: 5,
            playRule: "PER_PART",
            audioScript: [
              { id: "p1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hi.", questionId: "q1" },
            ],
            questions: [],
          },
          {
            partNumber: 2,
            kind: "GAP_FILL_OPEN",
            instructionZh: "...",
            previewSec: 10,
            playRule: "PER_PART",
            audioScript: [
              { id: "p2_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Lecture.", questionId: "q6" },
            ],
            questions: [],
          },
        ],
      };

      const plan = buildFullPlan(payload);
      const kinds = plan.map((e) => e.kind);

      // Head: rubric, pause, part_intro
      expect(kinds[0]).toBe("rubric");
      expect(kinds[1]).toBe("pause");
      expect(kinds[2]).toBe("part_intro");

      // Contains part_end + inter-part pause + next part_intro
      const partEnds = kinds.filter((k) => k === "part_end");
      expect(partEnds.length).toBe(2); // 2 parts

      // Tail: transfer_start, long pause, transfer_one_min, pause, closing
      expect(kinds.slice(-5)).toEqual([
        "transfer_start",
        "pause",
        "transfer_one_min",
        "pause",
        "closing",
      ]);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail (buildFullPlan undefined)**

- [ ] **Step 3: Implement `buildFullPlan`**

  Append to `apps/web/src/lib/audio/concat.ts`:

  ```ts
  import { RUBRIC } from "./rubric";
  import type { ListeningTestPayloadV2 } from "./types";

  export function buildFullPlan(payload: ListeningTestPayloadV2): PlanEntry[] {
    const entries: PlanEntry[] = [];
    const rubric = payload.examType === "KET" ? RUBRIC.ket : RUBRIC.pet;

    entries.push({
      id: "opening",
      kind: "rubric",
      text: rubric.opening,
      voiceTag: "proctor",
    });
    entries.push({
      id: "post_opening",
      kind: "pause",
      durationMs: PAUSE_SEC.PRE_PART_INSTRUCTION * 1000,
    });

    for (let i = 0; i < payload.parts.length; i++) {
      const part = payload.parts[i];
      // Part intro (except for final: we still say "Now look at the instructions for Part N")
      entries.push({
        id: `part${part.partNumber}_intro`,
        kind: "part_intro",
        text: rubric.partIntro(part.partNumber),
        voiceTag: "proctor",
        partNumber: part.partNumber,
      });
      // Body
      const partPlan = buildConcatPlan(part, payload.examType);
      entries.push(...partPlan);
      // Part end
      entries.push({
        id: `part${part.partNumber}_end`,
        kind: "part_end",
        text: rubric.partEnd(part.partNumber),
        voiceTag: "proctor",
        partNumber: part.partNumber,
      });
      // Inter-part pause (except after the last part — then we do transfer block)
      if (i < payload.parts.length - 1) {
        entries.push({
          id: `inter_part_${i}`,
          kind: "pause",
          durationMs: PAUSE_SEC.INTER_PART * 1000,
        });
      }
    }

    // Transfer block
    entries.push({
      id: "transfer_start",
      kind: "transfer_start",
      text: rubric.transferStart,
      voiceTag: "proctor",
    });
    entries.push({
      id: "transfer_preamble_pause",
      kind: "pause",
      durationMs: PAUSE_SEC.TRANSFER_BLOCK_PREAMBLE * 1000,
    });
    entries.push({
      id: "transfer_one_min",
      kind: "transfer_one_min",
      text: rubric.oneMinuteWarn,
      voiceTag: "proctor",
    });
    entries.push({
      id: "transfer_final_pause",
      kind: "pause",
      durationMs: PAUSE_SEC.TRANSFER_BLOCK_FINAL * 1000,
    });
    entries.push({
      id: "closing",
      kind: "closing",
      text: rubric.closing,
      voiceTag: "proctor",
    });

    return entries;
  }
  ```

- [ ] **Step 4: Re-run — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/concat.ts apps/web/src/lib/audio/concat.test.ts
  git commit -m "feat(audio): buildFullPlan — rubric + parts + transfer block assembly"
  ```

### Task 26: `queue.ts` — concurrency semaphore

**Files:**
- Create: `apps/web/src/lib/audio/queue.ts`
- Create: `apps/web/src/lib/audio/queue.test.ts`

- [ ] **Step 1: Write test**

  Create `apps/web/src/lib/audio/queue.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { createSemaphore, QueueFullError } from "./queue";

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  describe("createSemaphore", () => {
    it("allows up to `maxConcurrent` tasks in parallel", async () => {
      const sem = createSemaphore({ maxConcurrent: 2, maxWaiting: 5 });
      let active = 0;
      let peak = 0;

      const task = async () => {
        await sem.acquire();
        try {
          active++;
          peak = Math.max(peak, active);
          await wait(20);
        } finally {
          active--;
          sem.release();
        }
      };

      await Promise.all([task(), task(), task(), task()]);
      expect(peak).toBe(2);
    });

    it("rejects with QueueFullError when waiting queue exceeded", async () => {
      const sem = createSemaphore({ maxConcurrent: 1, maxWaiting: 1 });

      // Take the one slot
      await sem.acquire();

      // This one queues (OK — we have maxWaiting=1)
      const p1 = sem.acquire();
      // This one must reject immediately
      await expect(sem.acquire()).rejects.toBeInstanceOf(QueueFullError);

      sem.release();
      await p1;
      sem.release();
    });
  });
  ```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement**

  Create `apps/web/src/lib/audio/queue.ts`:

  ```ts
  export class QueueFullError extends Error {
    constructor() {
      super("Listening generation queue is full");
      this.name = "QueueFullError";
    }
  }

  export interface Semaphore {
    acquire(): Promise<void>;
    release(): void;
  }

  export function createSemaphore(opts: {
    maxConcurrent: number;
    maxWaiting: number;
  }): Semaphore {
    let active = 0;
    const waiting: Array<() => void> = [];

    return {
      async acquire() {
        if (active < opts.maxConcurrent) {
          active++;
          return;
        }
        if (waiting.length >= opts.maxWaiting) {
          throw new QueueFullError();
        }
        await new Promise<void>((resolve) => waiting.push(resolve));
        active++;
      },
      release() {
        active = Math.max(0, active - 1);
        const next = waiting.shift();
        if (next) next();
      },
    };
  }

  /**
   * Global audio-generation semaphore. Lazy-initialized from env.
   */
  let _globalSem: Semaphore | null = null;
  export function audioSemaphore(): Semaphore {
    if (!_globalSem) {
      _globalSem = createSemaphore({
        maxConcurrent: Number(process.env.LISTENING_MAX_CONCURRENT ?? 3),
        maxWaiting: Number(process.env.LISTENING_QUEUE_MAX ?? 5),
      });
    }
    return _globalSem;
  }
  ```

- [ ] **Step 4: Re-run — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/queue.ts apps/web/src/lib/audio/queue.test.ts
  git commit -m "feat(audio): concurrency semaphore (max 3 concurrent, max 5 waiting)"
  ```

### Task 27: `generate.ts` — orchestrator skeleton

**Files:**
- Create: `apps/web/src/lib/audio/generate.ts`
- Create: `apps/web/src/lib/audio/generate.test.ts`

- [ ] **Step 1: Write an end-to-end test with all deps mocked**

  Create `apps/web/src/lib/audio/generate.test.ts`:

  ```ts
  import { describe, expect, it, vi, beforeEach } from "vitest";

  vi.mock("./edge-tts-client", () => ({
    synthesizeSegmentWithRetry: vi.fn().mockResolvedValue(undefined),
  }));
  vi.mock("./concat", async (orig) => {
    const actual = await orig<typeof import("./concat")>();
    return {
      ...actual,
      generateSilenceMp3: vi.fn().mockResolvedValue(undefined),
      concatMp3s: vi.fn().mockResolvedValue(undefined),
      probeDurationMs: vi.fn().mockResolvedValue(1000),
    };
  });
  vi.mock("./r2-client", () => ({
    uploadAudioToR2: vi.fn().mockResolvedValue("listening/t1/audio.mp3"),
  }));

  import { generateListeningAudio } from "./generate";
  import type { ListeningTestPayloadV2 } from "./types";

  const trivialKetPart1Payload: ListeningTestPayloadV2 = {
    version: 2,
    examType: "KET",
    scope: "PART",
    part: 1,
    cefrLevel: "A2",
    generatedBy: "test",
    parts: [
      {
        partNumber: 1,
        kind: "MCQ_3_PICTURE",
        instructionZh: "...",
        previewSec: 5,
        playRule: "PER_ITEM",
        audioScript: [
          { id: "q1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hello.", questionId: "q1" },
        ],
        questions: [],
      },
    ],
  };

  describe("generateListeningAudio", () => {
    beforeEach(() => {
      process.env.R2_BUCKET = "test";
      process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
      process.env.R2_ACCESS_KEY_ID = "k";
      process.env.R2_SECRET_ACCESS_KEY = "s";
    });

    it("returns r2Key + non-empty segments on success", async () => {
      const result = await generateListeningAudio({
        testId: "t1",
        payload: trivialKetPart1Payload,
        ratePercent: -5,
      });
      expect(result.r2Key).toBe("listening/t1/audio.mp3");
      expect(result.segments.length).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement the orchestrator**

  Create `apps/web/src/lib/audio/generate.ts`:

  ```ts
  import * as fs from "node:fs";
  import * as os from "node:os";
  import * as path from "node:path";

  import {
    buildFullPlan,
    buildConcatPlan,
    concatMp3s,
    generateSilenceMp3,
    probeDurationMs,
    type PlanEntry,
  } from "./concat";
  import { synthesizeSegmentWithRetry } from "./edge-tts-client";
  import { uploadAudioToR2 } from "./r2-client";
  import { computeSegmentRecords, type ConcatEntry } from "./segments";
  import type {
    AudioSegment,
    AudioSegmentRecord,
    ListeningTestPayloadV2,
  } from "./types";

  export interface GenerateArgs {
    testId: string;
    payload: ListeningTestPayloadV2;
    ratePercent: number; // -5 for KET, 0 for PET
  }

  export interface GenerateResult {
    r2Key: string;
    segments: AudioSegmentRecord[];
  }

  export async function generateListeningAudio(args: GenerateArgs): Promise<GenerateResult> {
    const { testId, payload, ratePercent } = args;
    const workDir = path.join(os.tmpdir(), `ket-pet-audio-${testId}-${Date.now()}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      // 1. Build full plan (scope-aware: FULL uses buildFullPlan, PART uses buildConcatPlan)
      let plan: PlanEntry[];
      if (payload.scope === "FULL") {
        plan = buildFullPlan(payload);
      } else {
        // PART scope — just the part's concat plan (no opening rubric or transfer block)
        plan = buildConcatPlan(payload.parts[0], payload.examType);
      }

      // 2. For each entry, produce a file on disk (synthesized TTS or silence)
      const filePaths: string[] = [];
      const concatEntries: ConcatEntry[] = [];

      for (let i = 0; i < plan.length; i++) {
        const entry = plan[i];
        const filePath = path.join(workDir, `seg-${String(i).padStart(4, "0")}.mp3`);

        if (entry.kind === "pause" || entry.kind === "preview_pause") {
          const durSec = Math.max(0.1, (entry.durationMs ?? 0) / 1000);
          await generateSilenceMp3(durSec, filePath);
        } else {
          if (!entry.text || !entry.voiceTag) {
            throw new Error(
              `Plan entry ${entry.id} of kind ${entry.kind} missing text or voiceTag`
            );
          }
          await synthesizeSegmentWithRetry({
            text: entry.text,
            voiceTag: entry.voiceTag,
            ratePercent,
            outPath: filePath,
          });
        }

        filePaths.push(filePath);

        // Record actual duration for timestamping
        const dur = await probeDurationMs(filePath);
        const seg: AudioSegment = {
          id: entry.id,
          kind: entry.kind,
          voiceTag: entry.voiceTag ?? null,
          questionId: entry.questionId,
          partNumber: entry.partNumber,
        };
        concatEntries.push({ segment: seg, durationMs: dur });
      }

      // 3. Concatenate all files into a single mp3
      const outputMp3 = path.join(workDir, "listening.mp3");
      await concatMp3s(filePaths, outputMp3);

      // 4. Upload to R2
      const r2Key = await uploadAudioToR2({ testId, localPath: outputMp3 });

      // 5. Compute timestamp records
      const segments = computeSegmentRecords(concatEntries);

      return { r2Key, segments };
    } finally {
      // Cleanup temp dir (ignore errors)
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  ```

- [ ] **Step 4: Re-run — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/audio/generate.ts apps/web/src/lib/audio/generate.test.ts
  git commit -m "feat(audio): orchestrator — plan → synthesize → concat → upload"
  ```

### Task 28: Add Python-agent call to orchestrator + error paths

**Files:**
- Modify: `apps/web/src/lib/audio/generate.ts`

- [ ] **Step 1: Add `generateTestPayload` helper that calls Python**

  Prepend imports and add helper to `apps/web/src/lib/audio/generate.ts`:

  ```ts
  // ... existing imports ...

  const AI_SERVICE_URL =
    process.env.INTERNAL_AI_URL ?? process.env.AI_SERVICE_URL ?? "http://localhost:8001";

  export interface GenerateTestPayloadArgs {
    examType: "KET" | "PET";
    scope: "FULL" | "PART";
    part?: number;
    mode: "PRACTICE" | "MOCK";
  }

  export async function fetchListeningPayload(
    args: GenerateTestPayloadArgs
  ): Promise<ListeningTestPayloadV2> {
    const res = await fetch(`${AI_SERVICE_URL}/listening/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_type: args.examType,
        scope: args.scope,
        part: args.part,
        mode: args.mode,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Python listening/generate failed: HTTP ${res.status} — ${body}`
      );
    }
    // The Python response uses snake_case; the Node types are camelCase.
    // A minimal transform layer converts them.
    const raw = (await res.json()) as Record<string, unknown>;
    return snakeToCamelListening(raw);
  }

  function snakeToCamelListening(raw: Record<string, unknown>): ListeningTestPayloadV2 {
    // Minimal ad-hoc converter for the known keys. We do NOT use a
    // generic recursive converter because the shapes are small and
    // explicit conversion keeps the contract visible.
    const parts = (raw.parts as Array<Record<string, unknown>>).map((p) => ({
      partNumber: p.part_number as number,
      kind: p.kind as ListeningTestPayloadV2["parts"][number]["kind"],
      instructionZh: p.instruction_zh as string,
      previewSec: p.preview_sec as number,
      playRule: p.play_rule as ListeningTestPayloadV2["parts"][number]["playRule"],
      audioScript: (p.audio_script as Array<Record<string, unknown>>).map((s) => ({
        id: s.id as string,
        kind: s.kind as AudioSegment["kind"],
        voiceTag: (s.voice_tag as AudioSegment["voiceTag"]) ?? null,
        text: (s.text as string | undefined) ?? undefined,
        durationMs: (s.duration_ms as number | undefined) ?? undefined,
        partNumber: (s.part_number as number | undefined) ?? undefined,
        questionId: (s.question_id as string | undefined) ?? undefined,
      })),
      questions: (p.questions as Array<Record<string, unknown>>).map((q) => ({
        id: q.id as string,
        prompt: q.prompt as string,
        type: q.type as ListeningTestPayloadV2["parts"][number]["questions"][number]["type"],
        options: (q.options as Array<Record<string, unknown>> | undefined)?.map((o) => ({
          id: o.id as string,
          text: o.text as string | undefined,
          imageDescription: o.image_description as string | undefined,
        })),
        answer: q.answer as string,
        explanationZh: q.explanation_zh as string,
        examPointId: q.exam_point_id as string,
        difficultyPointId: q.difficulty_point_id as string | undefined,
      })),
    }));

    return {
      version: 2,
      examType: raw.exam_type as "KET" | "PET",
      scope: raw.scope as "FULL" | "PART",
      part: raw.part as number | undefined,
      cefrLevel: raw.cefr_level as "A2" | "B1",
      generatedBy: (raw.generated_by as string) ?? "deepseek-chat",
      parts,
    };
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter web exec tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/lib/audio/generate.ts
  git commit -m "feat(audio): fetchListeningPayload calls Python /listening/generate"
  ```

### Task 29: Dev-server integration smoke test

- [ ] **Step 1: User-verify full Node-side synthesis end-to-end**

  Ask user to:
  1. Ensure Python dev server is running (Task 14 Step 3).
  2. Ensure Postgres is running (`docker compose up -d`).
  3. Start Next.js dev server (`pnpm --filter web dev`).
  4. Open a Node REPL or write a temporary script that calls `fetchListeningPayload({examType:"KET", scope:"PART", part:1, mode:"PRACTICE"})` then `generateListeningAudio({testId:"smoke-test", payload, ratePercent:-5})`, and verify:
     - It returns `{r2Key: "listening/smoke-test/audio.mp3", segments: [...]}` within ~60 seconds.
     - The mp3 actually exists in R2 (check via Cloudflare dashboard or `aws s3 ls s3://<bucket>/listening/smoke-test/ --endpoint-url <R2_ENDPOINT>`).
     - The audio plays correctly — open the R2 object URL or download it and play locally.
  5. If anything fails: STOP, report the failure, do not proceed.

- [ ] **Step 2: Tag checkpoint**

  ```bash
  git tag phase2-audio-pipeline-complete
  ```

---

## Phase 3 · Schema wiring + API routes (Tasks 30-36)

### Task 30: Extend `/api/tests/generate` for LISTENING kind

**Files:**
- Modify: `apps/web/src/app/api/tests/generate/route.ts`

- [ ] **Step 1: Inspect existing route handler**

  Read the existing Phase 1 file to understand the current structure:
  ```bash
  head -100 apps/web/src/app/api/tests/generate/route.ts
  ```
  Note the request-body schema (zod), auth check, DB write pattern, and how it branches on `kind`.

- [ ] **Step 2: Add LISTENING branch**

  In `apps/web/src/app/api/tests/generate/route.ts`:

  1. Extend the Zod request body schema to accept `kind: "LISTENING"` with an optional `part?: number` and required `scope: "FULL" | "PART"`.
  2. After creating the `Test` row (with `audioStatus: "GENERATING"`), fire a background generation job via `queueMicrotask` or an explicit `setImmediate` wrapper that:
     a. Calls `audioSemaphore().acquire()` (throw `QueueFullError` → return 503 before creating the Test row)
     b. Calls `fetchListeningPayload(...)` + `generateListeningAudio(...)`
     c. On success: updates the Test with `audioStatus: "READY"`, `audioR2Key`, `audioSegments`, `audioGenCompletedAt`, and writes the payload JSON to `Test.payload`.
     d. On failure: updates the Test with `audioStatus: "FAILED"` and `audioErrorMessage`.
     e. Finally calls `audioSemaphore().release()` and records a `GenerationEvent` row with `kind: "LISTENING"`.
  3. Return the Test id immediately (don't await the background job).

  Insert code around the existing Phase-1 branches. Example shape (adapt to match existing file conventions):

  ```ts
  // Inside the POST handler, after auth + rate-limit checks:

  if (parsed.kind === "LISTENING") {
    // Queue acquisition (pre-row so we don't leak Test rows on QueueFullError)
    try {
      await audioSemaphore().acquire();
    } catch (err) {
      if (err instanceof QueueFullError) {
        return NextResponse.json(
          { error: "queue_full", message: "系统繁忙，请稍后再试" },
          { status: 503 }
        );
      }
      throw err;
    }

    const test = await db.test.create({
      data: {
        userId: session.user.id,
        examType: parsed.examType,
        kind: "LISTENING",
        mode: parsed.mode,
        part: parsed.scope === "PART" ? parsed.part : null,
        difficulty: parsed.examType === "KET" ? "A2" : "B1",
        payload: {}, // populated when generation completes
        generatedBy: "deepseek-chat",
        audioStatus: "GENERATING",
        audioGenStartedAt: new Date(),
      },
    });

    setImmediate(async () => {
      try {
        const payload = await fetchListeningPayload({
          examType: parsed.examType,
          scope: parsed.scope,
          part: parsed.part,
          mode: parsed.mode,
        });
        const rate = parsed.examType === "KET" ? -5 : 0;
        const { r2Key, segments } = await generateListeningAudio({
          testId: test.id,
          payload,
          ratePercent: rate,
        });
        await db.test.update({
          where: { id: test.id },
          data: {
            payload: payload as object,
            audioStatus: "READY",
            audioR2Key: r2Key,
            audioSegments: segments as object,
            audioGenCompletedAt: new Date(),
          },
        });
      } catch (err) {
        await db.test.update({
          where: { id: test.id },
          data: {
            audioStatus: "FAILED",
            audioErrorMessage: err instanceof Error ? err.message : String(err),
            audioGenCompletedAt: new Date(),
          },
        });
      } finally {
        audioSemaphore().release();
        await db.generationEvent.create({
          data: {
            userId: session.user.id,
            kind: "LISTENING",
            createdAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({ testId: test.id, audioStatus: "GENERATING" });
  }

  // ... existing Phase 1 branches for READING / WRITING below ...
  ```

- [ ] **Step 3: Type-check + test existing Phase 1 endpoints still work**

  ```bash
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web exec vitest run
  ```
  Expected: clean.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/app/api/tests/generate/route.ts
  git commit -m "feat(api): extend /api/tests/generate for LISTENING kind"
  ```

### Task 31: Extend `/api/tests/[testId]/status` for audio state

**Files:**
- Modify: `apps/web/src/app/api/tests/[testId]/status/route.ts`

- [ ] **Step 1: Inspect existing handler**

  ```bash
  cat apps/web/src/app/api/tests/[testId]/status/route.ts
  ```

- [ ] **Step 2: Extend response shape**

  Modify the GET handler to include `audioStatus`, `audioR2Key`, `audioGenStartedAt`, and `audioErrorMessage` in the response JSON. Also compute `elapsedMs` = `now - audioGenStartedAt` for the progress bar.

  Example addition to the response shape:
  ```ts
  return NextResponse.json({
    // existing fields...
    audioStatus: test.audioStatus,
    audioReady: test.audioStatus === "READY" && !!test.audioR2Key,
    audioError: test.audioErrorMessage,
    audioElapsedMs: test.audioGenStartedAt
      ? Date.now() - test.audioGenStartedAt.getTime()
      : null,
  });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/api/tests/[testId]/status/route.ts
  git commit -m "feat(api): /status includes audioStatus + audioReady + audioElapsedMs"
  ```

### Task 32: `/api/listening/[attemptId]/audio` stream-proxy

**Files:**
- Create: `apps/web/src/app/api/listening/[attemptId]/audio/route.ts`

- [ ] **Step 1: Write the stream-proxy handler**

  Create the directory + file:

  ```ts
  // apps/web/src/app/api/listening/[attemptId]/audio/route.ts

  import { NextRequest, NextResponse } from "next/server";

  import { auth } from "@/lib/auth";         // Phase 1 auth helper
  import { db } from "@/lib/db";             // Phase 1 Prisma client
  import { getAudioStream } from "@/lib/audio/r2-client";

  export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ attemptId: string }> }
  ) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { attemptId } = await ctx.params;

    const attempt = await db.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: true },
    });

    // Ownership check — student owns the attempt, OR teacher can view
    // (reuse the Phase 1 `canViewAttempt` helper). For brevity here we
    // inline the student-only check; refactor to `canViewAttempt` if
    // it exists in your codebase.
    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!attempt.test.audioR2Key) {
      return NextResponse.json(
        { error: "audio_not_ready", message: "音频加载失败，请重新生成" },
        { status: 404 }
      );
    }

    const range = req.headers.get("range") ?? undefined;

    let result;
    try {
      result = await getAudioStream({ r2Key: attempt.test.audioR2Key, range });
    } catch (err) {
      // One retry on R2 5xx
      try {
        await new Promise((r) => setTimeout(r, 500));
        result = await getAudioStream({ r2Key: attempt.test.audioR2Key, range });
      } catch (err2) {
        return NextResponse.json({ error: "r2_error" }, { status: 502 });
      }
    }

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    if (result.contentLength !== undefined) {
      headers.set("Content-Length", String(result.contentLength));
    }
    if (result.contentRange) headers.set("Content-Range", result.contentRange);
    if (result.acceptRanges) headers.set("Accept-Ranges", result.acceptRanges);
    else headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600");

    const status = range && result.contentRange ? 206 : 200;
    return new NextResponse(result.stream as unknown as BodyInit, { status, headers });
  }
  ```

- [ ] **Step 2: Test via curl**

  After starting Next.js + having a real Test with audio in R2 (from Task 29):
  ```bash
  curl -v -H "Cookie: <your-session-cookie>" http://localhost:3000/api/listening/<attemptId>/audio -o /tmp/test.mp3
  curl -v -H "Cookie: ..." -H "Range: bytes=0-1023" http://localhost:3000/api/listening/<attemptId>/audio -o /tmp/range.mp3
  ```
  Expected: first request returns 200 with full file; range request returns 206 with partial content.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/api/listening/[attemptId]/audio/route.ts
  git commit -m "feat(api): stream-proxy for listening audio with range-request passthrough"
  ```

## Phase 4 · Grading + submit (Tasks 33-35)

### Task 33: `lib/grading/listening.ts` — deterministic grader

**Files:**
- Create: `apps/web/src/lib/grading/listening.ts`
- Create: `apps/web/src/lib/grading/listening.test.ts`

- [ ] **Step 1: Write test**

  Create `apps/web/src/lib/grading/listening.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { gradeListening } from "./listening";
  import type { ListeningPart } from "@/lib/audio/types";

  const mcqPart1: ListeningPart = {
    partNumber: 1,
    kind: "MCQ_3_PICTURE",
    instructionZh: "...",
    previewSec: 5,
    playRule: "PER_ITEM",
    audioScript: [],
    questions: [
      {
        id: "q1", prompt: "Q1", type: "MCQ_3_PICTURE",
        options: [{ id: "A" }, { id: "B" }, { id: "C" }],
        answer: "A", explanationZh: "...", examPointId: "KET.L.Part1.gist",
      },
      {
        id: "q2", prompt: "Q2", type: "MCQ_3_PICTURE",
        options: [{ id: "A" }, { id: "B" }, { id: "C" }],
        answer: "B", explanationZh: "...", examPointId: "KET.L.Part1.gist",
      },
    ],
  };

  const gapFill: ListeningPart = {
    partNumber: 2,
    kind: "GAP_FILL_OPEN",
    instructionZh: "...",
    previewSec: 10,
    playRule: "PER_PART",
    audioScript: [],
    questions: [
      {
        id: "g1", prompt: "Name of secretary:", type: "GAP_FILL_OPEN",
        answer: "fairford", explanationZh: "...", examPointId: "KET.L.Part2.detail",
      },
      {
        id: "g2", prompt: "Day of return:", type: "GAP_FILL_OPEN",
        answer: "friday", explanationZh: "...", examPointId: "KET.L.Part2.detail",
      },
    ],
  };

  describe("gradeListening", () => {
    it("scores MCQ on exact option-id match", () => {
      const result = gradeListening([mcqPart1], { q1: "A", q2: "C" });
      expect(result.rawScore).toBe(1);
      expect(result.totalPossible).toBe(2);
      expect(result.perQuestion.q1.correct).toBe(true);
      expect(result.perQuestion.q2.correct).toBe(false);
    });

    it("gap-fill is case-insensitive after trim", () => {
      const result = gradeListening([gapFill], { g1: "  Fairford  ", g2: "FRIDAY" });
      expect(result.rawScore).toBe(2);
      expect(result.perQuestion.g1.correct).toBe(true);
      expect(result.perQuestion.g2.correct).toBe(true);
    });

    it("gap-fill rejects misspellings (divergence from Cambridge's lenient key)", () => {
      const result = gradeListening([gapFill], { g1: "fairfrod", g2: "fridy" });
      expect(result.rawScore).toBe(0);
    });

    it("missing answers score 0", () => {
      const result = gradeListening([mcqPart1], {});
      expect(result.rawScore).toBe(0);
    });

    it("computes weakPoints aggregating examPointId + difficultyPointId from wrong answers", () => {
      const result = gradeListening([mcqPart1], { q1: "B", q2: "A" }); // both wrong
      expect(result.weakPoints.examPoints).toEqual(["KET.L.Part1.gist"]);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement**

  Create `apps/web/src/lib/grading/listening.ts`:

  ```ts
  import type { ListeningPart, ListeningQuestion } from "@/lib/audio/types";

  export interface QuestionResult {
    questionId: string;
    userAnswer: string | null;
    correctAnswer: string;
    correct: boolean;
    examPointId: string;
    difficultyPointId?: string;
  }

  export interface WeakPoints {
    examPoints: string[];
    difficultyPoints: string[];
  }

  export interface ListeningGradeResult {
    rawScore: number;
    totalPossible: number;
    perQuestion: Record<string, QuestionResult>;
    weakPoints: WeakPoints;
  }

  function normalize(s: string): string {
    return s.trim().toLowerCase();
  }

  function isCorrect(q: ListeningQuestion, userAnswer: string | undefined): boolean {
    if (userAnswer === undefined || userAnswer === null) return false;
    if (q.type === "GAP_FILL_OPEN") {
      return normalize(userAnswer) === normalize(q.answer);
    }
    // MCQ variants + matching: exact option-id match
    return userAnswer === q.answer;
  }

  function topN<T>(arr: T[], n: number): T[] {
    const counts = new Map<T, number>();
    for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  export function gradeListening(
    parts: ListeningPart[],
    answers: Record<string, string>
  ): ListeningGradeResult {
    const perQuestion: Record<string, QuestionResult> = {};
    const wrongExamPoints: string[] = [];
    const wrongDifficultyPoints: string[] = [];
    let raw = 0;
    let total = 0;

    for (const part of parts) {
      for (const q of part.questions) {
        total += 1;
        const user = answers[q.id];
        const correct = isCorrect(q, user);
        if (correct) raw += 1;
        else {
          wrongExamPoints.push(q.examPointId);
          if (q.difficultyPointId) wrongDifficultyPoints.push(q.difficultyPointId);
        }
        perQuestion[q.id] = {
          questionId: q.id,
          userAnswer: user ?? null,
          correctAnswer: q.answer,
          correct,
          examPointId: q.examPointId,
          difficultyPointId: q.difficultyPointId,
        };
      }
    }

    return {
      rawScore: raw,
      totalPossible: total,
      perQuestion,
      weakPoints: {
        examPoints: topN(wrongExamPoints, 3),
        difficultyPoints: topN(wrongDifficultyPoints, 3),
      },
    };
  }
  ```

- [ ] **Step 4: Re-run — expect pass**

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/lib/grading/listening.ts apps/web/src/lib/grading/listening.test.ts
  git commit -m "feat(grading): deterministic listening grader (MCQ + gap-fill + matching)"
  ```

### Task 34: Extend submit route for LISTENING kind

**Files:**
- Modify: `apps/web/src/app/api/tests/[attemptId]/submit/route.ts`

- [ ] **Step 1: Inspect existing submit handler**

  ```bash
  cat apps/web/src/app/api/tests/[attemptId]/submit/route.ts
  ```
  Note how Phase 1 grades reading + writing (it probably branches on `test.kind`), how it creates MistakeNote rows, and how it returns results.

- [ ] **Step 2: Add LISTENING branch**

  Where the existing `if (test.kind === "READING") { ... }` block lives, add a parallel LISTENING branch:

  ```ts
  import { gradeListening } from "@/lib/grading/listening";
  import type { ListeningTestPayloadV2 } from "@/lib/audio/types";

  // ... inside POST handler, after loading test + attempt + verifying auth ...

  if (test.kind === "LISTENING") {
    // Server-side time-limit enforcement
    const timeLimitMs = Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800) * 1000;
    const graceMs = Number(process.env.LISTENING_GRACE_PERIOD_MS ?? 60000);
    const elapsedMs = Date.now() - attempt.startedAt.getTime();
    const forceSubmit = body.forceSubmit === true;

    if (!forceSubmit && elapsedMs > timeLimitMs + graceMs) {
      return NextResponse.json(
        { error: "time_exceeded", message: "考试时间已结束，答案已自动提交" },
        { status: 400 }
      );
    }

    const payload = test.payload as ListeningTestPayloadV2;
    const result = gradeListening(payload.parts, body.answers ?? {});

    await db.$transaction(async (tx) => {
      await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "GRADED",
          submittedAt: new Date(),
          answers: body.answers,
          rawScore: result.rawScore,
          totalPossible: result.totalPossible,
          weakPoints: result.weakPoints as object,
        },
      });

      // Create MistakeNote rows for wrong answers
      const wrongs = Object.values(result.perQuestion).filter((r) => !r.correct);
      if (wrongs.length) {
        await tx.mistakeNote.createMany({
          data: wrongs.map((r) => ({
            userId: attempt.userId,
            attemptId: attempt.id,
            questionId: r.questionId,
            userAnswer: r.userAnswer ?? "",
            correctAnswer: r.correctAnswer,
            explanation: payload.parts
              .flatMap((p) => p.questions)
              .find((q) => q.id === r.questionId)?.explanationZh ?? null,
            examPoint: r.examPointId,
            difficultyPoint: r.difficultyPointId ?? null,
            status: "NEW",
          })),
        });
      }
    });

    return NextResponse.json({ attemptId: attempt.id, result });
  }

  // ... existing Phase 1 branches continue below ...
  ```

- [ ] **Step 3: Type-check + run existing Phase 1 tests to confirm no regression**

  ```bash
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web exec vitest run
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/app/api/tests/[attemptId]/submit/route.ts
  git commit -m "feat(api): LISTENING submit — grade, write MistakeNotes, server-time-limit"
  ```

### Task 35: Rate limiting extension

**Files:**
- Modify: the Phase 1 rate-limit helper (locate with grep) — typically `apps/web/src/lib/rate-limit.ts` or similar

- [ ] **Step 1: Locate the rate-limit module**

  ```bash
  grep -rn "GenerationEvent" apps/web/src/lib | head
  ```
  Find where the rate-limit check function reads `GenerationEvent` and enforces N/hour.

- [ ] **Step 2: Add LISTENING to the kind whitelist + enforce the per-hour cap**

  In the rate-limit helper, add a case for `LISTENING` with the per-hour cap from env. Pattern (adapt to match existing code):

  ```ts
  const LISTENING_CAP = Number(process.env.LISTENING_RATE_LIMIT_PER_HOUR ?? 10);

  export async function enforceListeningRateLimit(userId: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await db.generationEvent.count({
      where: { userId, kind: "LISTENING", createdAt: { gte: oneHourAgo } },
    });
    if (count >= LISTENING_CAP) {
      throw new RateLimitExceededError(
        "每小时最多生成 10 次听力测试，请稍后再试"
      );
    }
  }
  ```

  Then call `enforceListeningRateLimit(session.user.id)` at the top of the LISTENING branch in `/api/tests/generate/route.ts` (Task 30) — before the semaphore acquire.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/lib/rate-limit.ts apps/web/src/app/api/tests/generate/route.ts
  git commit -m "feat(api): per-user listening rate limit (10/hr, includes failed gens)"
  ```

---

## Phase 5 · UI components (Tasks 36-50)

### Task 36: i18n strings for listening

**Files:**
- Modify: `apps/web/src/i18n/zh-CN.ts`

- [ ] **Step 1: Append listening-specific strings**

  Append to the existing zh-CN dict:

  ```ts
  export const zhCN = {
    // ... existing Phase 1 strings ...

    listening: {
      portalTitle: "听力练习",
      modeMock: "模考",
      modePractice: "练习",
      scopeFull: "完整试卷",
      scopePart: (n: number) => `第 ${n} 部分`,
      start: "开始",
      submitNow: "立即提交",
      reviewPhaseBanner: "听力播放完成。可修改答案，时间到后将自动提交。",
      generating: "正在生成听力测试 — 通常需要 1-2 分钟",
      audioLoadFailed: "音频加载失败，请刷新页面或返回重试",
      generationFailed: "生成听力测试失败，请重试",
      timeExceeded: "考试时间已结束，答案已自动提交",
      networkOffline: "网络连接断开，请重新连接后重试",
      rateLimitExceeded: "每小时最多生成 10 次听力测试，请稍后再试",
      busy: "系统繁忙，请稍后再试",
      replay: "重播",
      replaySegment: "重播此音频段",
      playbackSpeed: "倍速",
      showTapescript: "显示听力原文",
      hideTapescript: "隐藏听力原文",
      partLabel: (n: number) => `第 ${n} 部分`,
      fullMock: "完整模考",
      score: "得分",
      scoreScaled: "换算分",
      timeTaken: "用时",
      redo: "重做",
      backToPortal: "返回门户",
    },
  } as const;
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter web exec tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/i18n/zh-CN.ts
  git commit -m "feat(i18n): listening zh-CN strings"
  ```

### Task 37: `AudioPlayer` component (ported + extended from AB)

**Files:**
- Create: `apps/web/src/components/listening/AudioPlayer.tsx`

- [ ] **Step 1: Create the player**

  Create `apps/web/src/components/listening/AudioPlayer.tsx`:

  ```tsx
  "use client";

  import { useEffect, useRef, useState } from "react";
  import type { AudioSegmentRecord } from "@/lib/audio/types";

  export interface AudioPlayerProps {
    src: string;
    segments: AudioSegmentRecord[];
    controls: {
      playPause: boolean;
      scrub: boolean;
      skip10: boolean;
      speed: boolean;
      perSegmentReplay: boolean;
    };
    onEnded?: () => void;
    onSegmentChange?: (segmentId: string | null) => void;
    autoPlay?: boolean;
    initiallyMuted?: boolean;
  }

  export function AudioPlayer(props: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);

    // Report current segment based on timestamps
    useEffect(() => {
      if (!props.onSegmentChange) return;
      const currentMs = currentTime * 1000;
      const seg = props.segments.find(
        (s) => currentMs >= s.startMs && currentMs < s.endMs
      );
      props.onSegmentChange(seg?.id ?? null);
    }, [currentTime, props]);

    const togglePlay = () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) a.play();
      else a.pause();
    };

    const skip = (deltaSec: number) => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + deltaSec));
    };

    const jumpToSegment = (segmentId: string) => {
      const seg = props.segments.find((s) => s.id === segmentId);
      const a = audioRef.current;
      if (seg && a) {
        a.currentTime = seg.startMs / 1000;
        a.play();
      }
    };

    const setPlaybackSpeed = (r: number) => {
      const a = audioRef.current;
      if (!a) return;
      a.playbackRate = r;
      setSpeed(r);
    };

    return (
      <div className="audio-player">
        <audio
          ref={audioRef}
          src={props.src}
          autoPlay={props.autoPlay}
          muted={props.initiallyMuted}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); props.onEnded?.(); }}
        />

        <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg">
          {props.controls.skip10 && (
            <button className="px-2 py-1 border rounded"
              onClick={() => skip(-10)} aria-label="-10s">⏪ 10s</button>
          )}
          {props.controls.playPause && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={togglePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
          {props.controls.skip10 && (
            <button className="px-2 py-1 border rounded"
              onClick={() => skip(10)} aria-label="+10s">10s ⏩</button>
          )}

          <div className="flex-1 mx-3">
            {props.controls.scrub ? (
              <input type="range" min={0} max={duration || 0} step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const a = audioRef.current;
                  if (a) a.currentTime = Number(e.target.value);
                }}
                className="w-full"
              />
            ) : (
              <div className="h-2 bg-slate-300 rounded">
                <div
                  className="h-2 bg-blue-600 rounded"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            )}
            <div className="text-xs text-slate-600 mt-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {props.controls.speed && (
            <div className="flex gap-1">
              {[0.75, 1, 1.25].map((r) => (
                <button
                  key={r}
                  className={`px-2 py-1 text-xs rounded border ${
                    speed === r ? "bg-blue-600 text-white" : ""
                  }`}
                  onClick={() => setPlaybackSpeed(r)}
                >
                  {r}×
                </button>
              ))}
            </div>
          )}
        </div>

        {props.controls.perSegmentReplay && (
          <div className="mt-3 flex flex-wrap gap-2">
            {props.segments
              .filter((s) => s.kind === "question_stimulus" && s.questionId)
              .filter((s, i, arr) => arr.findIndex((x) => x.questionId === s.questionId) === i)
              .map((s) => (
                <button
                  key={s.id}
                  className="px-3 py-1 border rounded text-sm hover:bg-slate-200"
                  onClick={() => jumpToSegment(s.id)}
                >
                  重播 {s.questionId}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, "0")}`;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/listening/AudioPlayer.tsx
  git commit -m "feat(ui): AudioPlayer with mode-aware controls + per-segment replay"
  ```

### Task 38: `TimerBadge` with server-sync + auto-submit

**Files:**
- Create: `apps/web/src/components/listening/TimerBadge.tsx`

- [ ] **Step 1: Implement**

  Create `apps/web/src/components/listening/TimerBadge.tsx`:

  ```tsx
  "use client";

  import { useEffect, useRef, useState } from "react";

  export interface TimerBadgeProps {
    attemptId: string;
    syncInterval?: number; // ms, default 10000
    onAutoSubmit: () => void;
    phase: "LISTENING" | "REVIEW";
  }

  export function TimerBadge(props: TimerBadgeProps) {
    const [remaining, setRemaining] = useState<number | null>(null);
    const onAutoSubmitRef = useRef(props.onAutoSubmit);
    onAutoSubmitRef.current = props.onAutoSubmit;
    const autoSubmittedRef = useRef(false);

    // Server-sync poll
    useEffect(() => {
      let cancelled = false;
      const syncInterval = props.syncInterval ?? 10_000;

      const syncOnce = async () => {
        try {
          const res = await fetch(`/api/tests/attempts/${props.attemptId}/status`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = await res.json();
          if (!cancelled && typeof data.remainingSeconds === "number") {
            setRemaining(data.remainingSeconds);
          }
        } catch {
          // network blip — continue with local countdown
        }
      };

      syncOnce();
      const t = setInterval(syncOnce, syncInterval);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }, [props.attemptId, props.syncInterval]);

    // Local countdown every 1s
    useEffect(() => {
      if (remaining === null) return;
      const t = setInterval(() => {
        setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
      }, 1000);
      return () => clearInterval(t);
    }, [remaining === null]);

    // Auto-submit when reaches 0
    useEffect(() => {
      if (remaining === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        onAutoSubmitRef.current();
      }
    }, [remaining]);

    if (remaining === null) return <div className="text-xs text-slate-500">...</div>;

    const mm = Math.floor(remaining / 60);
    const ss = remaining % 60;
    const color = remaining < 60 ? "text-red-600" : props.phase === "REVIEW" ? "text-amber-600" : "text-slate-800";

    return (
      <div className={`font-mono text-lg ${color}`}>
        {mm.toString().padStart(2, "0")}:{ss.toString().padStart(2, "0")}
      </div>
    );
  }
  ```

- [ ] **Step 2: Note — `/api/tests/attempts/[attemptId]/status` route**

  If this route doesn't exist yet in Phase 1, create it as a thin wrapper that returns `{remainingSeconds}` computed from `attempt.startedAt + LISTENING_TIME_LIMIT_SEC - now`. Add it as:

  `apps/web/src/app/api/tests/attempts/[attemptId]/status/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";

  export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ attemptId: string }> }
  ) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { attemptId } = await ctx.params;
    const attempt = await db.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: true },
    });
    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const timeLimitSec = Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800);
    const elapsedSec = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
    const remainingSeconds = Math.max(0, timeLimitSec - elapsedSec);

    return NextResponse.json({
      attemptId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      elapsedSec,
      remainingSeconds,
      timeLimitSec,
    });
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/listening/TimerBadge.tsx apps/web/src/app/api/tests/attempts/[attemptId]/status/route.ts
  git commit -m "feat(ui): TimerBadge server-sync + auto-submit at 0"
  ```

### Task 39: `TapescriptPanel` with segment-level highlight

**Files:**
- Create: `apps/web/src/components/listening/TapescriptPanel.tsx`

- [ ] **Step 1: Implement**

  ```tsx
  "use client";

  import { useState } from "react";
  import type { AudioSegmentRecord, ListeningPart } from "@/lib/audio/types";

  export interface TapescriptPanelProps {
    parts: ListeningPart[];
    segments: AudioSegmentRecord[];
    currentSegmentId: string | null;
    defaultOpen?: boolean;
    canToggle?: boolean;
  }

  export function TapescriptPanel(props: TapescriptPanelProps) {
    const [open, setOpen] = useState(props.defaultOpen ?? false);

    if (!open && props.canToggle) {
      return (
        <button
          className="text-sm underline text-blue-700"
          onClick={() => setOpen(true)}
        >
          显示听力原文
        </button>
      );
    }

    return (
      <div className="tapescript-panel border rounded p-4 bg-white">
        {props.canToggle && (
          <button
            className="text-sm underline text-blue-700 mb-3"
            onClick={() => setOpen(false)}
          >
            隐藏听力原文
          </button>
        )}
        {props.parts.map((part) => (
          <div key={part.partNumber} className="mb-4">
            <h3 className="font-semibold">第 {part.partNumber} 部分</h3>
            {part.audioScript
              .filter((s) => s.text)
              .map((s) => {
                const isCurrent = s.id === props.currentSegmentId;
                return (
                  <p
                    key={s.id}
                    className={
                      isCurrent
                        ? "font-bold bg-yellow-100 px-2 py-1 my-1 rounded"
                        : "text-slate-700 my-1"
                    }
                  >
                    <span className="text-xs text-slate-500 mr-2">
                      [{s.voiceTag ?? "silence"}]
                    </span>
                    {s.text}
                  </p>
                );
              })}
          </div>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/listening/TapescriptPanel.tsx
  git commit -m "feat(ui): TapescriptPanel with segment-level highlight"
  ```

### Task 40: `PhaseBanner` + `GenerationProgress` small components

**Files:**
- Create: `apps/web/src/components/listening/PhaseBanner.tsx`
- Create: `apps/web/src/components/listening/GenerationProgress.tsx`

- [ ] **Step 1: Implement both**

  ```tsx
  // apps/web/src/components/listening/PhaseBanner.tsx
  "use client";

  export function PhaseBanner({ phase }: { phase: "LISTENING" | "REVIEW" }) {
    if (phase !== "REVIEW") return null;
    return (
      <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-4 rounded">
        <p className="font-semibold text-amber-900">
          听力播放完成。可修改答案，时间到后将自动提交。
        </p>
      </div>
    );
  }
  ```

  ```tsx
  // apps/web/src/components/listening/GenerationProgress.tsx
  "use client";

  export function GenerationProgress({ elapsedSec }: { elapsedSec: number }) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
        <p className="font-semibold">
          正在生成听力测试 — 通常需要 1-2 分钟
        </p>
        <p className="text-sm text-slate-500 mt-2">已用时 {elapsedSec} 秒</p>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/listening/PhaseBanner.tsx apps/web/src/components/listening/GenerationProgress.tsx
  git commit -m "feat(ui): PhaseBanner + GenerationProgress widgets"
  ```

### Task 41: Question renderers — 5 variants

**Files:**
- Create: `apps/web/src/components/listening/questions/Mcq3Picture.tsx`
- Create: `apps/web/src/components/listening/questions/GapFillOpen.tsx`
- Create: `apps/web/src/components/listening/questions/Mcq3Text.tsx`
- Create: `apps/web/src/components/listening/questions/Mcq3TextScenario.tsx`
- Create: `apps/web/src/components/listening/questions/Matching5To8.tsx`
- Create: `apps/web/src/components/listening/QuestionRenderer.tsx`

- [ ] **Step 1: Create shared `QuestionRenderer` router**

  ```tsx
  // apps/web/src/components/listening/QuestionRenderer.tsx
  "use client";

  import type { ListeningQuestion } from "@/lib/audio/types";
  import { Mcq3Picture } from "./questions/Mcq3Picture";
  import { GapFillOpen } from "./questions/GapFillOpen";
  import { Mcq3Text } from "./questions/Mcq3Text";
  import { Mcq3TextScenario } from "./questions/Mcq3TextScenario";
  import { Matching5To8 } from "./questions/Matching5To8";

  export interface QuestionRendererProps {
    question: ListeningQuestion;
    value: string | undefined;
    onChange: (val: string) => void;
    disabled?: boolean;
    showCorrectness?: boolean; // true on result page
    correctAnswer?: string;
  }

  export function QuestionRenderer(props: QuestionRendererProps) {
    const { type } = props.question;
    if (type === "MCQ_3_PICTURE") return <Mcq3Picture {...props} />;
    if (type === "GAP_FILL_OPEN") return <GapFillOpen {...props} />;
    if (
      type === "MCQ_3_TEXT" ||
      type === "MCQ_3_TEXT_DIALOGUE" ||
      type === "MCQ_3_TEXT_INTERVIEW"
    )
      return <Mcq3Text {...props} />;
    if (type === "MCQ_3_TEXT_SCENARIO") return <Mcq3TextScenario {...props} />;
    if (type === "MATCHING_5_TO_8") return <Matching5To8 {...props} />;
    return null;
  }
  ```

- [ ] **Step 2: Create `Mcq3Picture.tsx`**

  ```tsx
  // apps/web/src/components/listening/questions/Mcq3Picture.tsx
  "use client";

  import type { QuestionRendererProps } from "../QuestionRenderer";

  export function Mcq3Picture(props: QuestionRendererProps) {
    const q = props.question;
    const opts = q.options ?? [];
    return (
      <div className="my-4 p-4 border rounded">
        <p className="font-semibold mb-3">{q.prompt}</p>
        <div className="grid grid-cols-3 gap-3">
          {opts.map((opt) => {
            const selected = props.value === opt.id;
            const isCorrect = props.showCorrectness && opt.id === props.correctAnswer;
            const isWrong =
              props.showCorrectness && selected && opt.id !== props.correctAnswer;
            return (
              <button
                key={opt.id}
                disabled={props.disabled}
                onClick={() => props.onChange(opt.id)}
                className={`p-4 border-2 rounded ${
                  isCorrect ? "border-green-500 bg-green-50" :
                  isWrong ? "border-red-500 bg-red-50" :
                  selected ? "border-blue-500 bg-blue-50" : ""
                }`}
              >
                <div className="text-2xl font-bold mb-2">{opt.id}</div>
                <div className="text-sm text-slate-600">
                  {opt.imageDescription ?? `Picture ${opt.id}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  ```

  *Note:* Phase 2 uses text descriptions (`imageDescription`) as placeholders for real pictures. Actual image generation is a later-phase enhancement.

- [ ] **Step 3: Create `GapFillOpen.tsx`**

  ```tsx
  // apps/web/src/components/listening/questions/GapFillOpen.tsx
  "use client";

  import type { QuestionRendererProps } from "../QuestionRenderer";

  export function GapFillOpen(props: QuestionRendererProps) {
    const q = props.question;
    const selected = props.value ?? "";
    const isCorrect =
      props.showCorrectness &&
      selected.trim().toLowerCase() === props.correctAnswer?.trim().toLowerCase();
    const isWrong = props.showCorrectness && selected.length > 0 && !isCorrect;

    return (
      <div className="my-4 p-4 border rounded">
        <p className="font-semibold mb-2">{q.prompt}</p>
        <input
          type="text"
          value={selected}
          onChange={(e) => props.onChange(e.target.value)}
          disabled={props.disabled}
          className={`border-2 rounded px-3 py-1 ${
            isCorrect ? "border-green-500" : isWrong ? "border-red-500" : "border-slate-300"
          }`}
        />
        {props.showCorrectness && !isCorrect && (
          <p className="text-sm text-green-700 mt-2">
            正确答案: {props.correctAnswer}
          </p>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Create `Mcq3Text.tsx`**

  ```tsx
  // apps/web/src/components/listening/questions/Mcq3Text.tsx
  "use client";

  import type { QuestionRendererProps } from "../QuestionRenderer";

  export function Mcq3Text(props: QuestionRendererProps) {
    const q = props.question;
    const opts = q.options ?? [];
    return (
      <div className="my-4 p-4 border rounded">
        <p className="font-semibold mb-3">{q.prompt}</p>
        <div className="space-y-2">
          {opts.map((opt) => {
            const selected = props.value === opt.id;
            const isCorrect = props.showCorrectness && opt.id === props.correctAnswer;
            const isWrong =
              props.showCorrectness && selected && opt.id !== props.correctAnswer;
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                  isCorrect ? "bg-green-50" : isWrong ? "bg-red-50" : selected ? "bg-blue-50" : ""
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt.id}
                  checked={selected}
                  disabled={props.disabled}
                  onChange={() => props.onChange(opt.id)}
                />
                <span>
                  <strong>{opt.id}.</strong> {opt.text}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Create `Mcq3TextScenario.tsx`**

  ```tsx
  // apps/web/src/components/listening/questions/Mcq3TextScenario.tsx
  "use client";

  import type { QuestionRendererProps } from "../QuestionRenderer";
  import { Mcq3Text } from "./Mcq3Text";

  export function Mcq3TextScenario(props: QuestionRendererProps) {
    // Same rendering as Mcq3Text — scenario prompt is read aloud by proctor
    // voice in the audio; the student sees the question prompt here.
    return <Mcq3Text {...props} />;
  }
  ```

- [ ] **Step 6: Create `Matching5To8.tsx`**

  ```tsx
  // apps/web/src/components/listening/questions/Matching5To8.tsx
  "use client";

  import type { QuestionRendererProps } from "../QuestionRenderer";

  export function Matching5To8(props: QuestionRendererProps) {
    const q = props.question;
    const opts = q.options ?? [];
    const selected = props.value;
    const isCorrect = props.showCorrectness && selected === props.correctAnswer;
    const isWrong = props.showCorrectness && selected && !isCorrect;

    return (
      <div className="my-4 p-4 border rounded">
        <p className="font-semibold mb-2">{q.prompt}</p>
        <select
          value={selected ?? ""}
          onChange={(e) => props.onChange(e.target.value)}
          disabled={props.disabled}
          className={`border-2 rounded px-3 py-1 ${
            isCorrect ? "border-green-500" : isWrong ? "border-red-500" : "border-slate-300"
          }`}
        >
          <option value="">— 选择 —</option>
          {opts.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.id}. {opt.text ?? ""}
            </option>
          ))}
        </select>
        {props.showCorrectness && !isCorrect && (
          <p className="text-sm text-green-700 mt-2">
            正确答案: {props.correctAnswer}
          </p>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 7: Commit all renderers**

  ```bash
  git add apps/web/src/components/listening/
  git commit -m "feat(ui): 5 question renderers + QuestionRenderer router"
  ```

### Task 42: `ListeningRunner` root component

**Files:**
- Create: `apps/web/src/components/listening/ListeningRunner.tsx`

- [ ] **Step 1: Implement the state-machine root**

  ```tsx
  "use client";

  import { useCallback, useEffect, useState } from "react";
  import { useRouter } from "next/navigation";

  import { AudioPlayer } from "./AudioPlayer";
  import { TimerBadge } from "./TimerBadge";
  import { TapescriptPanel } from "./TapescriptPanel";
  import { PhaseBanner } from "./PhaseBanner";
  import { GenerationProgress } from "./GenerationProgress";
  import { QuestionRenderer } from "./QuestionRenderer";
  import type {
    AudioSegmentRecord,
    ListeningTestPayloadV2,
  } from "@/lib/audio/types";

  export interface ListeningRunnerProps {
    attemptId: string;
    testId: string;
    mode: "MOCK" | "PRACTICE";
    portal: "ket" | "pet";
  }

  type RunnerState = "LOADING" | "READY" | "LISTENING" | "REVIEW" | "SUBMITTING";

  export function ListeningRunner(props: ListeningRunnerProps) {
    const router = useRouter();
    const [state, setState] = useState<RunnerState>("LOADING");
    const [payload, setPayload] = useState<ListeningTestPayloadV2 | null>(null);
    const [segments, setSegments] = useState<AudioSegmentRecord[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
    const [elapsedSec, setElapsedSec] = useState(0);

    // Poll status while loading
    useEffect(() => {
      if (state !== "LOADING") return;
      const t0 = Date.now();
      const poll = async () => {
        setElapsedSec(Math.floor((Date.now() - t0) / 1000));
        const res = await fetch(`/api/tests/${props.testId}/status`, { cache: "no-store" });
        const data = await res.json();
        if (data.audioReady) {
          setPayload(data.payload);
          setSegments(data.audioSegments ?? []);
          setState("READY");
        } else if (data.audioStatus === "FAILED") {
          alert("生成听力测试失败，请重试");
          router.push(`/${props.portal}/listening/new`);
        }
      };
      poll();
      const t = setInterval(poll, 1500);
      return () => clearInterval(t);
    }, [state, props.testId, props.portal, router]);

    const audioSrc = `/api/listening/${props.attemptId}/audio`;

    const submit = useCallback(
      async (forceSubmit = false) => {
        setState("SUBMITTING");
        const res = await fetch(`/api/tests/${props.attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, forceSubmit }),
        });
        if (res.ok) {
          router.push(`/${props.portal}/listening/result/${props.attemptId}`);
        } else {
          const data = await res.json();
          alert(data.message ?? "提交失败");
          setState(forceSubmit ? "REVIEW" : "LISTENING");
        }
      },
      [answers, props.attemptId, props.portal, router]
    );

    if (state === "LOADING" || !payload) {
      return <GenerationProgress elapsedSec={elapsedSec} />;
    }

    if (state === "READY") {
      return (
        <div className="p-6 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">准备开始</h2>
          <p className="mb-2">
            {props.mode === "MOCK"
              ? "点击开始后，30 分钟倒计时开始。音频将播放两次，不可暂停、不可倒放。最后 6 分钟为检查和提交时间。"
              : "练习模式 — 无时间限制，音频可自由重播。"}
          </p>
          <button
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg"
            onClick={() => setState("LISTENING")}
          >
            开始
          </button>
        </div>
      );
    }

    const isMock = props.mode === "MOCK";

    return (
      <div className="p-6 max-w-3xl mx-auto">
        {isMock && (
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">
              {state === "REVIEW" ? "检查并提交" : "听力进行中"}
            </span>
            <TimerBadge
              attemptId={props.attemptId}
              onAutoSubmit={() => submit(true)}
              phase={state === "REVIEW" ? "REVIEW" : "LISTENING"}
            />
          </div>
        )}
        <PhaseBanner phase={state === "REVIEW" ? "REVIEW" : "LISTENING"} />

        <AudioPlayer
          src={audioSrc}
          segments={segments}
          autoPlay={isMock}
          controls={{
            playPause: !isMock,
            scrub: !isMock,
            skip10: !isMock,
            speed: !isMock,
            perSegmentReplay: !isMock,
          }}
          onSegmentChange={setCurrentSegmentId}
          onEnded={() => {
            if (isMock) setState("REVIEW");
          }}
        />

        {!isMock && (
          <TapescriptPanel
            parts={payload.parts}
            segments={segments}
            currentSegmentId={currentSegmentId}
            canToggle={true}
            defaultOpen={false}
          />
        )}

        <div className="mt-6">
          {payload.parts.map((part) => (
            <section key={part.partNumber} className="mb-8">
              <h3 className="text-xl font-semibold mb-2">
                第 {part.partNumber} 部分 · {part.instructionZh}
              </h3>
              {part.questions.map((q) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={false}
                />
              ))}
            </section>
          ))}
        </div>

        <button
          onClick={() => submit(false)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg"
          disabled={state === "SUBMITTING"}
        >
          {isMock && state === "LISTENING" ? "提交" : "立即提交"}
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter web exec tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/listening/ListeningRunner.tsx
  git commit -m "feat(ui): ListeningRunner root — mock + practice state machine"
  ```

### Task 43: KET + PET routes (new / runner / result)

**Files:**
- Create: `apps/web/src/app/ket/listening/new/page.tsx`
- Create: `apps/web/src/app/ket/listening/runner/[attemptId]/page.tsx`
- Create: `apps/web/src/app/ket/listening/result/[attemptId]/page.tsx`
- Create: mirror for `pet/`

- [ ] **Step 1: Create `/ket/listening/new` — picker page**

  ```tsx
  // apps/web/src/app/ket/listening/new/page.tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";

  export default function NewKetListeningPage() {
    return <NewListeningPicker portal="ket" parts={[1, 2, 3, 4, 5]} />;
  }

  export function NewListeningPicker(props: {
    portal: "ket" | "pet";
    parts: number[];
  }) {
    const router = useRouter();
    const [mode, setMode] = useState<"MOCK" | "PRACTICE">("PRACTICE");
    const [scope, setScope] = useState<"FULL" | "PART">("PART");
    const [part, setPart] = useState<number>(1);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const start = async () => {
      setBusy(true);
      setErr(null);
      const res = await fetch("/api/tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "LISTENING",
          examType: props.portal.toUpperCase(),
          mode,
          scope,
          part: scope === "PART" ? part : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErr(data.message ?? "生成失败");
        setBusy(false);
        return;
      }
      const { testId } = await res.json();

      // Create attempt
      const a = await fetch(`/api/tests/${testId}/attempt`, { method: "POST" });
      const { attemptId } = await a.json();
      router.push(`/${props.portal}/listening/runner/${attemptId}`);
    };

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          {props.portal.toUpperCase()} · 听力练习
        </h1>

        <fieldset className="mb-4">
          <legend className="font-semibold">模式</legend>
          {["PRACTICE", "MOCK"].map((m) => (
            <label key={m} className="mr-4">
              <input
                type="radio"
                name="mode"
                checked={mode === m}
                onChange={() => setMode(m as "MOCK" | "PRACTICE")}
              />{" "}
              {m === "MOCK" ? "模考" : "练习"}
            </label>
          ))}
        </fieldset>

        <fieldset className="mb-4">
          <legend className="font-semibold">范围</legend>
          <label className="mr-4">
            <input type="radio" name="scope" checked={scope === "FULL"}
              onChange={() => setScope("FULL")} />
            完整试卷
          </label>
          <label>
            <input type="radio" name="scope" checked={scope === "PART"}
              onChange={() => setScope("PART")} />
            单个部分
          </label>
        </fieldset>

        {scope === "PART" && (
          <fieldset className="mb-4">
            <legend className="font-semibold">部分</legend>
            {props.parts.map((p) => (
              <label key={p} className="mr-4">
                <input
                  type="radio"
                  name="part"
                  checked={part === p}
                  onChange={() => setPart(p)}
                />{" "}
                第 {p} 部分
              </label>
            ))}
          </fieldset>
        )}

        <button
          onClick={start}
          disabled={busy}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {busy ? "生成中..." : "开始"}
        </button>

        {err && <p className="text-red-600 mt-4">{err}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 2: Create the runner page**

  ```tsx
  // apps/web/src/app/ket/listening/runner/[attemptId]/page.tsx
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";
  import { notFound, redirect } from "next/navigation";
  import { ListeningRunner } from "@/components/listening/ListeningRunner";

  export default async function KetListeningRunnerPage({
    params,
  }: {
    params: Promise<{ attemptId: string }>;
  }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    const { attemptId } = await params;
    const attempt = await db.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: true },
    });
    if (!attempt || attempt.userId !== session.user.id) notFound();
    if (attempt.test.examType !== "KET") notFound();

    return (
      <ListeningRunner
        attemptId={attempt.id}
        testId={attempt.test.id}
        mode={attempt.test.mode}
        portal="ket"
      />
    );
  }
  ```

- [ ] **Step 3: Create the result page (student + teacher can both view)**

  ```tsx
  // apps/web/src/app/ket/listening/result/[attemptId]/page.tsx
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";
  import { notFound, redirect } from "next/navigation";
  import { AudioPlayer } from "@/components/listening/AudioPlayer";
  import { TapescriptPanel } from "@/components/listening/TapescriptPanel";
  import { QuestionRenderer } from "@/components/listening/QuestionRenderer";
  import type {
    AudioSegmentRecord,
    ListeningTestPayloadV2,
  } from "@/lib/audio/types";

  export default async function KetListeningResultPage({
    params,
  }: {
    params: Promise<{ attemptId: string }>;
  }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    const { attemptId } = await params;
    const attempt = await db.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: true },
    });
    if (!attempt || attempt.userId !== session.user.id) notFound();

    const payload = attempt.test.payload as unknown as ListeningTestPayloadV2;
    const segments = (attempt.test.audioSegments ?? []) as unknown as AudioSegmentRecord[];
    const answers = (attempt.answers ?? {}) as Record<string, string>;

    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">听力结果 — KET</h1>
        <div className="p-4 bg-slate-100 rounded mb-6">
          <p className="text-xl font-semibold">
            得分: {attempt.rawScore} / {attempt.totalPossible}
          </p>
        </div>

        <div className="mb-6">
          <AudioPlayer
            src={`/api/listening/${attempt.id}/audio`}
            segments={segments}
            controls={{
              playPause: true,
              scrub: true,
              skip10: true,
              speed: true,
              perSegmentReplay: true,
            }}
          />
        </div>

        <TapescriptPanel
          parts={payload.parts}
          segments={segments}
          currentSegmentId={null}
          defaultOpen={true}
          canToggle={false}
        />

        <div className="mt-6">
          {payload.parts.map((part) => (
            <section key={part.partNumber} className="mb-6">
              <h3 className="text-lg font-semibold">第 {part.partNumber} 部分</h3>
              {part.questions.map((q) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={() => {}}
                  disabled={true}
                  showCorrectness={true}
                  correctAnswer={q.answer}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Mirror for `pet/`**

  Create the three equivalent files under `apps/web/src/app/pet/listening/` by copying the three KET files and changing `portal="ket"` → `portal="pet"`, `"KET"` → `"PET"`, `parts={[1, 2, 3, 4, 5]}` → `parts={[1, 2, 3, 4]}`.

- [ ] **Step 5: Add `/api/tests/[testId]/attempt` route if it doesn't exist in Phase 1**

  ```bash
  ls apps/web/src/app/api/tests/[testId]/attempt 2>&1 || echo "missing"
  ```

  If missing, create `apps/web/src/app/api/tests/[testId]/attempt/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";

  export async function POST(
    _req: NextRequest,
    ctx: { params: Promise<{ testId: string }> }
  ) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { testId } = await ctx.params;
    const test = await db.test.findUnique({ where: { id: testId } });
    if (!test || test.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const attempt = await db.testAttempt.create({
      data: {
        userId: session.user.id,
        testId: test.id,
        status: "IN_PROGRESS",
        mode: test.mode,
        startedAt: new Date(),
      },
    });
    return NextResponse.json({ attemptId: attempt.id });
  }
  ```

- [ ] **Step 6: Commit all route pages**

  ```bash
  git add apps/web/src/app/ket/listening/ apps/web/src/app/pet/listening/ apps/web/src/app/api/tests/[testId]/attempt/
  git commit -m "feat(routes): KET+PET listening new/runner/result + attempt create endpoint"
  ```

---

## Phase 6 · Integrations (Tasks 44-48)

### Task 44: Extend `/history` with Listening filter

**Files:**
- Modify: `apps/web/src/app/history/page.tsx`

- [ ] **Step 1: Inspect existing `/history` page**

  ```bash
  cat apps/web/src/app/history/page.tsx
  ```
  Note the kind-filter chip pattern (reading / writing chips).

- [ ] **Step 2: Add Listening chip + branch**

  Add `"LISTENING"` to the allowed kinds in the filter state, add a "听力" chip, and ensure the listing displays:
  - Portal badge (KET/PET)
  - "第 N 部分" or "完整模考" based on `Test.part`
  - Score `N/25`
  - Mode badge (练习 / 模考)
  - Completion date
  - Redo button → `POST /api/tests/{testId}/attempt` → `/{portal}/listening/runner/{newAttemptId}`

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/history/page.tsx
  git commit -m "feat(history): add Listening filter + listing row"
  ```

### Task 45: Extend `/history/mistakes` with Listening filter

**Files:**
- Modify: `apps/web/src/app/history/mistakes/page.tsx`

- [ ] **Step 1: Add Listening chip**

  Same pattern as Task 44 — add "听力" to the chip row. The MistakeNote → TestAttempt → Test.kind join already filters correctly; no data changes needed.

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/app/history/mistakes/page.tsx
  git commit -m "feat(history): Listening filter on /history/mistakes"
  ```

### Task 46: Assignments validator + UI

**Files:**
- Modify: the Zod validator for Assignment.target (search: `grep -rn "target" apps/web/src/lib/validators 2>/dev/null`)
- Modify: teacher assignment-creation modal (search: `grep -rn "assignment" apps/web/src/app/teacher 2>/dev/null | head`)

- [ ] **Step 1: Add LISTENING to the allowed kinds in Zod**

  Find the schema and extend:
  ```ts
  kind: z.enum(["READING", "WRITING", "LISTENING"]),
  ```

- [ ] **Step 2: Add Listening option to teacher UI**

  In the assignment-creation modal, add "听力" as an option in the kind dropdown.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/
  git commit -m "feat(assignments): teachers can assign LISTENING kind"
  ```

### Task 47: Teacher dashboards — class + per-student

**Files:**
- Modify: `apps/web/src/app/teacher/classes/[classId]/page.tsx`
- Modify: `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/page.tsx`

- [ ] **Step 1: Class overview — add listening stats row**

  In the per-student summary table, add columns for:
  - Listening attempts count
  - Listening avg score

  Use the same aggregation helper Phase 1 uses for reading/writing, passing `kind: "LISTENING"`.

- [ ] **Step 2: Per-student detail — add listening series to score-trend chart**

  Find the chart configuration (likely using a chart library). Add a third data series for listening attempts. Add "听力" chip to the kind filter row.

- [ ] **Step 3: Add per-kind breakdown card for listening**

  In the per-kind breakdown section, add a Listening card showing: per-part avg score across attempts, total attempts.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/app/teacher/classes/
  git commit -m "feat(teacher): listening in class overview + per-student dashboard"
  ```

### Task 48: Teacher-analysis agent prompt tweak

**Files:**
- Modify: `services/ai/app/agents/teacher_analysis.py`

- [ ] **Step 1: Add a sentence to the system prompt**

  Locate the existing `TEACHER_ANALYSIS_SYSTEM_PROMPT` constant. Add a sentence near the top:

  ```
  The student's `attempts` payload may include LISTENING kind items
  (audio-comprehension tests). When present, analyse listening strengths
  and weaknesses alongside reading/writing — e.g., difficulty with gist
  vs detail, gap-fill spelling, matching tasks.
  ```

- [ ] **Step 2: Verify existing pytest for teacher_analysis still passes**

  ```bash
  cd services/ai && pytest tests/test_teacher_analysis.py -v
  ```
  Expected: unchanged test suite passes (only prompt text changed, no code structure).

- [ ] **Step 3: Commit**

  ```bash
  git add services/ai/app/agents/teacher_analysis.py
  git commit -m "feat(ai): teacher_analysis prompt now covers listening attempts"
  ```

---

## Phase 7 · Cron + docs (Tasks 49-51)

### Task 49: Expired-attempt cron

**Files:**
- Create: `apps/web/src/lib/cron/expired-attempts.ts`
- Create: `apps/web/src/app/api/cron/expired-attempts/route.ts`

- [ ] **Step 1: Implement the cron core**

  Create `apps/web/src/lib/cron/expired-attempts.ts`:

  ```ts
  import { db } from "@/lib/db";
  import { gradeListening } from "@/lib/grading/listening";
  import type { ListeningTestPayloadV2 } from "@/lib/audio/types";

  export async function forceSubmitExpired(now = new Date()): Promise<number> {
    const timeLimitSec = Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800);
    const graceMs = Number(process.env.LISTENING_GRACE_PERIOD_MS ?? 60000);
    const cutoff = new Date(now.getTime() - (timeLimitSec * 1000 + graceMs));

    const expired = await db.testAttempt.findMany({
      where: {
        status: "IN_PROGRESS",
        startedAt: { lte: cutoff },
        test: { kind: "LISTENING" },
      },
      include: { test: true },
    });

    for (const attempt of expired) {
      const payload = attempt.test.payload as unknown as ListeningTestPayloadV2;
      const answers = (attempt.answers ?? {}) as Record<string, string>;
      const result = gradeListening(payload.parts, answers);

      await db.$transaction(async (tx) => {
        await tx.testAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "GRADED",
            submittedAt: now,
            rawScore: result.rawScore,
            totalPossible: result.totalPossible,
            weakPoints: result.weakPoints as object,
          },
        });
        const wrongs = Object.values(result.perQuestion).filter((r) => !r.correct);
        if (wrongs.length) {
          await tx.mistakeNote.createMany({
            data: wrongs.map((r) => ({
              userId: attempt.userId,
              attemptId: attempt.id,
              questionId: r.questionId,
              userAnswer: r.userAnswer ?? "",
              correctAnswer: r.correctAnswer,
              examPoint: r.examPointId,
              difficultyPoint: r.difficultyPointId ?? null,
              status: "NEW",
            })),
          });
        }
      });
    }

    return expired.length;
  }
  ```

- [ ] **Step 2: Expose as an HTTP endpoint (called by Zeabur cron or external scheduler)**

  Create `apps/web/src/app/api/cron/expired-attempts/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { forceSubmitExpired } from "@/lib/cron/expired-attempts";

  export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const count = await forceSubmitExpired();
    return NextResponse.json({ forcedSubmitted: count });
  }
  ```

  Also add to `apps/web/.env.example`: `CRON_SECRET=` and instruct user to populate with a long random string.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/lib/cron/ apps/web/src/app/api/cron/ apps/web/.env.example
  git commit -m "feat(cron): force-submit expired LISTENING attempts"
  ```

- [ ] **Step 4: Configure scheduling**

  On Zeabur: add a cron job calling `POST /api/cron/expired-attempts` with the `x-cron-secret` header every 5 minutes. For local dev, run manually via curl or skip — expired attempts will sit in IN_PROGRESS until the first cron tick.

### Task 50: README + docs updates

**Files:**
- Modify: `README.md` (repo root)
- Modify: `apps/web/README.md`
- Modify: `services/ai/README.md`

- [ ] **Step 1: Update root README**

  Append a "Phase 2 — Listening" section summarizing: what ships, Python + Node roles, R2 requirement + P1–P4 prerequisites from this plan, the 3-service dev run order (docker compose → uvicorn → pnpm dev), and a note that listening generation costs ~¥0.28 per full KET mock.

- [ ] **Step 2: Update apps/web/README**

  Add: listening env vars (from `.env.example`), a "Troubleshooting" section for common edge-tts failures (ECONNRESET retry, Microsoft token rotation fail-fast), and how to run vitest listening tests (`pnpm --filter web exec vitest run src/lib/audio src/lib/grading`).

- [ ] **Step 3: Update services/ai/README**

  Add: `/listening/generate` endpoint, how to run `pytest tests/test_listening_*.py`, and the DeepSeek call shape.

- [ ] **Step 4: Commit**

  ```bash
  git add README.md apps/web/README.md services/ai/README.md
  git commit -m "docs: Phase 2 listening in readmes"
  ```

### Task 51: Finalize `.env.example`

**Files:**
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Review and ensure the .env.example is complete**

  Run:
  ```bash
  grep -E "^[A-Z_]+=" apps/web/.env.example
  ```
  Verify every env var referenced in Phase 2 code is present:
  - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT
  - FFMPEG_BINARY
  - LISTENING_MAX_CONCURRENT, LISTENING_QUEUE_MAX, LISTENING_GEN_TIMEOUT_MS, LISTENING_RATE_LIMIT_PER_HOUR
  - LISTENING_TIME_LIMIT_SEC, LISTENING_GRACE_PERIOD_MS
  - CRON_SECRET

- [ ] **Step 2: Commit if any changes**

  ```bash
  git add apps/web/.env.example
  git commit -m "docs: finalize Phase 2 env vars in .env.example"
  ```

---

## Phase 8 · Verification + sign-off (Task 52)

### Task 52: End-to-end browser verification

- [ ] **Step 1: Prepare dev environment**

  1. `docker compose up -d` in repo root — Postgres on 5432
  2. `cd services/ai && source .venv/Scripts/activate && uvicorn app.main:app --reload --host :: --port 8001`
  3. `pnpm --filter web dev` in a third terminal — Next.js on 3000
  4. Ensure `.env.local` in `apps/web/` has real R2 creds + `CRON_SECRET`

- [ ] **Step 2: Student — KET happy path**

  As a logged-in student:

  1. Visit `/ket/listening/new`
  2. Select Practice + Per-part + Part 1 → click 开始
  3. Wait on the progress screen (~30-60s). Confirm the progress bar shows and doesn't hang past 3 minutes.
  4. When ready, Start the attempt.
  5. The audio plays. Verify:
     - Rubric plays first with a British male voice (`ThomasNeural`)
     - "Now listen again." cue between the two plays
     - Per-question replay buttons are visible
     - Tapescript toggle works
  6. Answer all 5 questions, click Submit.
  7. Result page shows: score N/5, tapescript visible, per-question correctness highlighting, Redo button.
  8. Click Redo. Expected: goes straight to the runner in seconds (cached audio — zero wait).
  9. Go back to `/ket/listening/new`, start Full-mock in Mock mode. Verify:
     - 30-min timer visible and counting down
     - Audio plays continuously through all 5 parts
     - After audio ends, REVIEW banner appears
     - Timer continues counting down through the remaining ~6 min
     - Let timer reach 0 (or click Submit manually); auto-submit works
     - Result page shows scaled score (100-150 range)

- [ ] **Step 3: Student — PET happy path**

  Repeat for PET:
  1. PET Part 3 (gap-fill monologue) practice — verify the ~3:30 minute monologue plays
  2. Gap-fill answer normalization: type `"waterfall "` (trailing space) — should score correct. Type `"waterfal"` (misspelling) — should score wrong (divergence from Cambridge's lenient key).
  3. PET full-mock → let timer expire → auto-submit fires → result renders

- [ ] **Step 4: Teacher happy path**

  1. Log in as teacher
  2. Go to `/teacher/classes/[classId]`
  3. Create assignment "PET Listening Part 1, min 70%"
  4. Switch to student browser → complete the assignment
  5. Back on teacher: verify completion appears in class overview + per-student detail shows listening in chart + per-kind breakdown

- [ ] **Step 5: Negative tests**

  - Kill Python service mid-generation → Test shows FAILED → retry works
  - Set `LISTENING_RATE_LIMIT_PER_HOUR=1` temporarily → second generation rejects with zh-CN rate-limit message
  - Set `LISTENING_MAX_CONCURRENT=1` + `LISTENING_QUEUE_MAX=0` → second simultaneous request returns 503 with zh-CN busy message
  - Close browser during generation → re-open → navigate to `/history` → Test appears as READY
  - Disconnect network during mock mid-exam → reconnect → submit succeeds

- [ ] **Step 6: Run all automated tests**

  ```bash
  cd services/ai && pytest -v
  cd ../../apps/web && pnpm exec vitest run
  ```
  Expected: Phase 1 46/46 + Phase 2 listening tests all green · Phase 1 22/22 + Phase 2 listening UI + audio + grading tests all green.

- [ ] **Step 7: Phase 2 sign-off with user**

  Ask user to confirm every flow above works and they're satisfied. Record sign-off in memory (`project_ket_pet_app.md`):
  - Phase 2 LISTENING signed off `<date>`
  - Phase 3 (Speaking) pending

- [ ] **Step 8: Tag + final commit for Phase 2**

  ```bash
  git tag phase2-listening-complete
  ```

- [ ] **Step 9: Push all Phase 2 commits to origin (only after user signs off)**

  ```bash
  git push origin main --tags
  ```

---

## Self-review

**Spec coverage check:** Every §4 decision (D1–D20) maps to at least one task. Every §10 build-order step from the spec is covered. Every §9 error mode has a corresponding handler in tasks 28, 30, 32, 34, 49.

**Type consistency:** `VoiceTag`, `AudioSegmentKind`, `PlayRule`, `QuestionType`, `ListeningTestPayloadV2` all share exact names between Python (Task 8) and Node (Task 7). The snake_case-to-camelCase conversion lives only in `fetchListeningPayload` (Task 28).

**Placeholder scan:** No "TBD", "TODO", "similar to Task N" patterns.

**Known scope note:** Phase 1 file-path line numbers are not pinned in the plan because Phase 1 code evolves; semantic descriptions are used instead. Each executor will grep/read the relevant Phase 1 file at the time they modify it.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-phase2-listening-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for large plans where you want the main conversation to stay focused on reviewing results rather than executing each step.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
