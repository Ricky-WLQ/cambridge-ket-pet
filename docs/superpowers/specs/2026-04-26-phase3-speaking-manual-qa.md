# Phase 3 Speaking — Manual QA Checklist

This is the runbook for a human operator to E2E-verify Phase 3 Speaking (KET + PET) before shipping. Run it on a fresh checkout of `phase3-speaking` (or the merge-target branch) before signing off Phase 3.

The deferred Phase 2 tests (Listening 2 / 3 / 5 from `project_kaoyan_exam_date` notes) are run together with this checklist as one combined cross-phase E2E once Phase 4 is built. Phase 3 sign-off here covers Phase 3 in isolation.

---

## 0. Prerequisites

**Environment**

- `apps/web/.env` has REAL values for: `DATABASE_URL`, `R2_*`, `AKOOL_CLIENT_ID`, `AKOOL_CLIENT_SECRET`, `AKOOL_AVATAR_ID`, `AKOOL_VOICE_ID`, `AKOOL_RTC_TRANSPORT=trtc`, `AKOOL_SESSION_DURATION_SEC=900`, `INTERNAL_AI_URL`, `INTERNAL_AI_SHARED_SECRET`.
- `services/ai/.env` has `DEEPSEEK_API_KEY` and `INTERNAL_AI_SHARED_SECRET` (matching the web side).
- ~50 photos uploaded to R2 via `pnpm fetch:speaking-photos` then `pnpm seed:speaking-photos` (or both in one go). Some may still be Picsum fallbacks — fine for QA.

**Services**

```bash
docker compose -f C:/Users/wul82/Desktop/cambridge-ket-pet/docker-compose.yml up -d
cd services/ai && source .venv/Scripts/activate && uvicorn app.main:app --host 0.0.0.0 --port 8001
cd apps/web && pnpm dev
```

Smoke checks:

- `curl http://localhost:8001/health` → `{"status":"ok",...}`
- `http://localhost:3000` returns 200
- `docker compose ps` shows `ketpet-postgres` healthy

**Test users**

- One STUDENT account in a class
- One TEACHER account that owns that class
- Optional: a second STUDENT account for "different user 404" checks

---

## 1. KET happy path (~12 min)

Browser console open in DevTools. Watch for `[trtc]` and `[runner]` lines.

- [ ] Log in as student. Open `/ket`. The 口语 tile is **active** (not dashed/opacity-60), subtitle reads "Speaking · 与 AI 考官 Mina 实时对话". Click it.
- [ ] `/ket/speaking/new` loads. `MicPermissionGate` and `ConnectionTest` both go green within 5s.
- [ ] Click "开始测试". POST `/api/speaking/tests/generate` returns 200 with `{ attemptId }` in 6–15s (DeepSeek generation).
- [ ] Redirects to `/ket/speaking/runner/<attemptId>`. Status pill `connecting` → `listening` within 3s.
- [ ] Mina avatar appears in the video panel; she speaks the opening greeting within 5s.
- [ ] **Cursor regression:** Mina walks the Part-1 examinerScript items in order, **never re-asking a question**. With a 5–7 item Part-1 script you should hear ~5–7 questions before transition.
- [ ] When Part 1 script is exhausted, Mina emits a transition + `[[PART:2]]` (server strips the sentinel). Progress bar ticks to Part 2.
- [ ] Photo panel fades in with the R2 image. Mina says script[0] of Part 2 ("Now, I'd like you to describe this photo. What can you see in the picture?"). The image must actually load — no broken image icon.
- [ ] **Cursor regression:** Mina walks Part-2 follow-ups in order. Each follow-up should be visibly tied to the photo's topic (no Part-1-style personal questions like "what do you have for breakfast"). With a 3–5 item Part-2 script you should hear ~3–5 questions.
- [ ] After the last Part-2 script item, Mina says a brief sign-off (≤ 12 words) and the session auto-ends. `[[SESSION_END]]` is stripped from the spoken text.
- [ ] Runner submits + closes Akool + redirects to `/ket/speaking/result/<attemptId>` within ~2s of the sign-off.

**Result page**

- [ ] `SiteHeader` at top, "口语结果 — KET" title, history + portal links.
- [ ] "正在评分,请稍候…" placeholder visible while DeepSeek scores (typical 8–15s).
- [ ] Page hydrates: 得分 X/20 + 折算 X% box, 4 rubric bars (Grammar & Vocabulary / Discourse Management / Pronunciation / Interactive Communication), overall score badge, justification paragraph.
- [ ] At least 0–N weak points (depends on performance). Each shows tag + quote + suggestion.
- [ ] Transcript section is collapsed by default (when rubric is present). Clicking "展开" reveals interleaved Mina/你 turns with `P1`/`P2` markers.
- [ ] Footer: 新的口语测试 → `/ket/speaking/new`; 返回 KET 门户 → `/ket`; 返回历史记录 → `/history`. All work.

## 2. PET happy path (~15 min)

Same as KET but on `/pet/speaking/new`. PET has 4 parts (Part 1 Interview, Part 2 photo, Part 3 collaborative photo, Part 4 opinion discussion). Progress bar ticks 3 times.

- [ ] All 4 parts walk script items in order. No loops, no re-asks.
- [ ] Part 2 and Part 3 both show photo panels.
- [ ] Result page renders B1-level justification.

## 3. Concurrency regression — "I don't like X. because I'm shy"

**Specifically tests the `replyInFlightRef` coalesce fix.**

- [ ] Mid-attempt, deliberately answer with two short sentences separated by a > 500ms pause: e.g. **"I like reading."** [pause ~700ms] **"It's quiet."**
- [ ] **Expected:** Mina produces ONE reply that addresses the combined utterance. Buffer/transcript shows both user segments. Mina does NOT speak two replies back-to-back.
- [ ] If you see two replies firing within ~2s of each other, the coalesce broke — file a bug.

## 4. Cursor regression — exhausted script

**Specifically tests `current_part_question_count` cursor.**

- [ ] During Part 2, give very minimal answers ("yes", "no", "I don't know") to power through the script as quickly as possible.
- [ ] **Expected:** After the last script item, Mina advances to Part 3 (PET) or signs off (KET). She does **NOT** loop back to "Now, I'd like you to describe this photo" or re-ask earlier questions.
- [ ] If you see her cycle through the same questions twice, the cursor broke — file a bug.

## 5. Error + edge paths

- [ ] **Rate limit**: trigger `/tests/generate` 4 times in a row from `/new` → the 4th returns 429 and the UI shows "今天已达到生成次数限制,请明天再试。"
- [ ] **Mic permission denied**: deny in the browser → `MicPermissionGate` shows the red help text; "开始测试" stays disabled.
- [ ] **Tab close mid-session**: close the runner tab mid-conversation → DB shows `speakingStatus IN ('SUBMITTED', 'SCORING', 'SCORED', 'FAILED')` (sendBeacon worked) and `akoolSessionId` is recorded. Visiting `/{level}/speaking/result/<attemptId>` shows the transcript captured up to the disconnect.
- [ ] **Python AI down mid-turn**: kill the uvicorn process while Mina is thinking → `/api/speaking/<id>/reply` returns the filler ("One moment — could you say that again?") via the `retry: true` path. Cursor is NOT advanced. Restart the service, give Mina another answer, and the next `/reply` succeeds.
- [ ] **Duplicate runner tab**: open `/ket/speaking/runner/<existingAttemptId>` in a second tab → the second `/session` call should 409 (attempt not in IN_PROGRESS) or fail gracefully. The first tab's session is unaffected.
- [ ] **Long Chinese-only input**: speak Chinese for 1–2 turns. Mina politely asks to use English, then on a third Chinese turn says "Let's try the next question" and continues.

## 6. Dashboard integration (Task 25 regressions)

- [ ] `/ket` and `/pet` portal: 口语 tile is a live link, not dashed.
- [ ] `/history` lists speaking attempts with:
    - Status badge "已批改" (green) for SCORED, "已放弃" (grey) for FAILED, "已提交" (blue) for SUBMITTED-but-not-yet-SCORED.
    - "口语 · 全程对话" (not "Part 0").
    - Score "X/20 · Y%" for SCORED rows.
    - "查看详情" button → `/{level}/speaking/result/<id>` (the Task 24 page).
    - "再做一次" form action → `/{level}/speaking/new` (not the runner — speaking can't reuse the same Test row).
- [ ] Teacher login → open the class's student detail → click a SPEAKING attempt → `/teacher/classes/<classId>/students/<studentId>/attempts/<attemptId>` renders rubric + transcript (read-only). No score editing.

## 7. Status mirroring (Task 25 sibling fix)

- [ ] After a fresh attempt scores, `SELECT id, status, "speakingStatus", "rawScore", "scaledScore" FROM "TestAttempt" WHERE id='<id>';` shows BOTH `status='GRADED'` AND `speakingStatus='SCORED'`.
- [ ] After a `FAILED` attempt (e.g., from §5's tab-close path with empty transcript), the same query shows `status='ABANDONED'` AND `speakingStatus='FAILED'`.
- [ ] Teacher per-student aggregate page (`/teacher/classes/<id>/students/<studentId>`) — speaking attempts now appear in the "答卷记录" list AND in the "已批改" count, both 0 before the fix.

## 8. Latency sample (Chinese residential network — required for sign-off)

Run from a residential connection in **mainland China without VPN**. Record 10 round-trip turn latencies measured as: `(student stops speaking) → (first syllable of Mina audible)`.

- [ ] Median ≤ **2.0s**.
- [ ] p95 ≤ **3.0s**.
- [ ] No turn > 5s (excluding cold-start of `/tests/generate`).

Paste the 10 measurements + observed network conditions (bandwidth, ISP) into the Phase 3 sign-off commit message (Task 28) so we have a baseline for future regressions.

## 9. Bonus — auto-recover from STT echo

Akool's avatar TTS-es every user STT verbatim ~10ms after recognition (mode_type:1 doesn't suppress this). The runner sends `interrupt` on every user-final to abort the echo TTS in flight.

- [ ] Ear test: when you finish speaking, you should NOT hear Mina's voice repeat your words. Instead the silence is filled by Mina's actual examiner reply within ~1–2s.
- [ ] If you hear your own words echoed by Mina's voice, the interrupt path is broken — file a bug.

---

## Sign-off

When every box above is checked AND the latency sample is recorded:

1. Tag the commit (`v0.3.0-phase3` or whatever convention).
2. Update `memory/project_ket_pet_app.md` to mark Phase 3 as code-complete + manually QA'd.
3. Open the Phase 4 (Vocab/Grammar) brainstorming session.

If any box fails: file a bug, fix-and-verify (add a regression test if practical), and re-run the failing section + the full §1 / §2 happy paths before claiming sign-off.
