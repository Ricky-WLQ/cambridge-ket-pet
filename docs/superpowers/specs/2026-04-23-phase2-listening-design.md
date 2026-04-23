# Phase 2 — Listening Module · Design

| | |
|---|---|
| **Status** | Draft — pending user approval |
| **Date** | 2026-04-23 |
| **Phase** | 2 of 4 |
| **Supersedes** | `~/.claude/plans/please-use-superpowers-plugin-fancy-starlight.md` §"Later Phases — Phase 2 Listening" |
| **Depends on** | Phase 1 (Reading + Writing) complete and signed off 2026-04-23 |

## 1. Context

The Cambridge KET/PET exam-prep web app ships Phase 1 (Reading + Writing + full teacher dashboards) to production on GitHub `Ricky-WLQ/cambridge-ket-pet` `main`. Students prepare for Cambridge **A2 Key for Schools (KET)** and **B1 Preliminary (PET)**, both 2020-format digital exams. UI is Simplified Chinese only. Audio content for Listening must feel indistinguishable from the real Cambridge recordings students will meet in the actual exam.

The project is **non-commercial research-grade** — the app is free to users, and the work will be written up as a manuscript for publication. Infrastructure costs are paid by the project owner. This context is approved by the boss (2026-04-23) and relaxes the Microsoft Edge TTS ToS concern: we adopt the AB project's edge-tts pipeline as-is, swap its American voices for British ones, and adapt storage to R2 for horizontal-scale readiness.

## 2. Goals + scope

### 2.1 In scope

- KET Listening — 5 parts, 25 questions, 30 minutes including 6-minute transfer/review block
- PET Listening — 4 parts, 25 questions, 30 minutes including 6-minute transfer/review block
- Both portals (`/ket/listening/*` and `/pet/listening/*`)
- Both modes — **Mock** (exam-faithful, server-authoritative timer, audio plays twice only, no pause/scrub, auto-submit) and **Practice** (no timer, unlimited replay, per-segment seek, tapescript toggle)
- Both attempt scopes — **Full-mock** (all parts in one sitting) and **Per-part practice** (single part ~3–7 min)
- British-accent TTS via Microsoft Edge TTS (`node-edge-tts`) with a 4-voice cast: Ryan, Sonia, Libby, Thomas
- Full integration with Phase 1 systems — unified `/history`, mistake notes (NEW→REVIEWED→MASTERED lifecycle), teacher assignments, teacher class + per-student dashboards, rate limiting via existing `GenerationEvent` table

### 2.2 Out of scope (deferred)

- Speaking module (Phase 3)
- Vocab / Grammar modules (Phase 4)
- Voice cloning / custom British examiner voices (swap-ready in `lib/audio/voices.ts`; not Phase 2)
- Real-time ASR for student responses (Phase 3)
- Multi-language voice support
- Paid tier / gated content
- Mobile native app
- Gamification (XP / streaks / badges)
- Parent role
- Offline / PWA support

### 2.3 Success criteria (used as step-level sign-off gates)

- Full-mock audio generation completes in < 3 min wall-clock on a cold generation path (no cache)
- Audio faithfully includes: Cambridge rubric (verbatim, hardcoded), part intros, per-item or per-part stimuli (play-count rule from §6.5), "Now listen again." repeat cue, inter-part 10s pauses, final 6-min transfer block
- Same-gender dialogues (KET Part 5 Julia/mother) use Sonia + Libby — audibly distinguishable
- Redo reuses cached R2 audio — zero TTS cost, zero wait
- Mock mode enters the Review phase banner when the listening audio ends; `Submit Now` works throughout; auto-submit fires at timer = 0
- All Phase 1 integrations (history, mistakes, assignments, teacher class + per-student dashboards) show listening attempts correctly
- Test suites green: `pytest` (new listening-gen tests added) and `vitest` (new audio-pipeline + grading + UI tests added)
- Phase 2 sign-off step (#22) passes with user browser verification of the full happy-path + negative tests

## 3. Exam format ground truth

Sourced from Cambridge official 2020-format sample papers in `C:\Users\wul82\Desktop\剑桥英语\` and cross-verified against `cambridgeenglish.org/exam-and-tests/` pages 2026-04-23.

### 3.1 KET (A2 Key for Schools 2020 format)

| Part | Question type (stable code) | Qs | Stimulus | Speakers | Play rule | Preview |
|---|---|---|---|---|---|---|
| 1 | `MCQ_3_PICTURE` | 5 | Short 40–60 word dialogue | 2 (M+F mix) | Per-item × 2 | 5 s |
| 2 | `GAP_FILL_OPEN` | 5 | One ~130 word teacher monologue (form fill) | 1 (teacher) | Per-part × 2 | 10 s |
| 3 | `MCQ_3_TEXT` | 5 | One ~200 word dialogue | 2 | Per-part × 2 | 20 s |
| 4 | `MCQ_3_TEXT_SCENARIO` | 5 | 5 short 55–65 word scenarios w/ aloud-read prompts | 1 or 2 per scenario | Per-item × 2 | none (prompt aloud) |
| 5 | `MATCHING_5_TO_8` | 5 | One ~160 word dialogue (5 people ↔ 8 roles) | 2 (same-gender possible) | Per-part × 2 | 15 s |

Gap-fill answer format (Part 2): "one word or a number or a date or a time" per Cambridge rubric. Case-insensitive, exact string match after trim (divergence from Cambridge's lenient key — see §12.1).

### 3.2 PET (B1 Preliminary 2020 format)

| Part | Question type | Qs | Stimulus | Speakers | Play rule | Preview |
|---|---|---|---|---|---|---|
| 1 | `MCQ_3_PICTURE` | 7 | Mixed short monologue/dialogue ~45–75 s each | 1 or 2 | Per-item × 2 | 5 s |
| 2 | `MCQ_3_TEXT_DIALOGUE` | 6 | 6 short dialogues, ~50–90 s each | 2 | Per-item × 2 | 8 s |
| 3 | `GAP_FILL_OPEN` | 6 | One ~3:30 min radio monologue | 1 | Per-part × 2 | 20 s |
| 4 | `MCQ_3_TEXT_INTERVIEW` | 6 | One ~5 min formal interview | 2 (interviewer + interviewee) | Per-part × 2 | 45 s |

Gap-fill answer format (Part 3): "one or two words or a number or a date or a time." Same normalization as KET.

### 3.3 Verbatim Cambridge rubric phrases (hardcoded in `lib/audio/rubric.ts`)

```ts
export const RUBRIC = {
  ket: {
    opening: "Cambridge English, Key English Test for Schools – Listening. Sample Test. There are five parts to the test. You will hear each piece twice.",
    partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
    repeatCue: "Now listen again.",
    partEnd: (n: number) => `That is the end of Part ${n}.`,
    transferStart: "You now have six minutes to write your answers on the answer sheet.",
    oneMinuteWarn: "You have one more minute.",
    closing: "That is the end of the test."
  },
  pet: {
    opening: "Cambridge English, Preliminary English Test, Listening. Sample Test. There are four parts to the test. You will hear each part twice.",
    partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
    repeatCue: "Now listen again.",
    partEnd: (n: number) => `That is the end of Part ${n}.`,
    transferStart: "You now have six minutes to write your answers on the answer sheet.",
    oneMinuteWarn: "You have one more minute.",
    closing: "That is the end of the test."
  }
} as const;
```

AI-generated content is **only** per-question stimulus text and scenario prompts for Part 4. Rubric never goes through DeepSeek.

### 3.4 Inter-segment silence constants

Cambridge 2020-format tape scripts are authoritative. AB's PRETCO timings (e.g., `AFTER_QUESTION=12s`, `BETWEEN_SECTIONS=3s`) don't map — they describe a different test format. We use Cambridge values, with a small number of AB padding constants for sub-segment smoothing.

```ts
export const PAUSE_SEC = {
  // Cambridge 2020-format timings (from KET + PET sample tape scripts)
  BEFORE_REPEAT: 5,                 // pause before and after "Now listen again."
  BETWEEN_ITEMS: 2,                 // between items in PER_ITEM parts
  INTER_PART: 10,                   // between parts
  PRE_PART_INSTRUCTION: 5,          // before each part's instruction is read
  TRANSFER_BLOCK_PREAMBLE: 300,     // 5 min of silence after transfer_start
  TRANSFER_BLOCK_FINAL: 60,         // 1 min after "You have one more minute"

  // Sub-segment padding (useful for chunked TTS smoothing)
  BETWEEN_LINES: 0.5,
  SHORT: 1,
} as const;
```

## 4. Locked architecture decisions

| ID | Decision | Value | Source |
|---|---|---|---|
| D1 | Audio storage + delivery | Cloudflare R2 + stream-proxy via Zeabur Next.js route (users never see `*.r2.cloudflarestorage.com`) | User 2026-04-23 |
| D2 | TTS pipeline | `node-edge-tts` (AB project's library) — Microsoft Edge TTS free endpoint | Boss 2026-04-23 |
| D3 | Accent | British English — `en-GB-*` voices | Boss 2026-04-23 |
| D4 | Voice cast | 4 voices — `en-GB-RyanNeural` (male char), `en-GB-SoniaNeural` (female char A), `en-GB-LibbyNeural` (female char B for same-gender pairs), `en-GB-ThomasNeural` (proctor/narrator) | Verified available on MS endpoint 2026-04-23 |
| D5 | Timing | 30 min total incl. 6-min transfer/review block | Cambridge `cambridgeenglish.org` 2026-04-23 (corrected from initial 35 min) |
| D6 | Attempt scope | Both full-mock + per-part practice | User 2026-04-23 |
| D7 | Generation strategy | On-demand per attempt (matches Phase 1), cached audio on Redo | User 2026-04-23 |
| D8 | Mock-mode timing model | Listening phase (~24 min) + Review phase (6 min) under a single 30-min server-authoritative clock; auto-submit at expiry | User 2026-04-23 |
| D9 | Audio segmentation | Single concatenated mp3 per Test + per-segment timestamps in `Test.audioSegments` JSON | User 2026-04-23 |
| D10 | Timer authority | Server-authoritative, 1-min grace period (AB pattern); client advisory via 10-s polling + auto-submit at zero | Adapted from AB `src/app/api/mock-test/submit-section/route.ts:78-91` |
| D11 | Rubric generation | Hardcoded Cambridge verbatim phrases; AI never invents rubric | User 2026-04-23 |
| D12 | Gap-fill grading | Exact match after `trim().toLowerCase()` normalization | User 2026-04-23 (divergence from Cambridge's lenient key — §12.1) |
| D13 | Audio lifecycle | Create on generation → delete on regeneration (AB pattern) → delete on Test delete (R2 adaptation) → R2 bucket 180-day auto-expire lifecycle rule | User 2026-04-23 |
| D14 | Play rule | `PER_ITEM` for KET Parts 1, 4 + PET Parts 1, 2; `PER_PART` for KET Parts 2, 3, 5 + PET Parts 3, 4. Rule ownership: Python agent emits single-pass logical script; Node concat engine applies the rule. | Derived from Cambridge tape scripts 2026-04-23 |
| D15 | Rate limiting | 10 listening generations per hour per user; both success and failure count | User 2026-04-23 |
| D16 | speechSynthesis fallback | Dropped — edge-tts + R2 cache is reliable enough | User 2026-04-23 |
| D17 | Audio format | mp3, 24 kHz, 96 kbps, mono — edge-tts `outputFormat: "audio-24khz-96kbitrate-mono-mp3"` | User 2026-04-23 |
| D18 | Speech rate | KET `-5%` slowdown (A2 pace); PET `default` (B1 natural pace) | Design (tighter than AB's blanket `-8%`) |
| D19 | Tapescript sync | Segment-level bold highlight (current segment highlighted); word-level not supported by edge-tts | Design decision |
| D20 | Publication type | Deferred — manuscript direction decided later; data-capture hooks added in Phase 2.x | User 2026-04-23 |

## 5. Data model changes (additive Prisma migration)

### 5.1 Enum + fields

```prisma
enum AudioStatus {
  GENERATING
  READY
  FAILED
}

model Test {
  // ... all existing Phase 1 fields unchanged ...

  audioStatus          AudioStatus?
  audioR2Key           String?       // "listening/{testId}/audio.mp3"
  audioGenStartedAt    DateTime?
  audioGenCompletedAt  DateTime?
  audioSegments        Json?         // AudioSegmentRecord[]
  audioErrorMessage    String?       // populated when audioStatus=FAILED
}
```

No other schema changes. `TestAttempt`, `MistakeNote`, `Assignment`, `Comment`, `GenerationEvent` reused unchanged. `TestKind.LISTENING` was already reserved in Phase 1.

### 5.2 `Test.payload` JSON shape for LISTENING (version 2)

```ts
interface ListeningTestPayloadV2 {
  version: 2;
  examType: "KET" | "PET";
  scope: "FULL" | "PART";
  part?: number;           // 1..5 for KET / 1..4 for PET when scope=PART
  parts: ListeningPart[];
  cefrLevel: "A2" | "B1";
  generatedBy: string;     // "deepseek-chat"
}

interface ListeningPart {
  partNumber: number;
  kind: "MCQ_3_PICTURE" | "GAP_FILL_OPEN" | "MCQ_3_TEXT"
      | "MCQ_3_TEXT_SCENARIO" | "MATCHING_5_TO_8"
      | "MCQ_3_TEXT_DIALOGUE" | "MCQ_3_TEXT_INTERVIEW";
  instructionZh: string;
  previewSec: number;       // candidate reading time per Cambridge spec
  playRule: "PER_ITEM" | "PER_PART";
  audioScript: AudioSegment[];
  questions: ListeningQuestion[];
}

type VoiceTag = "proctor" | "S1_male" | "S2_female_A" | "S2_female_B";

interface AudioSegment {
  id: string;               // stable within the Test
  kind: "rubric" | "part_intro" | "preview_pause"
      | "scenario_prompt" | "question_stimulus" | "question_number"
      | "repeat_cue" | "pause" | "part_end" | "transfer_start"
      | "transfer_one_min" | "closing" | "example";
  voiceTag: VoiceTag | null;  // null for pauses + silence-only
  text?: string;               // for speech kinds
  durationMs?: number;         // for pause kinds (including preview_pause)
  partNumber?: number;         // for locating in UI
  questionId?: string;         // links segment to a question for per-Q replay
}

interface ListeningQuestion {
  id: string;
  prompt: string;
  type: ListeningPart["kind"];
  options?: { id: string; text?: string; imageDescription?: string }[];
  answer: string;                // option id OR canonical gap-fill answer
  explanationZh: string;
  examPointId: string;           // "KET.L.Part1.gist" etc.
  difficultyPointId?: string;
}
```

### 5.3 `Test.audioSegments` recorded at concat time

```ts
interface AudioSegmentRecord {
  id: string;                // same ID as AudioSegment.id
  kind: AudioSegment["kind"];
  voiceTag: VoiceTag | null;
  startMs: number;           // offset from start of concatenated mp3
  endMs: number;
  questionId?: string;       // for per-Q replay lookup
}
```

## 6. Audio generation pipeline

### 6.1 High-level flow

```
student clicks "New listening test"
  → POST /api/tests/generate {kind:LISTENING, examType, scope, part?}
  → Next.js: create Test row (audioStatus=GENERATING),
    fire background job, return testId immediately
  → Background: Python /listening/generate → JSON payload + audioScript
  → Background: Node lib/audio/generate.ts:
      for each AudioSegment:
        if "pause" kind: emit silence file
        else: node-edge-tts synthesize with voice from voiceTag
      apply play-rule (per-item or per-part × 2 with repeat cue)
      ffmpeg concat + silence injections
      record AudioSegmentRecord[] with start/end timestamps
  → Background: R2 upload → audioR2Key = "listening/{testId}/audio.mp3"
  → Background: DB finalize (audioStatus=READY, audioSegments, audioGenCompletedAt)
  → Client polls GET /api/tests/:testId/status every 1500 ms
  → When status=READY: POST /api/tests/:testId/attempt → redirect to runner
```

### 6.2 Python agent (`services/ai/app/agents/listening_generator.py`)

- Model: `deepseek-chat` (V3.2) via DeepSeek direct API
- System prompt encodes Cambridge 2020-format spec from §3 + CEFR level constraint (A2 for KET, B1 for PET) + per-part question counts + speaker conventions
- Pydantic `result_type`: `ListeningTestResponse` (matching §5.2 shape minus `audioStatus` fields)
- Validators (`services/ai/app/validators/listening.py`):
  - Part count per exam (KET=5, PET=4)
  - Question count per part (KET: 5/5/5/5/5; PET: 7/6/6/6)
  - Option count per question type (MCQ_3_*=3 options; MATCHING=5 rows × 8 options)
  - Speaker distribution constraints (same-gender dialogues flagged for Libby/Sonia mapping)
  - AudioScript completeness (every Q has a `question_stimulus`; preview_pause present per part per §3.1–3.2)
- 3× regenerate with increasing temperature penalty on validator failure; return 422 to Node caller on terminal failure

### 6.3 Python endpoint

```
POST /listening/generate
Body:
{
  examType: "KET" | "PET",
  scope: "FULL" | "PART",
  part?: number,              // required if scope=PART
  mode: "PRACTICE" | "MOCK",
  seedExamPoints?: string[]
}

Response 200:
ListeningTestPayloadV2 + AudioScript[]

Response 422:
{ error: "validation_failed", detail: ValidationError[] }
```

### 6.4 Node audio service (`apps/web/src/lib/audio/`)

| File | Responsibility |
|---|---|
| `voices.ts` | `VoiceTag` → `en-GB-*` voice name mapping; single source of truth for future accent swap |
| `rubric.ts` | Hardcoded Cambridge rubric strings per §3.3 |
| `edge-tts-client.ts` | `node-edge-tts` wrapper with retry on `ECONNRESET` / WebSocket drop (3× with 2s backoff) + per-locale rate control (KET `-5%`, PET default) |
| `chunker.ts` | Split long text at sentence / comma boundaries, max 400 chars per chunk (AB pattern `audio-generator.ts:139-168`) |
| `concat.ts` | ffmpeg concat with silence injections per §3.4 + play-rule from D14 |
| `r2-client.ts` | AWS SDK v3 S3 client targeting R2; upload + delete with AbortController |
| `segments.ts` | Timestamp recorder that walks the concat list and produces `AudioSegmentRecord[]` |
| `queue.ts` | In-memory concurrency semaphore (max 3 concurrent jobs per Zeabur instance, max 5 waiting, reject beyond with "Busy — try again") |
| `generate.ts` | Orchestrator — stitches all the above, handles §9 error paths, updates Test row |

### 6.5 Play-rule application — single source of responsibility

**The Python agent emits a logical single-pass script** (each segment defined once, no repeats) with semantic kind + voiceTag + text fields per §5.2. The JSON payload is minimal.

**The Node concat engine applies the play rule** from `part.playRule`, duplicating segments as needed. This keeps the agent's output small and cleanly separates content from presentation.

For a part with `playRule: "PER_ITEM"` (KET 1, KET 4, PET 1, PET 2) — per question `q`:

```
emit preview_pause (part.previewSec sec)
emit q's segments in order (question_number → question_stimulus [+ scenario_prompt before stim for KET Part 4])
emit PAUSE_SEC.BEFORE_REPEAT (5 sec)
emit repeat_cue ("Now listen again.")
emit PAUSE_SEC.BEFORE_REPEAT (5 sec)
emit q's segments AGAIN (second pass, same content)
emit PAUSE_SEC.BETWEEN_ITEMS (2 sec)
```

For a part with `playRule: "PER_PART"` (KET 2, KET 3, KET 5, PET 3, PET 4):

```
emit preview_pause (part.previewSec sec)
emit all part segments in order (question_numbers + question_stimuli)
emit PAUSE_SEC.BEFORE_REPEAT (5 sec)
emit repeat_cue ("Now listen again.")
emit PAUSE_SEC.BEFORE_REPEAT (5 sec)
emit all part segments AGAIN (second pass)
```

Between parts — the concat engine injects:

```
emit part_end ("That is the end of Part N.")
emit PAUSE_SEC.INTER_PART (10 sec)
emit pre_part_instruction pause (PAUSE_SEC.PRE_PART_INSTRUCTION, 5 sec)
emit part_intro of next part ("Now look at the instructions for Part N.")
```

### 6.6 Transfer-block handling

After the last part's second pass ends, the concat engine emits:

```
emit transfer_start ("You now have six minutes to write your answers on the answer sheet.")
emit PAUSE_SEC.TRANSFER_BLOCK_PREAMBLE silence (300 sec = 5 min)
emit transfer_one_min ("You have one more minute.")
emit PAUSE_SEC.TRANSFER_BLOCK_FINAL silence (60 sec = 1 min)
emit closing ("That is the end of the test.")
```

Total transfer block ≈ 6 min + spoken-segment lengths. In mock mode, the runner's 30-min timer runs concurrently and triggers auto-submit at zero. In practice mode, these segments are present in the audio but have no timer coupling.

### 6.7 Stream-proxy route (`/api/listening/[attemptId]/audio/route.ts`)

- `GET` with optional `Range` header
- Verify ownership — `TestAttempt.userId === session.user.id`
- Resolve `Test.audioR2Key`
- Stream from R2 via AWS SDK v3 `GetObjectCommand` with `Range` passed through
- Response headers: `Content-Type: audio/mpeg`, `Content-Length`, `Content-Range` (if range), `Accept-Ranges: bytes`, `Cache-Control: private, max-age=3600`
- On R2 404 → 404 with zh-CN message "音频加载失败"
- On R2 5xx → retry once, then 502

## 7. Runner UX

### 7.1 Routes

```
/ket/listening/new                       // picker: part / mode / scope
/ket/listening/runner/[attemptId]        // runner (mode + phase aware)
/ket/listening/result/[attemptId]        // result page with replay + tapescript
/pet/listening/new
/pet/listening/runner/[attemptId]
/pet/listening/result/[attemptId]
```

### 7.2 Mock-mode state machine

```
LOADING → READY → LISTENING → REVIEW → SUBMITTING → GRADED
         (click          (audio       (audio
          Start)          ends)        stopped,
                                       timer cont.)
```

- **LOADING** — progress bar, polls `/api/tests/:testId/status` every 1500 ms; shows elapsed generation time + message "Generating your listening test — usually takes 1–2 minutes"
- **READY** — pre-test briefing card: "Click Start when ready. 30-minute timer starts then. Audio plays twice per part, no pause, no scrub. The last 6 minutes are for review before auto-submit."
- **LISTENING** — audio plays auto (no controls), top bar shows server-synced `TimerBadge` (polls `/status` every 10 s for `remainingSeconds`); questions render per part; student may click ahead/back to view and answer any question; audio does NOT pause
- **REVIEW** — audio stopped; yellow banner "Review and Submit. Audio finished. Edit any answer. Auto-submit in MM:SS."; all inputs remain editable; `Submit Now` button visible
- **SUBMITTING** — client POSTs submit; server grades; writes `MistakeNote` rows
- **GRADED** — redirect to `/result/:attemptId`

**Auto-submit logic:** `TimerBadge` compares server `remainingSeconds` to 0; when zero, client fires `POST /submit { forceSubmit: true }` with current answer state. Server accepts if `elapsed <= timeLimit + 60_000` (1-min grace).

### 7.3 Practice-mode state machine

```
LOADING → READY → TAKING → SUBMITTING → GRADED
```

- **TAKING** — full-featured player (play/pause, ±10 s skip, speed 0.5–1.5×, scrub bar), per-segment replay buttons keyed off `Test.audioSegments`, tapescript toggle (default off), all inputs always editable, manual `Submit` button always present, no timer

### 7.4 Player control matrix

| Control | Mock · LISTENING | Mock · REVIEW | Practice · TAKING | Result |
|---|---|---|---|---|
| Play / Pause | no — auto-plays | n/a audio stopped | ✓ | ✓ |
| Scrub bar | ✗ | n/a | ✓ | ✓ |
| ±10 s skip | ✗ | n/a | ✓ | ✓ |
| Speed 0.5–1.5× | locked at 1.0 | n/a | ✓ | ✓ |
| Per-segment replay | ✗ | n/a | ✓ | ✓ |
| Tapescript | hidden | hidden | toggle (default off) | always visible |
| Timer visible | ✓ server-synced | ✓ yellow banner | hidden | — |

### 7.5 Components

Under `apps/web/src/components/listening/`:

- `<ListeningRunner mode attemptId>` — root, branches on mode
- `<AudioPlayer controls segments>` — ported from AB's `src/components/AudioPlayer.tsx`, extended with per-segment replay + speed + mode-aware disabled states
- `<QuestionRenderer type>` — one sub-component per question type
- `<TimerBadge syncInterval={10_000}>` — server-synced timer, auto-submit at 0
- `<TapescriptPanel segments currentSegmentId>` — collapsible, segment-level bold highlight
- `<GenerationProgress elapsedSec>` — LOADING state UI
- `<PhaseBanner phase="REVIEW">` — Mock phase-2 yellow banner

Keyboard shortcuts (practice mode only): `Space` = play/pause, `←/→` = ±10 s skip, `1–5` = jump to part N.

## 8. Result page + Phase 1 integrations

### 8.1 Result page (`/{portal}/listening/result/[attemptId]`)

1. **Top summary card** — raw `N/25`, scaled score (KET 100–150 with pass at 120, grade cut-offs per Cambridge scale; PET 120–170 with pass at 140), time taken, mode badge
2. **Audio replay player** — full controls, identical to practice TAKING state
3. **Tapescript panel** — fully visible, segment-level highlight synced to playback
4. **Per-question breakdown** — per question card: prompt → pictures/options → student answer → correct answer → zh-CN explanation → exam-point + difficulty-point chips → "Replay this audio segment" button seeks to `segment.startMs`
5. **Weak-points summary** — top 3 exam-points + top 3 difficulty-points from wrong answers (reuse Phase 1's `lib/grading.ts` deterministic aggregator)
6. **Footer actions** — `Redo` (reuses cached R2 audio — zero regen, creates new `TestAttempt`), `Back to portal`

### 8.2 Grading (`apps/web/src/lib/grading/listening.ts`)

Deterministic, no AI:
- **MCQ (picture + text + interview + scenario):** exact option-ID match
- **Gap-fill (open):** `input.trim().toLowerCase() === expected.trim().toLowerCase()` — exact match only after normalization (see §12.1)
- **Matching (5-to-8):** exact option-ID per row, all 5 must be independently correct for full credit, otherwise per-row 1 mark each

### 8.3 Mistake notes

On submit, for each wrong answer insert a `MistakeNote` row:
- `userId`, `attemptId`, `questionId` (stable within `Test.payload.parts[].questions[].id`)
- `userAnswer`, `correctAnswer`, `explanation` (zh-CN from `explanationZh`)
- `examPoint` (e.g., `"KET.L.Part1.gist"`), `difficultyPoint`
- `status = NEW`

Listening-kind derivation: join `MistakeNote → TestAttempt → Test.kind`. No schema change.

### 8.4 Unified `/history`

- Existing `/history` route adds a `Listening` chip to the kind-filter chip row
- Each listening attempt row shows: portal badge, part label (or "Full mock"), raw score (N/25), mode badge, completion date, `Redo` button
- `/history/mistakes` adds `Listening` to the kind filter

### 8.5 Teacher dashboards

- **Class overview (`/teacher/classes/[classId]`):** compact row added per student — `listening attempts count · listening avg score`; activity feed shows listening attempts with a small audio glyph
- **Per-student detail (`/teacher/classes/[classId]/students/[studentId]`):** score-trend chart gets a third line (reading / writing / listening) in distinct colors; existing kind-filter chips add `Listening`; per-kind breakdown card shows listening per-part avg across attempts; clicking an attempt opens the same `/ket/listening/result/:attemptId` in teacher-scoped read-only mode (reuse `lib/auth/canViewAttempt`)
- **Teacher AI analysis agent:** existing agent unchanged; system prompt adds a single sentence noting the `attempts` payload may now include listening kind — existing validators + 3-retry still apply

### 8.6 Assignments

- `Assignment.target` JSON already supports `{examType, part?, kind, minScore?}`; add `"LISTENING"` to allowed `kind` values in the Zod validator
- Teacher assignment-creation modal gets a "Listening" option in the kind dropdown
- Student portal home shows pending listening assignments alongside reading/writing
- Completion derived from `TestAttempt` (Phase 1 pattern)

### 8.7 Comments

No changes — existing teacher→student messaging works across all kinds.

## 9. Error handling + edge cases

### 9.1 Error taxonomy

| # | Failure mode | Handling |
|---|---|---|
| 1 | Python/DeepSeek 3× regenerate fail | `Test.audioStatus=FAILED`, `audioErrorMessage` set; UI shows retry; counts against 10/hr rate limit |
| 2 | edge-tts per-segment 3× fail | segment retry exhausted → whole generation FAILED |
| 3 | edge-tts token rotated by Microsoft | 403 surfaces → FAILED + observability alert |
| 4 | ffmpeg concat error | retry once; cleanup temp dir always |
| 5 | R2 upload failure | retry once with backoff; `AbortMultipartUpload` on partial |
| 6 | Concurrency overflow | semaphore waiting queue (max 5); beyond → 503 + zh-CN "系统繁忙，请稍后再试" |
| 7 | Stale `GENERATING` > 5 min | cron auto-marks FAILED (AB pattern) |
| 8 | Stream-proxy R2 404 | 404 → UI "音频加载失败，请重新生成" |
| 9 | Stream-proxy R2 5xx | retry once → 502 |
| 10 | Submit past timer + grace | server rejects with 400 + message "考试时间已结束" (client handled via auto-submit) |
| 11 | Submit DB write fail | 500 → client retries with idempotency key |
| 12 | Network loss mid-mock | server timer unaffected; expired-attempts cron (#19 in build order) force-submits |
| 13 | User closes browser during generation | background job continues; Test appears in `/history` when READY |
| 14 | Double-click "New test" | idempotency key `{userId, kind, minuteBucket}` within 2 s → dedupe |
| 15 | Expected voice missing at startup | health check at Next.js boot queries voice list, compares to `{Ryan, Sonia, Libby, Thomas}`; missing → log error + alert (fail-fast, no silent downgrade) |
| 16 | Gap-fill whitespace/case | normalize with `trim().toLowerCase()` (§8.2) |
| 17 | Partial audio (shouldn't happen) | `<audio>` error event → "音频加载失败，正在重启测试" → back to `/new` |
| 18 | Teacher views in-progress attempt | existing `AttemptStatus.IN_PROGRESS` gating blocks answer reveal (Phase 1 unchanged) |

### 9.2 User-facing error strings (zh-CN only)

- `生成听力测试失败，请重试`
- `音频加载失败，请刷新页面或返回重试`
- `考试时间已结束，答案已自动提交`
- `网络连接断开，请重新连接后重试`
- `每小时最多生成 10 次听力测试，请稍后再试`
- `系统繁忙，请稍后再试`
- `本次生成失败，请重新开始`

## 10. Build order

Each step is browser-verified with user sign-off before moving on. Follows Phase 1's 27-step pattern.

1. **Env + deps** — add `node-edge-tts`, `@aws-sdk/client-s3`, `ffmpeg-static`; create R2 bucket (`cambridge-ket-pet-audio`), configure CORS (Zeabur origin only), 180-day lifecycle rule on `listening/` prefix; add env vars per Appendix C
2. **Prisma schema + migration** — add `AudioStatus` enum and 5 fields on `Test`; run migration; verify Phase 1 still works
3. **Python `listening_generator` agent** — new module w/ Pydantic schemas + system prompt encoding §3 spec; unit tests
4. **Python `POST /listening/generate` endpoint** — wire agent + validators + 3× regenerate; pytest
5. **Node `lib/audio/` foundation** — `voices.ts`, `rubric.ts`, `edge-tts-client.ts`, `chunker.ts`, `concat.ts`, `r2-client.ts`, `segments.ts`, `queue.ts`; unit tests each
6. **Audio generation orchestrator** — `lib/audio/generate.ts`; end-to-end mock-generation dry run (uses fixture payload)
7. **Concurrency semaphore** — wired into generate.ts; load-test locally (spawn 10 simultaneous, verify max 3 concurrent)
8. **Stream-proxy route** — `app/api/listening/[attemptId]/audio/route.ts` with range-request passthrough; curl test scrubbing
9. **Generation API extension** — extend `app/api/tests/generate/route.ts` for `kind: LISTENING`; extend `/status` for audio state
10. **Runner — Mock mode** — `/{portal}/listening/runner/[attemptId]`: `ListeningRunner` root, locked `AudioPlayer`, `TimerBadge` w/ server sync + auto-submit, `<PhaseBanner>` for review phase; test all 7 question-type renderers
11. **Runner — Practice mode** — full `AudioPlayer`, per-segment replay, `TapescriptPanel`, keyboard shortcuts
12. **Result page** — `/{portal}/listening/result/[attemptId]`: summary card + replay + tapescript + per-question breakdown + weak points + Redo
13. **Grading** — `lib/grading/listening.ts`; submit route extension; MistakeNote row creation for wrong answers
14. **Mistake-notes integration** — `/history/mistakes` filter adds Listening; test NEW→REVIEWED→MASTERED lifecycle works
15. **History integration** — `/history` filter adds Listening; rows render w/ audio glyph
16. **Assignments integration** — `Listening` added to kind validator; teacher modal supports it; student portal home surfaces it
17. **Teacher dashboards** — class overview + per-student detail extended for listening; analysis agent prompt tweaked
18. **Rate limiting** — `GenerationEvent.kind="LISTENING"`; 10/hr/user enforced including failed gens
19. **Expired-attempt cron** — periodic job (every 5 min) scans `TestAttempt.status="IN_PROGRESS"` past `startedAt + timeLimit + 60s` → force-submit with current answers
20. **End-to-end browser validation** — run §11.3 verification plan with user
21. **Docs + env** — root README + `apps/web/README` + `services/ai/README` updates; `.env.example` updates; run-command documentation
22. **Phase 2 sign-off** — user confirms all flows work in local browser

## 11. Testing strategy

### 11.1 Python (pytest)

- `tests/test_listening_schema.py` — Pydantic happy + malformed
- `tests/test_listening_validators_ket.py` — 5 parts, per-part Q counts, per-type option counts
- `tests/test_listening_validators_pet.py` — 4 parts, 7/6/6/6 Q counts, interview vs dialogue structure
- `tests/test_listening_regenerate.py` — 3× retry on validator fail (mock DeepSeek with patched responses)
- Target: ≥ 80 % coverage on `listening_generator` + validators
- Phase 1's `test_writing_*.py` is the structural template

### 11.2 Node (vitest)

- `lib/audio/__tests__/voices.test.ts` — tag→voice mapping is total
- `lib/audio/__tests__/rubric.test.ts` — phrases have no `${...}` placeholders, only `partIntro(n)` / `partEnd(n)` accept arguments
- `lib/audio/__tests__/edge-tts-client.test.ts` — retry on mocked ECONNRESET (3× w/ backoff)
- `lib/audio/__tests__/concat.test.ts` — ffmpeg invoked with correct silence durations + concat list for each play-rule
- `lib/audio/__tests__/r2-client.test.ts` — upload + delete happy path (mocked `@aws-sdk/client-s3`)
- `lib/audio/__tests__/segments.test.ts` — timestamp math on synthetic concat list
- `lib/audio/__tests__/queue.test.ts` — semaphore allows max 3; 5 wait; 9th rejects
- `lib/grading/__tests__/listening.test.ts` — MCQ exact, gap-fill normalize + exact, matching per-row
- `app/api/listening/__tests__/audio.stream.test.ts` — ownership check; range passthrough (mocked R2)
- `app/api/tests/__tests__/submit.listening.test.ts` — grading + mistake-note creation; 1-min-grace; force-submit behavior
- **UI tests** (React Testing Library): `ListeningRunner.test.tsx` mode switching; `TimerBadge.test.tsx` server-sync polling + auto-submit at 0; `AudioPlayer.test.tsx` mode-aware controls; each `QuestionRenderer.*.test.tsx`

### 11.3 End-to-end browser verification (manual, with user)

**Student KET happy:** generate Part 1 practice → progress → take → submit → result → Redo reuses cached audio with zero wait; generate full mock → 30-min clock → review phase banner appears → manual submit → scaled score + weak-points

**Student PET happy:** generate Part 3 practice (gap-fill monologue) → per-segment replay in practice → edit → submit → tapescript reveal shows correct answers; full mock → let timer expire → auto-submit fires → result renders

**Teacher happy:** create listening assignment (PET Part 1, min 70 %) → student completes → teacher sees completion in class overview; per-student detail shows listening in score-trend chart + per-kind breakdown

**Negative:** generation failure (mock Python 500) → UI retry works, rate limit counts failure; edge-tts 3× fail → retry works; timer expiry with partial answers → auto-submit saves current; nav-away during gen → return → Test is READY; offline during mock → reconnect → submit works; same Test redo → cached audio returns instantly with zero TTS cost

### 11.4 Load testing (deferred)

Post-launch monitoring tracks: generation wall-clock p50/p95, ffmpeg process memory, R2 upload success rate, edge-tts ECONNRESET rate, stream-proxy 5xx rate. Load tests run if any metric crosses a threshold.

## 12. Open / deferred decisions

### 12.1 Gap-fill strictness — divergence from Cambridge

**Status:** Locked at exact-match with `trim().toLowerCase()` (D12). **Divergence:** Cambridge's real answer key accepts minor misspellings (verified: "waterfal" for "waterfall", "suger" for "sugar"). Our policy is stricter and may mark wrong what the real exam would accept. If teacher/student feedback flags this, swap to Levenshtein-1 in `lib/grading/listening.ts` in one commit — no schema or API change needed.

### 12.2 Publication-type data capture

**Status:** Deferred (D20). Once paper type is chosen, retrofit data-capture hooks (consent flow, anonymization, study-specific metric logging). Build order does not block on this.

### 12.3 Voice cloning for authentic RP

**Status:** Deferred. The 4 preset `en-GB-*` voices are British but not RP-labelled. If native-speaker quality check flags concerns, `lib/audio/voices.ts` is the single-file swap — replace preset names with `<speak><voice>…<voice>` cloned-voice references. Non-breaking change.

### 12.4 R2 custom domain / ICP 备案

**Status:** Stream-proxy via Zeabur avoids needing a custom R2 domain. If traffic grows and latency becomes a concern, revisit.

### 12.5 Accessibility

**Status:** Flagged. Mock mode is inherently inaccessible for deaf/hard-of-hearing users (audio-only stimulus). Practice mode's tapescript reveal provides an accessible alternative. Product page should flag this; not a build blocker.

## Appendix A — Tapescript cues for each Part, KET

Drawn from `A2 Key for Schools 2020 sample tests Listening - tape script.pdf` (Cambridge official, in `C:\Users\wul82\Desktop\剑桥英语\剑桥KET真题+教材\...\`). See §3.3 for verbatim hardcoded constants; the full per-part `AudioScript` shape is emitted by the Python agent per §6.2.

## Appendix B — Tapescript cues for each Part, PET

Drawn from `2020PET_Sample Test 1\2.真题答案\3.听力原文B1 Preliminary 2020 sample Listening - tape script.pdf`. Same structure as Appendix A.

## Appendix C — Environment variables

Additions to `.env.example` (both `apps/web/` and `services/ai/`):

```
# R2 (apps/web)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=cambridge-ket-pet-audio
R2_ENDPOINT=https://{accountId}.r2.cloudflarestorage.com

# ffmpeg
FFMPEG_BINARY=auto        # "auto" uses ffmpeg-static; override for Zeabur if needed

# Listening-specific (apps/web)
LISTENING_MAX_CONCURRENT=3
LISTENING_QUEUE_MAX=5
LISTENING_GEN_TIMEOUT_MS=300000      # 5 min stale-state timeout
LISTENING_RATE_LIMIT_PER_HOUR=10

# Timer (apps/web)
LISTENING_TIME_LIMIT_SEC=1800        # 30 min
LISTENING_GRACE_PERIOD_MS=60000      # 1 min grace (AB pattern)
```

## Appendix D — Git + deployment notes

- Commit strategy: per step (22 commits ± per Phase 1 pattern)
- Branch: all Phase 2 work on `main` (single-contributor project)
- No GitHub Actions changes required at this time
- Zeabur redeploy on each merged step (dev preview environments not used)
