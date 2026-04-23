# Phase 3 — Speaking Module (Anam AI) · Design

| | |
|---|---|
| **Status** | Draft — pending user approval |
| **Date** | 2026-04-24 |
| **Phase** | 3 of 4 |
| **Supersedes** | README §Phase 3 ("Qwen3.5-Omni-Realtime via DashScope") — platform changed to **Anam AI** |
| **Depends on** | Phase 2 (Listening) on `origin/phase2-listening` 2026-04-24 — Tests 1 & 4 passed; Tests 2/3/5 deferred to final E2E |

## 1. Context

The Cambridge KET/PET exam-prep web app has shipped Phase 1 (Reading + Writing) to production and Phase 2 (Listening) to branch `origin/phase2-listening` (Tests 1 & 4 signed off; Tests 2/3/5 deferred to the final Phase 2 E2E pass). Phase 3 adds the Speaking module — a live conversational experience where a student practises spoken English with an AI Cambridge examiner (persona name: **Sophie**) for both **KET (A2)** and **PET (B1)** levels.

Prior planning in the repo README anticipated DashScope's Qwen3.5-Omni-Realtime as the real-time speech/avatar vendor. This design **replaces that plan with [Anam AI](https://anam.ai)** — a real-time WebRTC video avatar platform. The student's browser streams a photorealistic talking-head video of Sophie with sub-second turn latency; our app owns the LLM brain (DeepSeek) via Anam's custom-LLM mode, so Cambridge-aligned examiner behaviour and rubric scoring stay in our control.

As in earlier phases the project is non-commercial and research-grade; infrastructure costs are paid by the project owner.

## 2. Goals + scope

### 2.1 In scope

- KET Speaking — 2-part format adapted from the real paired exam into a **solo-with-examiner** flow (~8–10 min per attempt)
- PET Speaking — 4-part format adapted into solo-with-examiner (~10–12 min per attempt)
- Both portals (`/ket/speaking/*` and `/pet/speaking/*`)
- Live conversational practice via Anam real-time video avatar (Sophie), BYO-LLM backed by DeepSeek
- Post-session rubric scoring on all four Cambridge Speaking criteria: **Grammar & Vocabulary**, **Discourse Management**, **Pronunciation** (inferred from transcript patterns), **Interactive Communication**
- Weak-point extraction reusing Phase 2's `weakPoints` data shape and dashboard component
- Hybrid test content model — per-attempt DeepSeek generation as default, with nullable `Test.userId` leaving room for teacher-curated shared tests
- Curated R2 photo library (~50 tagged images) used for PET Part 2 photo-description prompts (and KET Part 2 when visual aids help)
- Two examiner personas (`KET examiner` / `PET examiner`) with distinct system prompts; same Sophie avatar + British voice; IDs configurable via env
- Integration with existing systems — auth (Auth.js), user model, teacher class views, `TestAttempt` history, `GenerationEvent` rate limiting, dashboard tiles

### 2.2 Out of scope (deferred)

- Faithful 2-candidate exam simulation (examiner + fake partner avatar). Solo-with-examiner only — the "paired" parts are adapted into extended Q&A with the examiner.
- Audio playback of the student's own session on the result page (would require recording the mic stream + R2 storage; deferred per product decision).
- AI-generated photo prompts. MVP uses a curated stock library. AI generation via SiliconFlow/FLUX is a fast-follow.
- Live (in-turn) scoring — scoring happens post-session only.
- In-conversation pronunciation feedback using real audio analysis. Pronunciation is inferred from transcript artifacts (hesitations, filler words, incomplete tokens) only.
- Playwright E2E automation. Real-browser dev testing + manual checklist is the verification path; CI automation deferred.
- Teacher-curated shared test bank UI. Data model leaves room for it (`Test.userId IS NULL`), but the admin flow is not built in this phase.
- China-specific edge / fallback routing. Anam has no documented APAC edge. We proceed as if the student's browser reaches Anam's US/EU endpoints; if real users in mainland China report degraded experience, we add a fallback in a follow-up phase.
- Vocab / Grammar modules (Phase 4).

### 2.3 Success criteria (used as step-level sign-off gates)

- Student can complete a full KET Speaking attempt (2 parts) end-to-end in the browser, with Sophie's avatar visible and responsive.
- Same for PET Speaking (4 parts, adapted from paired parts to extended Q&A).
- Per-turn latency (student stops speaking → first Sophie audio audible) averages **≤ 1.3s** for a SEA/EU-networked tester and **≤ 2.5s** for a China-networked tester. Measured on at least one real session per level before sign-off.
- Session ends naturally via examiner's `[[SESSION_END]]` sentinel in ≥ 95% of completed attempts — the student should never need to click "Submit".
- Result page renders all four rubric scores, overall band, weak points in Phase 2's existing component shape, and full transcript, within 30s of session end on the happy path.
- Anam API key never leaves the server; all Anam calls from the browser use short-lived session tokens.
- No regressions in Phase 1 / Phase 2 features after merge.
- Test suites green: new Vitest suites for API routes + speaking lib; new pytest suites for `speaking_generator` + `speaking_scorer`.
- Phase 3 sign-off includes a browser verification of both KET and PET happy paths with a real mic.

## 3. Exam format adaptation

Cambridge Speaking is a 3-party exam (one examiner + two candidates). Our Phase 3 is **solo-with-examiner** — the examiner leads the student through all parts alone. Paired discussion parts are transformed into extended interactive Q&A. This matches how most online KET/PET prep apps handle solo practice.

### 3.1 KET Speaking — solo-with-examiner flow

| Part | Real-exam design | Our adaptation | Minutes |
|---|---|---|---|
| 1 | Examiner asks each candidate personal questions (name, family, daily life) | Examiner asks the student ~6 personal/daily-life questions with one follow-up each | ~3 |
| 2 | Candidate-to-candidate discussion with a visual prompt | Examiner leads an extended discussion around a **photo prompt** — describe what you see, then questions about preferences and opinions | ~5 |

Total ~8–10 min.

### 3.2 PET Speaking — solo-with-examiner flow

| Part | Real-exam design | Our adaptation | Minutes |
|---|---|---|---|
| 1 | Examiner interviews each candidate | Examiner asks ~5 personal/experience questions with one follow-up each | ~2 |
| 2 | Individual 1-minute photo description | **Unchanged** — examiner presents a photo, student describes for ~1 min, one clarifying follow-up | ~3 |
| 3 | Candidate-to-candidate collaborative task with visual | Examiner presents the same visual scenario and leads a collaborative-style discussion ("Let's think about which of these options would be best...") | ~3 |
| 4 | Candidate-to-candidate topic discussion extending Part 3 | Examiner extends Part 3 topic into an opinion discussion — "What do you think about ___?" | ~2 |

Total ~10–12 min.

### 3.3 Cambridge rubric criteria (used by the scorer)

Per published Cambridge criteria:

- **Grammar & Vocabulary** (0–5): accuracy, range, appropriacy for level.
- **Discourse Management** (0–5): coherence, extended stretches of speech, topic development.
- **Pronunciation** (0–5): intelligibility, word/sentence stress, individual sounds. Inferred from transcript patterns (hesitations, fillers, incomplete words, spelling-like artifacts from STT). Acknowledged MVP limitation.
- **Interactive Communication** (0–5): initiating and responding, maintaining the exchange, asking for clarification. Inferred from turn-taking patterns and responsiveness to examiner prompts.

Overall band = weighted average (weights documented in `prompts/speaking_scorer_system.py`; simple average acceptable for MVP).

## 4. Locked architecture decisions

| Decision | Value | Rationale |
|---|---|---|
| Real-time vendor | Anam AI | Full WebRTC avatar pipeline, BYO-LLM support, low-code client SDK |
| LLM brain | DeepSeek via `llmId: "CUSTOMER_CLIENT_V1"` | Full control over examiner prompt + rubric; reuses Phase 2 AI stack; keeps scoring transcript server-side |
| Format | Solo-with-examiner | Matches online prep convention; Anam = 1 persona/session makes 2-candidate faithful simulation impractical |
| Scope | Both KET and PET | Mirror Phase 2 |
| Scoring timing | Post-session only | Mirror Phase 2; avoids doubling LLM cost and distracting the examiner |
| Examiner behaviour | Coaching style | Student preference — real Cambridge examiners don't coach, but this is practice mode |
| Test content | Hybrid (per-attempt generation default, shared bank possible) | Mirror Phase 2 |
| Visual prompts | Curated R2 library | Zero runtime cost; reliable; AI generation is a follow-up |
| Personas | Two (KET + PET) | Level-appropriate pacing + language; same Sophie avatar + voice |
| Transcript source | Anam server-side (primary) + client-side buffer (fallback) | Reliability + latency trade-off |
| Session end | Examiner `[[SESSION_END]]` sentinel → auto-submit; student "End Test" button; `sendBeacon` on unload | No manual submit in happy path; safety nets for everything else |
| No audio recording | Confirmed | Cuts scope; privacy simpler; follow-up if teachers request |
| Data model | Extend `Test` + `TestAttempt` with speaking fields (nullable) + `SpeakingStatus` enum; no new tables | Matches Phase 2 pattern; unified dashboard |
| Testing | Unit + integration + browser dev + manual checklist; no CI Playwright for MVP | Matches Phase 2 approach; CI audio is infeasible |

## 5. Data model changes (additive Prisma migration)

```prisma
enum SpeakingStatus {
  IDLE
  IN_PROGRESS
  SUBMITTED
  SCORING
  SCORED
  FAILED
}

model Test {
  // ...existing fields

  speakingPrompts   Json?     // per-part script (see §5.1)
  speakingPhotoKeys String[]  // R2 keys, e.g. ["speaking/photos/kitchen-02.jpg"]
  speakingPersona   String?   // "KET" | "PET"
}

model TestAttempt {
  // ...existing fields

  transcript      Json?            // full turn history at submit time (see §5.2)
  rubricScores    Json?            // {grammarVocab, discourseManagement, pronunciation, interactive, overall}
  anamSessionId   String?          // for debugging / manual transcript pull
  speakingStatus  SpeakingStatus?
  speakingError   String?
}
```

No new tables. `weakPoints`, `rawScore`, `scaledScore` are reused from Phase 2. Existing index on `TestAttempt [userId, startedAt]` is sufficient.

### 5.1 `speakingPrompts` JSON shape

```json
{
  "level": "KET",
  "parts": [
    {
      "partNumber": 1,
      "title": "Interview",
      "targetMinutes": 2,
      "examinerScript": [
        "What's your name?",
        "Where do you live?",
        "Tell me about your family."
      ],
      "coachingHints": "Encourage full sentences. One follow-up per answer.",
      "photoKey": null
    },
    {
      "partNumber": 2,
      "title": "Photo description and discussion",
      "targetMinutes": 5,
      "examinerScript": [
        "Now, I'd like you to describe this photo.",
        "What do you think the people are doing?"
      ],
      "coachingHints": "If student stops early, prompt with 'What else can you see?'",
      "photoKey": "speaking/photos/park-03.jpg"
    }
  ]
}
```

### 5.2 `transcript` JSON shape

```json
[
  {"role": "assistant", "content": "Hello! What's your name?", "ts": "2026-04-24T10:00:00Z", "part": 1},
  {"role": "user", "content": "My name is Li Wei.", "ts": "2026-04-24T10:00:05Z", "part": 1},
  {"role": "assistant", "content": "Nice to meet you, Li Wei. Where do you live?", "ts": "2026-04-24T10:00:07Z", "part": 1}
]
```

`role` uses OpenAI-compatible `user`/`assistant`. `part` is set by the server based on inferred state when the transcript is persisted. `ts` is Anam server-side turn timestamp when available; else client capture time.

### 5.3 `rubricScores` JSON shape

```json
{
  "grammarVocab": 3,
  "discourseManagement": 4,
  "pronunciation": 3,
  "interactive": 4,
  "overall": 3.5,
  "justification": "…short per-criterion notes from the scorer…"
}
```

`weakPoints` is written alongside, identical shape to Phase 2:

```json
[
  {"tag": "grammar.past_simple", "quote": "I go to school yesterday", "suggestion": "went"},
  {"tag": "vocab.connectives", "quote": "...", "suggestion": "..."}
]
```

## 6. External integrations

### 6.1 Anam AI

**Flow:**
1. Server mints a per-attempt session token: `POST https://api.anam.ai/v1/auth/session-token` with `{ personaConfig: { name, avatarId, voiceId, llmId: "CUSTOMER_CLIENT_V1", systemPrompt, languageCode: "en" } }`. API key stays server-side.
2. Client loads `@anam-ai/js-sdk` (npm), calls `createClient(sessionToken)`, then `streamToVideoElement("persona-video")` — opens WebRTC to `connect.anam.ai` / `connect-us.anam.ai` / `connect-eu.anam.ai`.
3. Mic is auto-captured by the SDK.
4. On every user turn end, Anam STT completes and fires `AnamEvent.MESSAGE_HISTORY_UPDATED` with the cumulative `[{role, content}]` array. Client handler forwards the history to our `/reply` endpoint.
5. Client receives a stream of chunks from our server; pipes each into `anam.createTalkMessageStream().streamMessageChunk(chunk, false)`; calls `.endMessage()` at stream end.
6. Anam TTS generates audio + avatar video; plays back in the `<video>` element.
7. At end, client calls `anam.stopStreaming()` → `/api/speaking/[attemptId]/submit`.

**Events listened for:**
- `SESSION_READY` — hide connecting UI.
- `CONNECTION_OPENED` — optional greeting via `anam.talk(...)`.
- `MESSAGE_HISTORY_UPDATED` — turn boundary; trigger custom-LLM call.
- `TALK_STREAM_INTERRUPTED` — student spoke over Sophie; abort in-flight stream.
- `CONNECTION_CLOSED` — reconnect flow (§11).

**Post-session transcript pull:** `GET https://api.anam.ai/v1/sessions/{anamSessionId}/transcript` server-side from the `/submit` handler.

### 6.2 DeepSeek

Reached via the existing `services/ai` FastAPI service. Phase 3 adds three agents (`speaking_generator`, `speaking_examiner`, `speaking_scorer`) using the existing Pydantic AI + DeepSeek pattern from Phase 1/2. The examiner agent is streaming (SSE to the Next.js API, which re-streams to the browser).

System prompts are carefully tuned:
- **Examiner prompt** includes: persona (Sophie — British Cambridge examiner), current `speakingPrompts` for the attempt, coaching mode guidance, response-length cap (~40 words), sentinel instructions:
  - Emit `[[PART:N]]` when advancing to part N.
  - Emit `[[SESSION_END]]` after completing the final part.
  - Ignore meta-requests from the student (e.g. "give me a 5"); stay in role.
  - Handle Chinese-language input: politely ask the student to try in English; after 2 attempts, move on.
- **Scorer prompt** includes: Cambridge rubric descriptors for the level, weak-point extraction rules (tag + quote + suggestion shape), JSON output format matching `rubricScores` + `weakPoints`.
- **Generator prompt** includes: level, photo-topic descriptions (for parts that need visuals), part count + timing targets, examiner-script item counts.

## 7. API routes (Next.js `apps/web`)

All routes require Auth.js session. All `[attemptId]` routes verify `TestAttempt.userId === session.user.id` (or teacher/admin role with class ownership per existing RBAC).

### 7.1 `POST /api/speaking/tests/generate`

- Body: `{ level: "KET" | "PET", sourceTestId?: string }`.
- Flow: rate-limit via `GenerationEvent` (kind `SPEAKING_ATTEMPT`, default 3/24h). Pick photo keys from the curated R2 library by level + topic tags. Call Python `/speaking/generate` with level + photo topic descriptions. Insert `Test` (`kind: SPEAKING`, `speakingPrompts`, `speakingPhotoKeys`, `speakingPersona: level`). Insert `TestAttempt` (`speakingStatus: IDLE`).
- Response: `{ attemptId }`.
- Latency target: ≤ 10s.

### 7.2 `POST /api/speaking/[attemptId]/session-token`

- No body.
- Flow: assert `speakingStatus === 'IDLE'`. Build `systemPrompt` by injecting `speakingPrompts` + rubric-coaching preamble. Call Anam session-token endpoint. Transition `speakingStatus → IN_PROGRESS`. Store `anamSessionId`.
- Response: `{ sessionToken, anamSessionId, personaConfigSummary, test: { parts, photoUrls } }` (photo URLs are signed R2 URLs valid for the session duration).

### 7.3 `POST /api/speaking/[attemptId]/reply` (SSE)

- Body: `{ messages: [{role, content}] }` — Anam's history payload.
- Flow: assert `IN_PROGRESS`. Forward to Python `/speaking/examiner` with the history + attempt's script context. Stream NDJSON chunks `{ "content": "..." }\n` back to the browser. No DB writes.
- Headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.
- Timeout: 30s hard cap per turn; abort and return error chunk if DeepSeek stalls.

### 7.4 `POST /api/speaking/[attemptId]/submit`

- Body: `{ transcript?: [...] }` (optional; Anam pull is primary).
- Flow: **idempotent** — if `speakingStatus` already past `IN_PROGRESS`, return `{ ok: true }` immediately.
  1. Attempt `GET https://api.anam.ai/v1/sessions/{anamSessionId}/transcript`.
  2. On success or non-empty: persist Anam transcript → `transcript`.
  3. On fail or empty: fall back to `transcript` from request body.
  4. If both empty: `speakingStatus: FAILED`, `speakingError = "No transcript captured"`.
  5. Else: `speakingStatus: SUBMITTED`; fire scoring asynchronously (`waitUntil` + Python `/speaking/score`).
  6. During scoring: `speakingStatus: SCORING`. On success: write `rubricScores`, `rawScore`, `scaledScore`, `weakPoints`, `speakingStatus: SCORED`. On failure: `FAILED`.
- Response: `{ ok: true }`. Client redirects to result page which polls status.

### 7.5 `GET /api/speaking/[attemptId]/status`

- Response: `{ speakingStatus, rubricScores?, speakingError? }`. Polled by the result page every 2s until `SCORED` or `FAILED` (max 2 min hard timeout).

### 7.6 `GET /api/speaking/tests/bank?level=KET|PET` *(stretch — not required for MVP)*

Shared test listing. Out of scope if time-constrained.

## 8. Python services/ai additions

```
services/ai/app/
  main.py                                    # + POST /speaking/generate, /examiner (stream), /score
  agents/
    speaking_generator.py                    # Pydantic AI agent → SpeakingPrompts
    speaking_examiner.py                     # Streaming turn handler
    speaking_scorer.py                       # Rubric + weak-points → SpeakingScore
  prompts/
    speaking_generator_system.py
    speaking_examiner_system.py
    speaking_scorer_system.py
  schemas/speaking.py                        # SpeakingPrompts, SpeakingScore, SpeakingTurn
  validators/speaking.py                     # Guardrails on LLM outputs
```

DeepSeek client is already wired per Phase 1/2. `DASHSCOPE_API_KEY` slot is removed from `.env.example` and the main.py health check.

## 9. Runner UX

### 9.1 Page flow

```
/{ket|pet}/speaking/new
      ↓ Start Test (mic + connection check; POST /tests/generate)
/{ket|pet}/speaking/runner/[attemptId]
      ↓ [[SESSION_END]] sentinel  OR  End Test button  OR  beforeunload beacon
/{ket|pet}/speaking/result/[attemptId]
      ↓ poll status until SCORED
[result render]
```

### 9.2 `/new` — pre-flight

- Confirmation copy + mic-permission prompt.
- Record-and-playback mic test (student hears themselves for ~2s).
- Ping test to `api.anam.ai` — warn if > 500ms.
- "Start Test" button disabled until mic OK.
- Click triggers `/tests/generate`; shows "Preparing your test…" spinner (~5–10s); routes to runner.

### 9.3 `/runner/[attemptId]` — live conversation

- **Layout: avatar-primary.** `<video id="persona-video">` is the central element. Sophie speaks and listens.
- **Photo panel: inline, below/next to examiner prompt.** Appears only for parts whose `speakingPrompts[].photoKey` is non-null (PET Part 2 always; KET Part 2 optionally). Fades in when the part begins, fades out when the part ends.
- **Part progress bar** top: "Part X of N" with dots. Increments on `[[PART:N]]` marker.
- **Status pill**: `connecting` / `listening` / `thinking` / `speaking` — minimal, unobtrusive.
- **End Test button** top-right, small; confirm dialog.
- **No live transcript ticker.** Intentional — keeps student's eyes on the avatar (exam-realistic).
- **No debug controls in production UI.** Dev-only affordances live behind env flags.

### 9.4 Client state machine

```
INIT → PREFLIGHT → AWAITING_TOKEN → CONNECTING → READY →
  (listening ⇄ thinking ⇄ speaking loops) → ENDING → SUBMITTED → redirect
                                                ↑
                                    [[SESSION_END]] | End Test | unload
```

### 9.5 Client responsibilities

- Listen for `MESSAGE_HISTORY_UPDATED` → POST to `/reply` → pipe NDJSON chunks into `talkStream.streamMessageChunk`; strip `[[PART:N]]` and `[[SESSION_END]]` sentinels from what's *spoken* (they control UI/flow, not speech).
- Maintain a local transcript array as a submit fallback.
- `beforeunload` handler fires `navigator.sendBeacon('/api/speaking/[attemptId]/submit', { transcript })`.
- Safety cap: if total elapsed > (target minutes + 3), auto-submit regardless of `[[SESSION_END]]`.

## 10. Result page + integrations

- Polls `/status` every 2s until `SCORED` (hard cap 2min).
- Renders: **Overall band**, **four rubric scores** (progress bars), **Weak points** (reuse Phase 2 `<WeakPointsList>` component), **Collapsible transcript**.
- Top actions: **Retake** (returns to `/new`), **Back to dashboard**.
- No audio playback.

Portal integrations:
- `/ket` and `/pet` portal pages gain a **Speaking** tile linking to `/new`.
- `/history` and `/class` teacher views already aggregate `TestAttempt` by `kind` — `SPEAKING` entries render with a speech-bubble icon; rubric scores shown inline.
- Teacher per-student detail page renders the speaking transcript (reuse the `<TranscriptViewer>` built for the result page).

## 11. Error handling + edge cases

### 11.1 Pre-session

| Failure | Handling |
|---|---|
| Mic permission denied | `/new` shows clear "Allow microphone" instructions; cannot proceed |
| Poor network (ping > 500ms) | Warning banner on `/new`; proceed allowed |
| `/tests/generate` fails | Inline error + retry button; `TestAttempt` not created |
| `/session-token` fails (Anam 4xx/5xx) | `speakingStatus: FAILED`, redirect to `/new` with error |

### 11.2 Mid-session

| Failure | Handling |
|---|---|
| WebRTC disconnect | One auto-reconnect. If still failing → "Connection lost" modal with Resume (new token, same attempt) or End Test (partial submit) |
| Anam session cap reached | Friendly "time limit reached" message; auto-submit partial |
| `/reply` fails mid-turn | Fallback line via `anam.talk("One moment, let me think...")` + retry once; second fail → skip to next part |
| 20s student silence | Examiner: "Take your time. Would you like me to repeat the question?" |
| Repeat STT garbage (< 3 chars twice) | Examiner: "Sorry, I didn't catch that — could you speak up?" |
| Browser crash / close | `sendBeacon` submit with locally-buffered transcript |
| Duplicate tabs on same attempt | `/session-token` 409 on second tab |

### 11.3 Submit / scoring

| Failure | Handling |
|---|---|
| Anam transcript pull fails AND client transcript empty | `FAILED`, "No transcript captured", Retake button on result page |
| Scoring LLM fails | `FAILED`; Retry on result page re-runs scoring on persisted transcript |
| Submit called twice | Idempotency on `speakingStatus` state; second call no-op |
| Scoring > 30s | "Still scoring…" continue polling; hard timeout 2 min |

### 11.4 Examiner behaviour edges

| Case | Handling |
|---|---|
| Whole part silent | Examiner moves on after 60s silence; part scores 0 |
| Student tries to game examiner | System prompt instructs stay-in-role; never reveal scores |
| Student speaks Chinese | Examiner asks in English × 2; moves on third time |
| Student asks to skip | Examiner declines, continues |
| `[[SESSION_END]]` never fires | Client safety cap at (target + 3) min |

## 12. Performance requirements

All derived from the turn-latency budget (Anam VAD + STT + our LLM round-trip + Anam TTS + avatar render). Implementation MUST include all five mitigations:

1. **Warm-up ping** — `/speaking/examiner` gets a no-op ping from the runner page while Anam is connecting. Avoids cold-start on first turn.
2. **Aggressive streaming** — pipe every DeepSeek chunk into `talkStream.streamMessageChunk` the moment it arrives. No batching, no buffering.
3. **Anam VAD tuning** — `endOfSpeechSensitivity: 0.6` (balanced). Configurable via env `ANAM_VAD_SENSITIVITY`.
4. **Concise examiner** — system prompt caps responses at ~40 words. `max_tokens: 150` as a hard limit.
5. **Short DeepSeek output** — scorer prompt encourages tight justifications (≤ 30 words per criterion).

**Measurement:** log `turnLatencyMs` (server-observable: request-receive to stream-complete) per turn. Aggregate in logs for post-hoc analysis. No live dashboard for MVP.

## 13. Security + cost controls

### 13.1 Secret handling

- `ANAM_API_KEY` — server-side only. Never exposed to browser.
- Session tokens are per-attempt, short-lived, held in browser memory (not localStorage).
- DeepSeek key continues to live in `services/ai/.env` (Phase 2 convention).

### 13.2 Auth + RBAC

- Every speaking route calls `auth()`; every `[attemptId]` route asserts ownership.
- Teacher access mirrors Phase 2 (class → class members → attempts).

### 13.3 Transcript privacy

- Transcripts may include PII shared during Part 1 interviews. Stored as JSON in Postgres, same access pattern as other `TestAttempt` data.
- Not sent to third parties beyond DeepSeek (for scoring).
- No dedicated retention policy in Phase 3 — inherits Phase 2 policy.

### 13.4 Rate limiting

- `GenerationEvent` extended with `kind: SPEAKING_ATTEMPT`. Default 3/24h per student. Configurable.
- `/session-token` double-checks `speakingStatus === 'IDLE'` — prevents token-minting abuse.
- Admin role bypass for testing.

### 13.5 Logging

- Structured events: `speaking.attempt.created`, `speaking.session.opened`, `speaking.reply.streamed` (with `turnLatencyMs`), `speaking.submit.received`, `speaking.transcript.source` (anam | client | missing), `speaking.score.complete`.
- No transcript content in logs. Error logs include trimmed error messages only.

### 13.6 Cost controls

- `ANAM_SESSION_TIMEOUT_SECONDS` default 900 (15 min safety net).
- `max_tokens: 150` per examiner reply — typical 40-turn session uses < 5k tokens.
- Scoring ~3k input + ~500 output tokens per attempt — negligible.
- Primary cost driver: Anam minutes. Sized accordingly against chosen Anam tier.

### 13.7 Env vars (new)

Added to `apps/web/.env` (and `.env.example`):

```
ANAM_API_KEY=
ANAM_API_BASE=https://api.anam.ai
ANAM_SOPHIE_AVATAR_ID=
ANAM_SOPHIE_VOICE_ID=
ANAM_SESSION_TIMEOUT_SECONDS=900
ANAM_VAD_SENSITIVITY=0.6
```

`DASHSCOPE_API_KEY` is removed (speaking no longer uses DashScope).

## 14. File layout

```
apps/web/
  prisma/schema.prisma                                 [+ speaking fields, enum]
  src/app/
    ket/speaking/{new,runner/[attemptId],result/[attemptId]}/page.tsx
    pet/speaking/{new,runner/[attemptId],result/[attemptId]}/page.tsx
    api/speaking/
      tests/generate/route.ts
      tests/bank/route.ts                              [stretch]
      [attemptId]/{session-token,reply,submit,status}/route.ts
  src/lib/speaking/
    anam-client.ts                                     [server: mint session tokens, pull transcripts]
    session-state.ts                                   [part inference, sentinel parsing]
    transcript-source.ts                               [anam → client fallback]
    photo-library.ts                                   [curated R2 lookups]
    persona-config.ts                                  [build Anam personaConfig per attempt]
    scoring-client.ts                                  [call services/ai]
  src/components/speaking/
    SpeakingRunner.tsx
    AnamVideoPanel.tsx
    PhotoPanel.tsx
    PartProgressBar.tsx
    StatusPill.tsx
    MicPermissionGate.tsx
    ConnectionTest.tsx
    SpeakingResult.tsx
    RubricBar.tsx
    TranscriptViewer.tsx

services/ai/app/
  main.py                                              [+ /speaking/* routes]
  agents/{speaking_generator,speaking_examiner,speaking_scorer}.py
  prompts/speaking_{generator,examiner,scorer}_system.py
  schemas/speaking.py
  validators/speaking.py

R2: speaking/photos/*                                  [~50 tagged images, seeded]

docs/superpowers/specs/2026-04-24-phase3-speaking-anam-design.md  [this file]
```

## 15. Build order

Each step is commit-per-task with test-fix-verify in between.

1. **Schema + migration.** Add speaking fields + enum. `prisma generate`, migrate local DB.
2. **Photo library seeding.** Upload ~50 tagged photos to R2 under `speaking/photos/`. Seed `photo-library.ts` registry.
3. **Python: speaking schemas + `speaking_generator`.** Pydantic models. Generator agent. Unit tests with mocked DeepSeek.
4. **Python: `speaking_scorer`.** Scorer agent + prompt. Unit tests with handcrafted transcripts (empty, Chinese, short, normal).
5. **Python: `speaking_examiner`.** Streaming examiner. Minimal unit tests (prompt-building only; streaming behaviour is integration-tested).
6. **Python: `main.py` routes** for `/speaking/generate`, `/examiner`, `/score`. Pytest integration tests with a fake DeepSeek streaming server.
7. **Next.js: `lib/speaking/anam-client.ts`** — session-token mint + transcript pull. Vitest with mocked Anam HTTP.
8. **Next.js: `POST /api/speaking/tests/generate` route.** Vitest coverage.
9. **Next.js: `POST /api/speaking/[attemptId]/session-token` route.** Vitest coverage.
10. **Next.js: `POST /api/speaking/[attemptId]/reply` SSE route.** Vitest coverage for stream shape.
11. **Next.js: `POST /api/speaking/[attemptId]/submit` route.** Idempotency + transcript-source-selection tests.
12. **Next.js: `GET /api/speaking/[attemptId]/status` route.**
13. **Minimum runner UX.** Static `/runner/[attemptId]` that opens a session and completes a one-turn conversation. Verify in browser with real Anam + real DeepSeek.
14. **Full runner UX.** Photo panel, progress bar, status pill, sentinel handling, end-test button, beacon submit.
15. **`/new` pre-flight page.** Mic test + ping test + generate flow.
16. **Result page.** Poll status, render rubric + weak points + transcript. Reuse Phase 2 components where applicable.
17. **Rate limiting + FAILED paths.** Wire `GenerationEvent`, test all error transitions.
18. **Dashboard integration.** Speaking tiles on portals, Speaking attempts in `/history` and teacher views.
19. **End-to-end manual verification.** Real browser + mic for both KET and PET on both Chinese and SEA/EU networks (or surrogate). Measure per-turn latency. Checklist doc in `docs/superpowers/specs/phase3-speaking-manual-test.md`.
20. **Phase 3 sign-off.** User verification + merge.

## 16. Testing strategy

| Layer | What runs | Uses real vendors? |
|---|---|---|
| Unit (Vitest / pytest) | Route handlers, agents, utilities | No — mocked |
| Integration (Vitest + Postgres) | End-to-end API flows, transcript-source fallback, idempotency | No — mocked Anam HTTP + fake DeepSeek |
| **Browser dev** | `pnpm dev`, real Sophie conversation | **Yes — real Anam + DeepSeek + real mic** |
| Manual pre-ship QA | Checklist in staging | Yes — full stack |
| CI E2E | *Not built for MVP* — deferred | — |

Contract tests against real Anam / DeepSeek APIs are deferred: in-browser dev testing is the primary verification, so vendor-API drift will surface immediately in manual runs.

## 17. Open / deferred decisions

- **AI-generated photo prompts** via SiliconFlow/FLUX. Follow-up — likely Phase 3.5.
- **Audio recording + playback** on result page. Follow-up if teachers request.
- **2-candidate faithful simulation** (examiner + fake partner avatar). Possibly Phase 3.5 if students ask; significant engineering (session switching / Pipecat integration / partner persona + voice).
- **Chinese-audience fallback path** if Anam latency from mainland China proves unacceptable. Budget for possible HeyGen China / SenseAvatar / text-only-mode fallback based on real-user data.
- **Teacher-curated shared test bank UI.** Data model supports it (`Test.userId IS NULL`); admin flow TBD.
- **Live pronunciation analysis.** Requires client-side audio capture → ASR-with-phoneme-confidence. Not in MVP.
- **Strict "exam mode" toggle** (examiner does not coach). Cambridge-faithful practice mode. Might be added based on teacher feedback.

## 18. Risks

- **Anam latency from mainland China** — no APAC edge documented. Mitigation: measure with real Chinese users during build; fall back to text/voice-only mode if unacceptable.
- **Anam pricing sensitivity** — real KET/PET sessions are 8–12 min; Free/Starter tiers cap at 3–5 min. Requires Anam Explorer (10-min cap, 250 min/mo) minimum; Growth (unlimited session, 2,000 min/mo) recommended for production.
- **Pronunciation scoring accuracy** — we infer from transcript, not audio. Acknowledged MVP limitation; document clearly to users/teachers.
- **DeepSeek streaming reliability** — single-provider dependency. Mitigation: retry once on `/reply` failure; fall back to a polite examiner line to preserve conversation flow.
- **WebRTC fragility on mobile** — tab-backgrounded mobile browsers drop WebRTC. Recommend desktop for MVP; note in pre-flight UI.
- **PII in transcripts** — students may share names / addresses / school names. Inherited Phase 2 data policy covers this; explicitly flag to students in the `/new` consent copy.
