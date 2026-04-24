# Phase 3 — Speaking Module (Akool) · Design

| | |
|---|---|
| **Status** | Draft — pending user approval |
| **Date** | 2026-04-24 (Akool pivot 2026-04-25) |
| **Phase** | 3 of 4 |
| **Supersedes** | README §Phase 3 ("Qwen3.5-Omni-Realtime via DashScope") — platform changed to **Akool**. Earlier Anam-AI draft (`2026-04-24-phase3-speaking-anam-design.md`, commit `e199acf`) is replaced by this document. |
| **Depends on** | Phase 2 (Listening) on `origin/phase2-listening` 2026-04-24 — Tests 1 & 4 passed; Tests 2/3/5 deferred to final E2E |

## 1. Context

The Cambridge KET/PET exam-prep web app has shipped Phase 1 (Reading + Writing) to production and Phase 2 (Listening) to branch `origin/phase2-listening` (Tests 1 & 4 signed off; Tests 2/3/5 deferred to the final Phase 2 E2E pass). Phase 3 adds the Speaking module — a live conversational experience where a student practises spoken English with an AI Cambridge examiner (persona name: **Mina**) for both **KET (A2)** and **PET (B1)** levels.

Prior planning in the repo README anticipated DashScope's Qwen3.5-Omni-Realtime as the real-time speech/avatar vendor. This design **replaces that plan with [Akool](https://akool.com)** — a managed streaming-avatar platform that exposes a WebRTC-based conversational avatar with built-in STT, TTS, VAD, and interrupt handling. Critically, Akool supports **TRTC (Tencent Real-Time Communication)** as a first-class transport, giving us native mainland-China reachability without the GFW risk we would have carried with a US-only WebRTC provider.

Akool ships a documented **"Integrate your own LLM service"** flow: the avatar runs in `mode: 1` (Retelling) and the client pushes arbitrary text over the RTC data channel via `sendStreamMessage({ type: 'chat', pld.text })`. The avatar TTS-es and lipsyncs exactly what we push. This keeps our existing DeepSeek pipeline (examiner prompt, rubric, sentinels) fully in our control while offloading the browser-facing audio/video/avatar stack to a managed service.

As in earlier phases the project is non-commercial and research-grade; infrastructure costs are paid by the project owner.

## 2. Goals + scope

### 2.1 In scope

- KET Speaking — 2-part format adapted from the real paired exam into a **solo-with-examiner** flow (~8–10 min per attempt)
- PET Speaking — 4-part format adapted into solo-with-examiner (~10–12 min per attempt)
- Both portals (`/ket/speaking/*` and `/pet/speaking/*`)
- Live conversational practice via **Akool streaming avatar** (Mina), transported over **TRTC** for China reach, with BYO DeepSeek as the examiner brain
- Post-session rubric scoring on all four Cambridge Speaking criteria: **Grammar & Vocabulary**, **Discourse Management**, **Pronunciation** (inferred from transcript patterns), **Interactive Communication**
- Weak-point extraction reusing Phase 2's `weakPoints` data shape and dashboard component
- Hybrid test content model — per-attempt DeepSeek generation as default, with nullable `Test.userId` leaving room for teacher-curated shared tests
- Curated R2 photo library (~50 tagged images) used for PET Part 2 photo-description prompts (and KET Part 2 when visual aids help)
- Two examiner personas (`KET examiner` / `PET examiner`) with distinct system prompts; same Mina avatar + British voice; avatar/voice IDs configurable via env
- Integration with existing systems — auth (Auth.js), user model, teacher class views, `TestAttempt` history, `GenerationEvent` rate limiting, dashboard tiles

### 2.2 Out of scope (deferred)

- Faithful 2-candidate exam simulation (examiner + fake partner avatar). Solo-with-examiner only — the "paired" parts are adapted into extended Q&A with the examiner.
- Audio playback of the student's own session on the result page (would require recording the mic stream + R2 storage; deferred per product decision).
- AI-generated photo prompts. MVP uses a curated stock library. AI generation via SiliconFlow/FLUX is a fast-follow.
- Live (in-turn) scoring — scoring happens post-session only.
- In-conversation pronunciation feedback using real audio analysis. Pronunciation is inferred from transcript artifacts (hesitations, filler words, incomplete tokens) only.
- Playwright E2E automation. Real-browser dev testing + manual checklist is the verification path; CI automation deferred.
- Teacher-curated shared test bank UI. Data model leaves room for it (`Test.userId IS NULL`), but the admin flow is not built in this phase.
- Chunked `type: 'chat'` message streaming from server → Akool. MVP sends one full-reply message per turn (replies are capped at ~40 words, well under the 1 KB per-message TRTC limit). Per-chunk streaming is a fast-follow optimisation if end-to-end latency needs tightening.
- Vocab / Grammar modules (Phase 4).

### 2.3 Success criteria (used as step-level sign-off gates)

- Student can complete a full KET Speaking attempt (2 parts) end-to-end in the browser, with Mina's avatar visible and responsive.
- Same for PET Speaking (4 parts, adapted from paired parts to extended Q&A).
- Per-turn latency (student stops speaking → first Mina audio audible) averages **≤ 2.0s** for a China-networked tester on TRTC transport, and **≤ 1.5s** for a SEA/EU-networked tester. Measured on at least one real session per level before sign-off.
- Session ends naturally via examiner's `[[SESSION_END]]` sentinel in ≥ 95% of completed attempts — the student should never need to click "Submit".
- Result page renders all four rubric scores, overall band, weak points in Phase 2's existing component shape, and full transcript, within 30s of session end on the happy path.
- Akool `CLIENT_ID` + `CLIENT_SECRET` never leave the server. Browsers only see per-session RTC credentials (TRTC `appId`/`userId`/`userSig`/`sdkAppId`) + an Akool session id; no long-lived token.
- No regressions in Phase 1 / Phase 2 features after merge.
- Test suites green: new Vitest suites for API routes + speaking lib; new pytest suites for `speaking_generator` + `speaking_scorer`.
- Phase 3 sign-off includes a browser verification of both KET and PET happy paths with a real mic, on a Chinese residential network.

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
| Real-time vendor | **Akool** streaming avatar (`/api/open/v4/liveAvatar/*`) | Managed WebRTC avatar + STT + TTS + VAD + interrupt; documented BYO-LLM path; TRTC transport option for China reach |
| WebRTC transport | **TRTC** (Tencent, `trtc-sdk-v5`), Agora fallback | TRTC is China-native, reaches mainland browsers without VPN. Agora has China nodes but LiveKit does not; LiveKit is not used. |
| LLM brain | DeepSeek via existing `services/ai` FastAPI; Akool avatar pinned to **`mode: 1` (Retelling)** so it only speaks what we push | Full control over examiner prompt + rubric; reuses Phase 2 AI stack; keeps scoring transcript server-side |
| Per-turn message shape | One `type: 'chat'` message per reply, `idx: 0`, `fin: true`, `pld.text = fullReply` | Replies are ≤ 40 words (~200 chars), comfortably under the TRTC 1 KB per-message limit. Chunked streaming deferred. |
| VAD | Akool built-in `server_vad`, threshold 0.6, `silence_duration_ms: 500` | Set at create-time via `voice_params.turn_detection`; no post-join `set-params` round-trip, no client-side VAD to build |
| Barge-in | Akool `cmd: 'interrupt'` command, **disabled by default in production**, exposed behind a dev flag | Exam-realism: student should not interrupt the examiner. Available for development and accessibility. |
| Transcript source | **Dual**: authoritative server-side log of every `/reply` request + response; client-side capture of Akool `stream-message` events (`pld.from='user'` = STT, `pld.from='bot'` = our text as spoken) as backup | Server-side is complete and canonical; client buffer covers the gap if the user's last turn failed to reach `/reply` |
| Format | Solo-with-examiner | Matches online prep convention; one avatar per session |
| Scope | Both KET and PET | Mirror Phase 2 |
| Scoring timing | Post-session only | Mirror Phase 2; avoids doubling LLM cost and distracting the examiner |
| Examiner behaviour | Coaching style | Student preference — real Cambridge examiners don't coach, but this is practice mode |
| Test content | Hybrid (per-attempt generation default, shared bank possible) | Mirror Phase 2 |
| Visual prompts | Curated R2 library | Zero runtime cost; reliable; AI generation is a follow-up |
| Personas | Two (KET + PET), both **Mina**, British-accented female | Level-appropriate pacing + language; same avatar + voice; behaviour differentiated via system prompt |
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

  transcript       Json?            // full turn history at submit time (see §5.2)
  rubricScores     Json?            // {grammarVocab, discourseManagement, pronunciation, interactive, overall}
  akoolSessionId   String?          // Akool liveAvatar session id (for debugging / close)
  speakingStatus   SpeakingStatus?
  speakingError    String?
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
  {"role": "assistant", "content": "Hello! What's your name?", "ts": "2026-04-24T10:00:00Z", "part": 1, "source": "server"},
  {"role": "user", "content": "My name is Li Wei.", "ts": "2026-04-24T10:00:05Z", "part": 1, "source": "akool_stt"},
  {"role": "assistant", "content": "Nice to meet you, Li Wei. Where do you live?", "ts": "2026-04-24T10:00:07Z", "part": 1, "source": "server"}
]
```

`role` uses OpenAI-compatible `user`/`assistant`. `part` is set by the server based on the `[[PART:N]]` sentinels observed so far. `source` records how the turn was captured (`server` = from our `/reply` log, `akool_stt` = client-captured `stream-message` event, `client_fallback` = backup capture). `ts` is the server timestamp for server-sourced turns, and the `stream-message` arrival time for client-sourced turns.

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

### 6.1 Akool streaming avatar

**Authentication (server only):**

1. `POST https://openapi.akool.com/api/open/v3/getToken` with JSON body `{ clientId, clientSecret }`. Response: `{ code: 1000, token: "<JWT>" }`. Cache the JWT in server memory for its lifetime (long-lived; decoded `exp` is years out). Refresh on any `401/1101` response.

**Session lifecycle (one per attempt):**

2. Server: `POST https://openapi.akool.com/api/open/v4/liveAvatar/session/create` with `x-api-key: <JWT>` and body:
   ```json
   {
     "avatar_id": "<AKOOL_AVATAR_ID>",
     "voice_id": "<AKOOL_VOICE_ID>",
     "language": "en",
     "duration": 900,
     "mode_type": 1,
     "stream_type": "trtc",
     "voice_params": {
       "stt_language": "en",
       "stt_type": "openai_realtime",
       "turn_detection": {
         "type": "server_vad",
         "threshold": 0.6,
         "silence_duration_ms": 500
       }
     }
   }
   ```
   `stream_type` is the official enum field per the [create-session API reference](https://docs.akool.com/ai-tools-suite/live-avatar/create-session) — options `"agora" | "livekit" | "trtc"`, default `"agora"`. We set `"trtc"` for China reachability. `mode_type: 1` (Retelling) is set at create time so the avatar boots already pinned to "speak only what we push" — no runtime `set-params` round-trip. Same for `voice_params.turn_detection`. Response includes `code: 1000` and `data.credentials` with TRTC-specific fields: `trtc_app_id`, `trtc_room_id`, `trtc_user_id`, `trtc_user_sig` (and Akool's returned Agora/LiveKit fields are unused when `stream_type: "trtc"`).
   
   The server persists `akoolSessionId` on the `TestAttempt` and returns the TRTC credentials + Akool session id to the browser. The Akool JWT is **not** returned.

3. Client: installs `trtc-sdk-v5` (Tencent official). Creates a `TRTC.create()` client, enters the room with credentials, subscribes to the avatar's published audio + video tracks, publishes the student's microphone track.

4. Client: the session is already pinned to `mode_type: 1` and has VAD configured at create-time (step 2) — no runtime `set-params` round-trip. Optionally sends a first `type: 'chat'` message with the persona's opening line (e.g., `"Hello, I'm Mina. I'll be your Cambridge examiner today..."`) drawn from `speakingPrompts.initialGreeting`. That first message flows through Akool TTS like any turn and starts the conversation.

5. Turn loop (repeats until session end):
   - Akool STT completes → fires a `stream-message` event on the TRTC client with `{ type: 'chat', pld.from: 'user', pld.text: '<transcript>', fin: true }`.
   - Client handler buffers the user turn into the local transcript array and calls our `POST /api/speaking/[attemptId]/reply` with `{ messages: [...full history so far] }`.
   - Server runs DeepSeek examiner agent, returns `{ reply: '<≤40-word text>', flags: { advancePart?: number, sessionEnd: boolean } }`. Server also persists the turn pair (`user` input + `assistant` reply) into an in-memory attempt buffer.
   - Client strips `[[PART:N]]` / `[[SESSION_END]]` sentinels from `reply.text` before pushing, updates the progress bar on `flags.advancePart`, and on `flags.sessionEnd=true` stops the loop and triggers submit.
   - Client sends one TRTC custom message: `{ v: 2, type: 'chat', mid: 'msg-<ts>', idx: 0, fin: true, pld: { text: '<cleaned-reply>' } }`.
   - Akool TTS-es and lipsyncs the text on the avatar's video track.
   - When the bot finishes, Akool fires a corresponding `stream-message` with `pld.from: 'bot', pld.text, fin: true`. Client buffers it as a backup of what was actually spoken.

6. Session close:
   - Client: `TRTC.exitRoom()`, unsubscribes, releases local mic track.
   - Server: `POST /api/open/v4/liveAvatar/session/close` with `{ id: akoolSessionId }`. Idempotent — `speakingStatus > IN_PROGRESS` short-circuits.

**Events listened for on the client (all via TRTC `stream-message` / lifecycle handlers):**

- **TRTC room joined** — hide connecting UI.
- **Avatar audio/video tracks published** — optional greeting: send the first `type: 'chat'` message from a short `initialGreeting` string in `speakingPrompts`.
- `stream-message` with `pld.from: 'user'` — user turn end; trigger `/reply` call.
- `stream-message` with `pld.from: 'bot'` — bot turn end; backup-buffer capture.
- `stream-message` with `type: 'command'` and `pld.code !== 1000` — surface in dev console; propagate to `speakingStatus: FAILED` if it's a session-killing error.
- TRTC `room-disconnected` / `connection-lost` — reconnect flow (§11).

**Post-session transcript source of truth:** the server's `/reply` log. Client `stream-message` capture is reconciled into the transcript at submit time to fill any turns the server didn't see (e.g., the final user turn if the session closed before `/reply` returned).

### 6.2 DeepSeek

Reached via the existing `services/ai` FastAPI service. Phase 3 adds three agents (`speaking_generator`, `speaking_examiner`, `speaking_scorer`) using the existing Pydantic AI + DeepSeek pattern from Phase 1/2. The examiner agent is **non-streaming** in MVP — it returns the full reply text at once. (Streaming into Akool via chunked `type: 'chat'` messages is the deferred optimisation in §2.2.)

System prompts are carefully tuned:
- **Examiner prompt** includes: persona (Mina — British Cambridge examiner), current `speakingPrompts` for the attempt, coaching mode guidance, response-length cap (~40 words), sentinel instructions:
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

### 7.2 `POST /api/speaking/[attemptId]/session`

- No body.
- Flow: assert `speakingStatus === 'IDLE'`. Build the `speakingPrompts` + rubric-coaching preamble for reference (persona prompt is owned by the server, not sent to Akool). Server-side:
  1. Fetch/refresh Akool JWT via `getToken` (cached).
  2. `POST /api/open/v4/liveAvatar/session/create` with `avatar_id = AKOOL_AVATAR_ID`, `voice_id = AKOOL_VOICE_ID`, `language = "en"`, `duration = AKOOL_SESSION_DURATION_SEC`, `mode_type = 1`, `stream_type = AKOOL_STREAM_TYPE` (default `"trtc"`), and a `voice_params` object built from `AKOOL_VAD_THRESHOLD` + `AKOOL_VAD_SILENCE_MS` envs plus `stt_language: "en"`, `stt_type: "openai_realtime"`.
  3. Persist returned `akoolSessionId` (from `data._id`) on the attempt. Transition `speakingStatus → IN_PROGRESS`.
- Response to browser (strips Agora/LiveKit fields when `stream_type: "trtc"`): `{ streamType: "trtc", trtc: { sdkAppId: number, roomId: string, userId: string, userSig: string }, akoolSessionId, test: { parts, photoUrls } }` (photo URLs are signed R2 URLs valid for the session duration). When `stream_type: "agora"` is selected instead, swap the `trtc` object for `{ appId, channel, uid, token }`.
- On Akool 4xx/5xx: `speakingStatus: FAILED`, `speakingError` set, client redirects to `/new`.

### 7.3 `POST /api/speaking/[attemptId]/reply`

- Body: `{ messages: [{role, content}] }` — the cumulative turn history so far (client captures user turns from `stream-message`, assistant turns from prior `/reply` responses).
- Flow: assert `IN_PROGRESS`. Forward to Python `/speaking/examiner` with the history + attempt's `speakingPrompts` context. Run to completion (non-streaming). Extract `[[PART:N]]` / `[[SESSION_END]]` sentinels, strip them from the spoken text, return structured JSON:
  ```json
  { "reply": "Nice to meet you. Where do you live?", "flags": { "advancePart": 2, "sessionEnd": false } }
  ```
- Server-side buffer append: `{ userText: lastUserTurn, replyText: cleanedReply, partNumber, ts }` attached to an in-memory map keyed by `attemptId`. Flushed to `transcript` at submit time.
- Timeout: 10s hard cap; on timeout return `{ reply: "One moment, let me think.", flags: { retry: true } }` to keep the conversation flowing; log the timeout for post-hoc investigation.

### 7.4 `POST /api/speaking/[attemptId]/submit`

- Body: `{ clientTranscript?: [...] }` — client's `stream-message`-derived buffer (backup). Primary transcript comes from the server-side `/reply` buffer.
- Flow: **idempotent** — if `speakingStatus` already past `IN_PROGRESS`, return `{ ok: true }` immediately.
  1. Call `POST /api/open/v4/liveAvatar/session/close` with `{ id: akoolSessionId }` (fire-and-forget; errors logged, not thrown).
  2. Compose the canonical `transcript` by interleaving the server `/reply` buffer with any `clientTranscript` turns not already captured (typically the last user turn if the session closed before `/reply` completed). Mark each turn's `source`.
  3. If the canonical transcript is empty: `speakingStatus: FAILED`, `speakingError = "No transcript captured"`.
  4. Else: persist `transcript`, transition `speakingStatus: SUBMITTED`; fire scoring asynchronously (`waitUntil` + Python `/speaking/score`).
  5. During scoring: `speakingStatus: SCORING`. On success: write `rubricScores`, `rawScore`, `scaledScore`, `weakPoints`, `speakingStatus: SCORED`. On failure: `FAILED`.
- Response: `{ ok: true }`. Client redirects to result page which polls status.

### 7.5 `GET /api/speaking/[attemptId]/status`

- Response: `{ speakingStatus, rubricScores?, speakingError? }`. Polled by the result page every 2s until `SCORED` or `FAILED` (max 2 min hard timeout).

### 7.6 `GET /api/speaking/tests/bank?level=KET|PET` *(stretch — not required for MVP)*

Shared test listing. Out of scope if time-constrained.

## 8. Python services/ai additions

```
services/ai/app/
  main.py                                    # + POST /speaking/generate, /examiner, /score
  agents/
    speaking_generator.py                    # Pydantic AI agent → SpeakingPrompts
    speaking_examiner.py                     # Turn handler (non-streaming)
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
- Connectivity check: load the TRTC SDK and run `TRTC.checkSystemRequirements()` (built-in). Warn if the browser fails the WebRTC check. No ping to Akool from this page (credentials are only minted at `/session` time).
- "Start Test" button disabled until mic OK + WebRTC OK.
- Click triggers `/tests/generate`; shows "Preparing your test…" spinner (~5–10s); routes to runner.

### 9.3 `/runner/[attemptId]` — live conversation

- **Layout: avatar-primary.** The central element is a `<div id="mina-video">` that hosts the TRTC remote video track published by Akool. Mina speaks and listens here.
- **Photo panel: inline, below/next to examiner prompt.** Appears only for parts whose `speakingPrompts[].photoKey` is non-null (PET Part 2 always; KET Part 2 optionally). Fades in when the part begins, fades out when the part ends.
- **Part progress bar** top: "Part X of N" with dots. Increments on `reply.flags.advancePart`.
- **Status pill**: `connecting` / `listening` / `thinking` / `speaking` — minimal, unobtrusive.
- **End Test button** top-right, small; confirm dialog.
- **No live transcript ticker.** Intentional — keeps student's eyes on the avatar (exam-realistic).
- **No debug controls in production UI.** Dev-only affordances live behind env flags (e.g. `NEXT_PUBLIC_SPEAKING_DEBUG=1` exposes a transcript side-panel + interrupt button).

### 9.4 Client state machine

```
INIT → PREFLIGHT → AWAITING_SESSION → TRTC_JOINING → READY →
  (listening ⇄ thinking ⇄ speaking loops) → ENDING → SUBMITTED → redirect
                                                ↑
                                [[SESSION_END]] | End Test | unload
```

### 9.5 Client responsibilities

- On `stream-message` with `pld.from='user', fin=true`: append `{role:'user', content: pld.text, source:'akool_stt'}` to the local transcript buffer and POST to `/reply` with the cumulative history.
- On `/reply` response: strip `[[PART:N]]` and `[[SESSION_END]]` sentinels from `reply.text` (they control UI/flow, not speech). Send a single TRTC custom message `{ v:2, type:'chat', mid:'msg-<ts>', idx:0, fin:true, pld:{ text: cleanedReply } }`. Update part progress on `flags.advancePart`. If `flags.sessionEnd`, stop the loop and trigger submit.
- On `stream-message` with `pld.from='bot', fin=true`: append `{role:'assistant', content: pld.text, source:'akool_stt'}` to the local buffer only if there is no corresponding server-sourced assistant turn. This keeps the client buffer a pure backup.
- `beforeunload` handler fires `navigator.sendBeacon('/api/speaking/[attemptId]/submit', { clientTranscript })`.
- Safety cap: if total elapsed > (target minutes + 3), client auto-submits regardless of `[[SESSION_END]]`.

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
| `TRTC.checkSystemRequirements()` fails | Banner: "Your browser doesn't support real-time video. Please use the latest Chrome or Edge on desktop." Blocks Start. |
| `/tests/generate` fails | Inline error + retry button; `TestAttempt` not created |
| `/session` fails (Akool 4xx/5xx) | `speakingStatus: FAILED`, redirect to `/new` with error message |
| Akool concurrency cap hit (code indicates "session limit") | Show "Too many students practising right now — try again in a moment." Do NOT transition `FAILED` — stay `IDLE` so the student can retry. |

### 11.2 Mid-session

| Failure | Handling |
|---|---|
| TRTC disconnect | One auto-reconnect (re-join with the same credentials). If still failing → "Connection lost" modal with Resume (mint new session, same attempt via `/session` — requires relaxing the IDLE check or adding a `resume` flag) or End Test (partial submit). |
| Akool session duration reached | Akool will close the room; client receives `room-disconnected`; auto-submits partial. |
| `/reply` fails mid-turn | Retry once after 300ms. Second fail → send a polite filler text (`"One moment — could you say that again?"`) directly via `sendStreamMessage` and continue. Log the failure. |
| 20s student silence | Examiner prompts (on next `/reply` the server sees the silence in the history and prompts): "Take your time. Would you like me to repeat the question?" Implemented as a server-side rule in the examiner agent, not a client-side timer. |
| Repeat STT garbage (< 3 chars twice) | Same pattern: examiner agent detects from the last two user turns and asks the student to speak up. |
| Browser crash / close | `sendBeacon` submit with locally-buffered transcript |
| Duplicate tabs on same attempt | `/session` returns 409 on second tab (first call already transitioned IDLE → IN_PROGRESS) |

### 11.3 Submit / scoring

| Failure | Handling |
|---|---|
| Server `/reply` buffer empty AND client transcript empty | `FAILED`, "No transcript captured", Retake button on result page |
| Scoring LLM fails | `FAILED`; Retry on result page re-runs scoring on persisted transcript |
| Submit called twice | Idempotency on `speakingStatus` state; second call no-op |
| Scoring > 30s | "Still scoring…" continue polling; hard timeout 2 min |
| Akool `session/close` errors | Logged and ignored — session will time out server-side on Akool's end regardless. |

### 11.4 Examiner behaviour edges

| Case | Handling |
|---|---|
| Whole part silent | Examiner moves on after 60s silence (server rule); part scores 0 |
| Student tries to game examiner | System prompt instructs stay-in-role; never reveal scores |
| Student speaks Chinese | Examiner asks in English × 2; moves on third time |
| Student asks to skip | Examiner declines, continues |
| `[[SESSION_END]]` never fires | Client safety cap at (target + 3) min |

## 12. Performance requirements

All derived from the turn-latency budget (Akool STT + our `/reply` round-trip including DeepSeek + network back to Akool + Akool TTS + avatar render). Implementation MUST include all five mitigations:

1. **Warm-up ping** — when the runner page mounts, fire an empty POST to `/speaking/examiner-warmup` (a new lightweight ping endpoint on `services/ai`) to prime the DeepSeek connection pool. Avoids cold-start on first turn.
2. **Eager TRTC room join** — start the TRTC `enterRoom` call as soon as the `/session` response arrives; do not wait for the first user turn.
3. **Akool VAD tuning** — `server_vad`, threshold 0.6 (balanced), `silence_duration_ms: 500`. Configurable via envs `AKOOL_VAD_THRESHOLD` + `AKOOL_VAD_SILENCE_MS`.
4. **Concise examiner** — system prompt caps responses at ~40 words. `max_tokens: 150` as a hard limit on the DeepSeek call.
5. **Short DeepSeek output** — scorer prompt encourages tight justifications (≤ 30 words per criterion).

**Measurement:** on every `/reply` response, log `turnLatencyMs` (server-observable: request-receive to response-return) plus `deepseekMs` (the inner LLM call time). Aggregate in logs for post-hoc analysis. No live dashboard for MVP.

**Deferred optimisation:** chunked `type: 'chat'` messages so Akool can start TTS on the first DeepSeek token instead of waiting for the full reply. Expected to shave 300–800ms off first-syllable-heard latency. Left out of MVP to keep the `/reply` contract simple; revisit after real-session latency data is in.

## 13. Security + cost controls

### 13.1 Secret handling

- `AKOOL_CLIENT_ID` + `AKOOL_CLIENT_SECRET` — server-side only. Never exposed to browser.
- The Akool JWT (from `/getToken`) is cached server-side in memory; never sent to the browser.
- Per-session TRTC credentials (`sdkAppId`, `userSig`, `userId`, `roomId`) are per-attempt and only valid for the session duration. They go to the browser once per attempt and are held in component state, not localStorage.
- DeepSeek key continues to live in `services/ai/.env` (Phase 2 convention).

### 13.2 Auth + RBAC

- Every speaking route calls `auth()`; every `[attemptId]` route asserts ownership.
- Teacher access mirrors Phase 2 (class → class members → attempts).

### 13.3 Transcript privacy

- Transcripts may include PII shared during Part 1 interviews. Stored as JSON in Postgres, same access pattern as other `TestAttempt` data.
- Not sent to third parties beyond DeepSeek (for scoring).
- Akool's STT processes the audio, but we do not persist raw audio and Akool does not retain transcripts past the session's retention window per their terms.
- No dedicated retention policy in Phase 3 — inherits Phase 2 policy.

### 13.4 Rate limiting

- `GenerationEvent` extended with `kind: SPEAKING_ATTEMPT`. Default 3/24h per student. Configurable.
- `/session` double-checks `speakingStatus === 'IDLE'` — prevents token-minting abuse.
- Admin role bypass for testing.

### 13.5 Logging

- Structured events: `speaking.attempt.created`, `speaking.session.opened` (with `akoolSessionId`, `rtcProvider`), `speaking.reply.completed` (with `turnLatencyMs`, `deepseekMs`), `speaking.submit.received`, `speaking.transcript.source` (`server`+count / `client_fallback`+count), `speaking.score.complete`.
- No transcript content in logs. Error logs include trimmed error messages only.

### 13.6 Cost controls

- `AKOOL_SESSION_DURATION_SEC` default 900 (15 min). KET sessions run ~8–10 min; PET ~10–12 min. The cap is the safety net.
- `max_tokens: 150` per examiner reply — a typical 40-turn session uses < 5k DeepSeek tokens.
- Scoring ~3k input + ~500 output tokens per attempt — negligible.
- **Primary cost driver: Akool streaming-avatar minutes.** Pricing baseline (Business tier, yearly billing): $149.4/mo = 6000 credits/mo = 1000 min/mo at 1080p streaming. 50 students × 2 attempts × 10 min = 1000 min → ≈ **$3/student/month** at full Business-tier utilisation. Concurrency cap: 5 simultaneous sessions (Business). Enterprise tier is required to lift the concurrency cap or exceed the credit pool.
- **Overage rates** above the credit pool are not transparently published by Akool. We hard-cap via `GenerationEvent` rate limits and alert on approaching the pool via a scheduled cron once in production.

### 13.7 Env vars (new)

Added to `apps/web/.env` (and `.env.example` with placeholders):

```
# Akool streaming-avatar credentials (server-only; never shipped to browser)
AKOOL_CLIENT_ID=
AKOOL_CLIENT_SECRET=

# Selected Mina avatar + voice (audition from Akool catalog and fill in)
AKOOL_AVATAR_ID=
AKOOL_VOICE_ID=

# stream_type: trtc (China-reach, default) | agora | livekit
AKOOL_STREAM_TYPE=trtc

# Session safety net (seconds)
AKOOL_SESSION_DURATION_SEC=900

# VAD tuning (see §12)
AKOOL_VAD_THRESHOLD=0.6
AKOOL_VAD_SILENCE_MS=500
```

`DASHSCOPE_API_KEY` and any `ANAM_*` slots are removed (speaking no longer uses DashScope or Anam).

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
      [attemptId]/{session,reply,submit,status}/route.ts
  src/lib/speaking/
    akool-client.ts                                    [server: getToken, session create/close]
    trtc-client.ts                                     [client: TRTC wiring, custom-message helpers]
    session-state.ts                                   [part inference, sentinel parsing]
    transcript-reconciler.ts                           [merge server /reply log + client stream-message buffer]
    photo-library.ts                                   [curated R2 lookups]
    persona-config.ts                                  [build examiner system prompt per attempt]
    scoring-client.ts                                  [call services/ai]
  src/components/speaking/
    SpeakingRunner.tsx
    MinaAvatarPanel.tsx                                [hosts TRTC remote video track]
    PhotoPanel.tsx
    PartProgressBar.tsx
    StatusPill.tsx
    MicPermissionGate.tsx
    ConnectionTest.tsx                                 [calls TRTC.checkSystemRequirements()]
    SpeakingResult.tsx
    RubricBar.tsx
    TranscriptViewer.tsx

services/ai/app/
  main.py                                              [+ /speaking/* routes incl. /examiner-warmup]
  agents/{speaking_generator,speaking_examiner,speaking_scorer}.py
  prompts/speaking_{generator,examiner,scorer}_system.py
  schemas/speaking.py
  validators/speaking.py

R2: speaking/photos/*                                  [~50 tagged images, seeded]

docs/superpowers/specs/2026-04-24-phase3-speaking-design.md  [this file]
```

## 15. Build order

Each step is commit-per-task with test-fix-verify in between.

1. **Schema + migration.** Add speaking fields + enum. `prisma generate`, migrate local DB.
2. **Photo library seeding.** Upload ~50 tagged photos to R2 under `speaking/photos/`. Seed `photo-library.ts` registry.
3. **Python: speaking schemas + `speaking_generator`.** Pydantic models. Generator agent. Unit tests with mocked DeepSeek.
4. **Python: `speaking_scorer`.** Scorer agent + prompt. Unit tests with handcrafted transcripts (empty, Chinese, short, normal).
5. **Python: `speaking_examiner` + `examiner-warmup`.** Non-streaming turn handler. Sentinel handling (`[[PART:N]]`, `[[SESSION_END]]`). Unit tests on prompt-building + sentinel parsing.
6. **Python: `main.py` routes** for `/speaking/generate`, `/examiner`, `/examiner-warmup`, `/score`. Pytest integration tests with a fake DeepSeek.
7. **Avatar + voice audition.** User browses Akool's public avatars and Voice Lab; picks Mina. Fill `AKOOL_AVATAR_ID` + `AKOOL_VOICE_ID` in `.env`. Validate by running a smoke-test script against Akool directly (not wired into the app yet).
8. **Next.js: `lib/speaking/akool-client.ts`** — `getToken` with in-memory cache, `createSession`, `closeSession`. Vitest with mocked Akool HTTP (response fixtures captured from a live call during step 7).
9. **Next.js: `POST /api/speaking/tests/generate` route.** Vitest coverage.
10. **Next.js: `POST /api/speaking/[attemptId]/session` route.** Vitest coverage. Returns TRTC credentials + session id.
11. **Next.js: `POST /api/speaking/[attemptId]/reply` route.** Non-streaming. Server-side turn buffer. Vitest coverage of sentinel stripping + advancePart/sessionEnd flag derivation.
12. **Next.js: `POST /api/speaking/[attemptId]/submit` route.** Transcript reconciliation logic (server buffer + client fallback merge). Idempotency. Vitest.
13. **Next.js: `GET /api/speaking/[attemptId]/status` route.**
14. **Minimum runner UX.** Static `/runner/[attemptId]` that opens a session, joins TRTC, sets `mode:1`, handles one user→bot turn end-to-end. Verify in browser with real Akool + real DeepSeek + real mic.
15. **Full runner UX.** Photo panel, progress bar, status pill, sentinel handling, End Test button, beacon submit, safety cap timer.
16. **`/new` pre-flight page.** Mic test + `TRTC.checkSystemRequirements()` + generate flow.
17. **Result page.** Poll status, render rubric + weak points + transcript. Reuse Phase 2 components where applicable.
18. **Rate limiting + FAILED paths.** Wire `GenerationEvent`, test all error transitions.
19. **Dashboard integration.** Speaking tiles on portals, Speaking attempts in `/history` and teacher views.
20. **End-to-end manual verification.** Real browser + mic for both KET and PET on a Chinese residential network. Measure per-turn latency. Checklist doc in `docs/superpowers/specs/phase3-speaking-manual-test.md`.
21. **Phase 3 sign-off.** User verification + merge. Joins the deferred-E2E bucket with Phase 2 for the final cross-phase browser pass.

## 16. Testing strategy

| Layer | What runs | Uses real vendors? |
|---|---|---|
| Unit (Vitest / pytest) | Route handlers, agents, utilities, sentinel parsing, transcript reconciliation | No — mocked |
| Integration (Vitest + Postgres) | End-to-end API flows, idempotency, transcript reconciliation | No — mocked Akool HTTP + fake DeepSeek |
| **Browser dev** | `pnpm dev`, real Mina conversation | **Yes — real Akool + DeepSeek + real mic** |
| Manual pre-ship QA | Checklist in staging | Yes — full stack, on a Chinese residential network |
| CI E2E | *Not built for MVP* — deferred | — |

Contract tests against real Akool / DeepSeek APIs are deferred: in-browser dev testing is the primary verification, so vendor-API drift will surface immediately in manual runs.

## 17. Open / deferred decisions

- **Chunked `type: 'chat'` streaming** for per-token DeepSeek → Akool to shave first-syllable latency. Deferred to post-MVP once we have real-session latency data.
- **Concurrency ceiling on Business tier** (5 simultaneous sessions). If one class of ≥ 6 students wants to practise at once, we'll either queue, stagger, or negotiate Akool Enterprise pricing.
- **Akool overage pricing** above the 6000 credit/mo pool is not transparent. Monitored via logs + a cron that alerts at 80% pool usage; formal answer requires contacting Akool sales.
- **AI-generated photo prompts** via SiliconFlow/FLUX. Follow-up — likely Phase 3.5.
- **Audio recording + playback** on result page. Follow-up if teachers request.
- **2-candidate faithful simulation** (examiner + fake partner avatar). Possibly Phase 3.5 if students ask; significant engineering (second session / partner persona + voice).
- **Teacher-curated shared test bank UI.** Data model supports it (`Test.userId IS NULL`); admin flow TBD.
- **Live pronunciation analysis.** Requires client-side audio capture → ASR-with-phoneme-confidence. Not in MVP.
- **Strict "exam mode" toggle** (examiner does not coach). Cambridge-faithful practice mode. Might be added based on teacher feedback.
- **Barge-in** (`cmd: 'interrupt'`) enabled for all students. Currently dev-only behind `NEXT_PUBLIC_SPEAKING_DEBUG`. Re-evaluate after first real-session feedback.

## 18. Risks

- **Akool concurrency cap on Business tier (5 sessions).** If a class of ≥ 6 students tries to practise simultaneously, the 6th and beyond will be rejected. Mitigation: queue client-side with a friendly "too busy, try in a moment" message; negotiate Enterprise tier if the cap becomes a real blocker.
- **Akool credit pool overage behaviour is opaque.** Without transparent overage pricing, one runaway usage incident could surprise-bill. Mitigation: `GenerationEvent` rate limits (3/24h per student), scheduled cron that alerts at 80% pool usage, manual top-up pattern until Akool publishes overage terms.
- **Chinese network latency to Akool's compute** — even with TRTC as the transport, Akool's STT/TTS backends are US-hosted (OpenAI Realtime STT is a known option). Budget is ≤ 2.0s per-turn. Mitigation: measure with a real Chinese user during step 20; if unacceptable, re-evaluate chunked-streaming optimisation or fall back to text-only mode.
- **Pronunciation scoring accuracy** — we infer from transcript, not audio. Acknowledged MVP limitation; document clearly to users/teachers.
- **DeepSeek reliability** — single-provider dependency. Mitigation: retry once on `/reply` failure; fall back to a polite examiner line to preserve conversation flow.
- **WebRTC fragility on mobile** — tab-backgrounded mobile browsers drop WebRTC. Recommend desktop for MVP; note in pre-flight UI.
- **PII in transcripts** — students may share names / addresses / school names. Inherited Phase 2 data policy covers this; explicitly flag to students in the `/new` consent copy.
- **Akool avatar/voice audition gap** — neither Mina's avatar nor her voice are selected yet; env vars are placeholders. Phase 3 cannot complete step 14 (first working turn) until step 7 fills them in.
