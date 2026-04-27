# Diagnose v2 — Manual QA Checklist

| | |
|---|---|
| **Status** | Awaiting QA pass |
| **Branch** | `feat/diagnose-weekly` |
| **Spec** | `docs/superpowers/specs/2026-04-26-diagnose-design.md` |
| **Plan** | `~/.claude/plans/shiny-gathering-fountain.md` |
| **Last build commit** | `3e420c5` (Phase 7 pages) |

## Prereqs

- Local Postgres up; latest migration `20260427_add_weekly_diagnose` applied (`apps/web/prisma/migrations/20260427_add_weekly_diagnose/migration.sql`).
- `apps/web/.env` has `DATABASE_URL`; `services/ai/.env` has `DEEPSEEK_API_KEY` (per memory `project_ket_pet_env_paths.md`).
- Dev server: `pnpm --filter web dev` (port 3000).
- AI service: `cd services/ai && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001`.
- Three test accounts (all in the same class, same `examType`):
  - `student-fresh@test.local` — brand-new, never logged in.
  - `student-active@test.local` — has Phase 1-4 history, no diagnose history.
  - `teacher@test.local` — `role=TEACHER`, owns the class.
- For cross-week tests: ability to set system clock or use the `WEEK_NOW_OVERRIDE` env hatch (set in `apps/web/.env` to a fixed ISO timestamp; reload server to pick up).
- For AI-failure tests: ability to point `services/ai` at an unreachable host (e.g., `DEEPSEEK_API_BASE_URL=http://127.0.0.1:9` to force ECONNREFUSED).

## Sign-off summary

- [ ] All 20 cases pass
- [ ] No regression in Phase 1-4 (random sample: 1 reading attempt, 1 listening attempt, 1 speaking session, 1 vocab listen drill, 1 grammar quiz)
- [ ] Vitest + pytest suites green: `pnpm --filter web exec vitest run` and `cd services/ai && .venv/Scripts/python.exe -m pytest`
- [ ] Final commit on `feat/diagnose-weekly` after fixes: `chore(diagnose): manual QA passed`

Reviewer: __________________ Date: __________________

---

## Case 1 — Cold start (week 1, fresh student)

**Goal:** A brand-new student with zero history sees the cold-start path and gets a balanced level-appropriate test.

### Setup

- Use `student-fresh@test.local`. Confirm `WeeklyDiagnose` rows for this user are empty (`SELECT * FROM "WeeklyDiagnose" WHERE "userId" = ...` → 0 rows).
- Confirm zero `TestAttempt` rows for this user.

### Steps

1. Log in as `student-fresh@test.local`.
2. Observe redirect to `/diagnose` (gate fires immediately because `requiredDiagnoseId` is computed null-but-week-not-completed → still gated).
3. Click "生成本周诊断 (Generate this week's diagnose)" CTA.
4. Wait ~30-45s for the orchestrator (`/v1/diagnose/generate` calls 4 generators in parallel + bank-samples vocab + grammar).
5. Hub renders with 6 SectionStatusCards, all showing `NOT_STARTED`.

### Expected result

- `WeeklyDiagnose.status = PENDING` after generation.
- `Test.payload` has all 6 sections; vocab/grammar pulled from the existing banks.
- Reading + Listening + Writing + Speaking content is **fresh** (use `Test.payload.parts[0].questions[0].id` — should be a new cuid not seen in earlier `Test` rows).
- Hub shows banner "本周（YYYY年X月X日—X月X日）诊断" with the current ISO-week-in-CST range.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 2 — Normal week — generate, see all 6 sections NOT_STARTED

**Goal:** Standard happy-path generation flow renders the hub correctly.

### Setup

- Use `student-active@test.local`. Confirm last week's diagnose (if any) has `status = REPORT_READY` so the gate is "this week only".
- Set system clock to a Monday between 08:00 and 22:00 CST (or simply the current Monday if testing live).

### Steps

1. Log in. Land on `/diagnose` via the redirect.
2. Hub shows "本周尚未生成诊断" empty state with "生成" button.
3. Click "生成". Wait ~30-45s.
4. Hub re-renders with 6 cards.

### Expected result

- All 6 SectionStatusCards show pill `未开始` (NOT_STARTED).
- Each card shows its time-limit copy (Reading 8 分钟, Listening 10 分钟, etc.).
- "查看上周诊断" link present in the hub footer (or on `/diagnose/history`).
- No section-grade ring is shown (no scores yet).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 3 — Mid-week resume — close tab, return next day, IN_PROGRESS preserved

**Goal:** Per-section state persists when the student walks away mid-section.

### Setup

- `student-active@test.local`, fresh week-2 diagnose generated (Case 2 completed).

### Steps

1. Click into Reading section → enter the runner.
2. Answer Q1 + Q2 of 3 (leave Q3 blank). Don't submit.
3. **Close the browser tab entirely** (do not click submit).
4. (Simulate next day) Wait at least 5 minutes (or fast-forward clock) but stay within the section's 8-minute time limit. Re-open and log in again.
5. Land on `/diagnose`.

### Expected result

- Reading card shows `进行中` (IN_PROGRESS) pill, **not** auto-submitted.
- Re-entering the runner restores Q1 + Q2 answers (server is the source of truth via `TestAttempt.answers` JSON).
- Timer continues from where it was (server-authoritative; ~5 minutes already elapsed → ~3 min remaining if the section's 8-min limit has been counting since `startedAt`).
- Q3 still blank.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 4 — Section auto-submit — leave Reading idle past 8 min, cron force-submits

**Goal:** The cron `diagnose-force-submit-expired` correctly auto-submits an idle section.

### Setup

- `student-active@test.local` mid-week diagnose with Reading IN_PROGRESS (continue from Case 3 or generate a fresh one).
- Confirm `/api/cron/diagnose-force-submit-expired` is reachable. If running locally without a real cron scheduler, you can manually `curl -X POST http://localhost:3000/api/cron/diagnose-force-submit-expired` after 8 min + 60 s grace.

### Steps

1. Enter Reading runner. Answer Q1 only. Don't submit.
2. Close the tab.
3. Wait **9+ minutes** (8 min limit + 60 s grace).
4. Manually trigger `POST /api/cron/diagnose-force-submit-expired` (or wait for the 5-min cron to fire twice across the boundary).
5. Refresh `/diagnose`.

### Expected result

- Reading card pill is `已自动提交` (AUTO_SUBMITTED), distinct from manual `已提交`.
- `WeeklyDiagnose.readingStatus = AUTO_SUBMITTED`.
- `TestAttempt.submittedAt` is populated; `answers` reflects the partial state (Q1 answered, Q2 + Q3 null).
- No client-visible error.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 5 — Simultaneous tabs — same section in 2 tabs, second tab sees state on refresh

**Goal:** No race condition between two tabs entering the same section.

### Setup

- `student-active@test.local` with a fresh `NOT_STARTED` Vocab section.

### Steps

1. Open Tab A → click into Vocab section. Answer Q1.
2. Open Tab B (same browser session). Navigate to `/diagnose/runner/vocab`.
3. In Tab B, observe what loads.
4. In Tab A, submit the section.
5. Refresh Tab B.

### Expected result

- Tab B initially shows the same Q1 selection as Tab A (server returns the same `TestAttempt.answers`).
- After Tab A submits, Tab B refresh redirects to the hub (the section is no longer `IN_PROGRESS`) with a banner "本节已提交，请继续其他部分".
- No 500 errors. No double-submit (the second submit attempt — if it occurs — is rejected idempotently with a 409 or 200 OK with `idempotent=true` flag).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 6 — AI failure mid-generation — DeepSeek 500 → retry CTA appears

**Goal:** The orchestrator handles a partial failure gracefully and surfaces a retry path.

### Setup

- Stop `services/ai`. Or set `DEEPSEEK_API_BASE_URL=http://127.0.0.1:9` in `services/ai/.env` to force ECONNREFUSED.
- `student-fresh@test.local` (or any student without a current-week diagnose).

### Steps

1. Log in. Land on `/diagnose`.
2. Click "生成". Wait the full timeout window (~60s — orchestrator times out after the slowest sub-agent).
3. Observe the failure UI.
4. Restart `services/ai` (or restore the env var) so DeepSeek is reachable.
5. Click the retry CTA.

### Expected result

- After timeout, hub shows "生成失败 (failedSection: reading|listening|writing|speaking)" message + "重新生成" button. Status is **not** `PENDING` (parent wasn't created cleanly) or it's `PENDING` with `reportError` populated — either is acceptable as long as the user can retry.
- The retry CTA does not consume a rate-limit slot if the previous call **never succeeded** (per L1 idempotency rules — verify via DB: `WeeklyDiagnose.id` should be the same row, not a new one).
- After successful retry, all 6 sections render `NOT_STARTED`.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 7 — Gate-redirect flow — try `/ket/reading/new` while gated → redirect to `/diagnose`

**Goal:** All 3 gate layers (JWT cache + Edge middleware + per-page belt-and-suspenders) work.

### Setup

- `student-active@test.local`, fresh diagnose generated, **no sections yet submitted**. So `requiredDiagnoseId !== null` in the JWT.

### Steps

1. Log in. Note the redirect to `/diagnose`.
2. In the URL bar, manually type `/ket/reading/new`. Press Enter.
3. Observe what happens.
4. Try `/pet/listening/new` — same expectation.
5. Try `/ket/vocab` — same.
6. Try `/ket/grammar` — same.
7. Try `/`(root) — same.

### Expected result

- Each navigation immediately redirects (HTTP 307 or 302) to `/diagnose`.
- The redirect is fired by the Edge middleware, not the page (verify: the page server component never logs that it ran).
- `/diagnose/*`, `/history`, `/classes`, `/teacher/activate`, `/teacher/classes`, `/login`, `/logout`, `/signup`, `/api/auth/*`, `/api/diagnose/*`, `/api/cron/*`, `/api/teacher/*`, `/api/r2/*`, `/api/speaking/photos/*`, `/_next/*` are all reachable without a redirect.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 8 — Replay non-scoring — open last week, "重做" routes into runner without affecting WeeklyDiagnose

**Goal:** Replay creates a fresh `PRACTICE` `TestAttempt` and does **not** mutate the `WeeklyDiagnose` parent.

### Setup

- `student-active@test.local` with at least one fully-finalised `WeeklyDiagnose` from a prior week (`status = REPORT_READY`).
- Note the row's `id`, `status`, `readingStatus`, etc. before the test.

### Steps

1. Log in. Navigate to `/diagnose/history`.
2. Click into a past report → `/diagnose/history/[testId]`.
3. Click "重做 Reading" CTA.
4. Land on `/diagnose/replay/[testId]/reading`.
5. Answer all 3 questions and submit.
6. Re-query `WeeklyDiagnose` for that prior week and compare.

### Expected result

- Replay submission creates a **new `TestAttempt`** row with `mode=PRACTICE` and `kind=DIAGNOSE` (use `WHERE "userId"=... ORDER BY "createdAt" DESC LIMIT 5`).
- The replay `TestAttempt.id` is **not** in `WeeklyDiagnose.readingAttemptId` (the parent unchanged).
- `WeeklyDiagnose.status`, `readingStatus`, all scores are unchanged from before the replay.
- Replay result page shows the score for the replay only (this is a practice session — no impact on the diagnose record).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 9 — Teacher exemption — teacher logs in, no redirect, can browse freely

**Goal:** `role=TEACHER` is fully exempt from the gate.

### Setup

- `teacher@test.local`. The teacher does **not** need a `WeeklyDiagnose` row.

### Steps

1. Log in as teacher.
2. Navigate to `/`, `/ket`, `/pet`, `/ket/reading/new`, `/teacher/classes`, `/diagnose` — all in any order.
3. (Optional) Navigate to a student's `/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]` to confirm Phase 1-4 teacher views still work.

### Expected result

- **Zero redirects to `/diagnose`** at any step.
- Teacher can read past student work as in Phase 1-4.
- `/diagnose` for the teacher renders an empty-state "教师账户不需要参加诊断" message (or just doesn't crash — either is acceptable).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 10 — View-but-not-completed — `/history` while gated shows banner

**Goal:** Allowed paths still render with a `<GateBanner />` reminding the student to finish the diagnose.

### Setup

- `student-active@test.local`, gated this week (some sections completed, some not).

### Steps

1. Log in. Land on `/diagnose`.
2. Manually navigate to `/history` (allowed per L1).
3. Manually navigate to `/classes` (allowed per L1).

### Expected result

- `/history` renders normally with the existing list of past `TestAttempt` rows (filtered to `kind != DIAGNOSE` so diagnose attempts don't appear here).
- A persistent `<GateBanner />` strip is visible at the top of the page, copy: "本周诊断尚未完成。剩余 N 部分。" with a "返回诊断" link.
- The banner is **also** visible on `/classes`.
- The banner is **not** visible on `/diagnose` itself (you're already there).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 11 — All-six unblock — submit last section, gate releases

**Goal:** Completing all 6 sections clears the gate.

### Setup

- `student-active@test.local` with 5 of 6 sections SUBMITTED. The 6th (any) is IN_PROGRESS or NOT_STARTED.

### Steps

1. Log in. Verify gate is still active (redirect to `/diagnose`).
2. Complete the 6th section. Click submit.
3. Observe the post-submit UI on `/diagnose` — should switch to "正在生成报告" with progress polling.
4. **Without waiting for the report**, immediately navigate to `/ket` (or `/pet` if PET student).

### Expected result

- After submitting the 6th section, the `useSession().update()` call refreshes the JWT → `requiredDiagnoseId` becomes `null`.
- Navigation to `/ket` succeeds (no redirect to `/diagnose`).
- The diagnose hub continues to poll `/api/diagnose/me/current` for the report (status `COMPLETE` → `REPORT_READY` over ~60s; see Case 12).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 12 — Eventual-consistency report — submit last section, finalize takes ~60s, hub polls

**Goal:** Report finalisation pipeline completes within ~60s and the hub picks it up via polling.

### Setup

- Continue from Case 11 immediately after submitting the 6th section.

### Steps

1. After submitting the 6th section, stay on `/diagnose` (do not navigate away).
2. Watch the page. Time how long until the report appears.
3. Once the report renders, click into the per-section breakdown and the 8-category knowledge-points.

### Expected result

- Hub shows "正在生成报告... 通常 30-60 秒" copy. A spinner or progress indicator is visible.
- Polling interval is ~3-5 s (verify via Network tab).
- Report renders within ~60-90 s (5-step pipeline: deterministic grade → AI writing grade → AI speaking grade → 8-category analysis → 4-field summary).
- Report shows: overall ring, per-section grid, 4-field summary (strengths/weaknesses/priorityActions/narrative_zh — with the week date in the first sentence of `narrative_zh`), and 8-category knowledge-point clusters.
- Each knowledge-point cluster shows severity badge, miniLesson, ≥1 example sentence, and expandable per-question whyWrong.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 13 — Speaking flow — full Akool TRTC session for diagnose speaking section

**Goal:** Speaking section reuses the existing Phase 3 Akool/Mina pipeline cleanly under a diagnose attempt.

### Setup

- `student-active@test.local` with current-week diagnose, Speaking section NOT_STARTED.
- Microphone permission granted in the test browser.
- Akool credentials present in the env (per Phase 3 setup).

### Steps

1. Click into Speaking section.
2. Wait for Mina avatar to appear (TRTC connection takes ~3-5 s).
3. Mina greets in English; respond verbally.
4. Complete the ~3-5 minute Akool session.
5. Click "结束对话" to end.
6. Observe the post-end UI.

### Expected result

- Akool TRTC session establishes (no console errors mentioning TRTC token, no `429` from Akool).
- Mina speaks the diagnose-specific prompt (different from any practice prompt the student would have seen).
- Audio + video render at the same FPS as Phase 3.
- After "结束对话", the session writes to the `TestAttempt` keyed by the diagnose Speaking `attemptId` (verify in DB: `TestAttempt.kind = "DIAGNOSE"`).
- Speaking card on `/diagnose` updates to `已提交` within ~5 s.
- The grade may not be present immediately (Akool finalisation can lag — see L9 / risk #6); the eventual report shows the speaking score after `/finalize` polls Akool for up to 90s.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 14 — Listening audio not yet ready — start Listening, audio still GENERATING, runner shows placeholder

**Goal:** The runner gracefully handles the case where `Test.audioStatus` hasn't reached READY yet.

### Setup

- Generate a fresh diagnose. Immediately enter Listening before the audio pipeline finishes (in practice this requires racing the generation; alternatively manually flip `Test.audioStatus` to `GENERATING` in the DB right before clicking the section).

### Steps

1. Click into Listening section while audio is `GENERATING`.
2. Observe runner UI.
3. Wait until polling resolves the audio.

### Expected result

- Runner shows a `<GenerationProgress />`-style placeholder with copy "音频生成中... 通常 30-60 秒".
- Polling fires every 1500 ms against `/api/diagnose/me/current` (or the listening-specific status endpoint).
- Once `audioStatus = READY`, the player loads the R2-streamed mp3 and unlocks the section timer (timer should start counting **only when audio is ready**, not when the section was "entered" — verify `TestAttempt.startedAt` is updated at audio-ready time).
- No crash if the user navigates away mid-generation; returning resumes the placeholder.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 15 — Multi-session one-day — do 3 sections morning, 3 evening

**Goal:** A student can spread the diagnose across multiple sittings within the same day without state corruption.

### Setup

- `student-active@test.local`, fresh diagnose generated. No sections submitted yet.

### Steps

1. (Morning) Log in. Complete Reading + Vocab + Grammar sections (3 of 6 submitted).
2. Log out (or simply close all tabs).
3. (Evening, same day) Log back in.
4. Hub should show 3 of 6 cards `已提交`, 3 still `未开始` or `进行中`.
5. Complete Listening + Writing + Speaking.

### Expected result

- After morning session: hub correctly shows 3 SUBMITTED + 3 NOT_STARTED. `WeeklyDiagnose.status = IN_PROGRESS` (not COMPLETE — there are still pending sections).
- After evening session: all 6 SUBMITTED. Status flips to COMPLETE → REPORT_READY (per the Case 11/12 flow).
- No section's timer "leaked" across sessions (each section's timer was locked and unlocked within its own sitting).
- Gate releases after the 6th submit (per Case 11).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 16 — Cross-week boundary — Sunday 23:59 → Monday 00:01

**Goal:** A diagnose started on Sunday cannot leak into Monday's gate evaluation.

### Setup

- Set system clock (or `WEEK_NOW_OVERRIDE`) to **Sunday 23:50 CST**.
- `student-active@test.local`, no diagnose this week. Generate one.
- Start (but do not submit) Reading section. Note `TestAttempt.startedAt`.

### Steps

1. At Sunday 23:50, generate diagnose. Confirm `WeeklyDiagnose.weekStart` is the **Monday of last week** (the current ISO week).
2. Start Reading section at 23:55. Answer Q1.
3. Advance the clock to **Monday 00:05 CST** (now the ISO week has rolled over).
4. Log out, log back in.
5. Observe `/diagnose` state.

### Expected result

- The previous-week `WeeklyDiagnose` row still exists with its IN_PROGRESS state. It's now reachable only via `/diagnose/history` (last week's row).
- The new Monday triggers a **new** required diagnose. Hub renders empty state "本周尚未生成诊断".
- The previous-week's incomplete row does **not** clear the gate for the new week — the student is still gated until the new week's diagnose is generated + submitted.
- The cron auto-submits the previous-week's hanging Reading section at the next `force-submit-expired` cycle (per Case 4).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 17 — Teacher class diagnose-status — table of student progress

**Goal:** `/teacher/classes/[classId]/diagnose-status` shows a roll-up of every student's current-week diagnose state.

### Setup

- `teacher@test.local` owns a class with at least 3 students in different states:
  - Student A: this week's diagnose REPORT_READY (all submitted, report done).
  - Student B: this week's diagnose IN_PROGRESS (some sections SUBMITTED, some not).
  - Student C: no diagnose generated this week.

### Steps

1. Log in as teacher.
2. Navigate to `/teacher/classes/[classId]`.
3. Click "诊断状态" / `diagnose-status` link.

### Expected result

- Page renders a table with columns: 学生姓名 | 状态 | 完成进度 | 最后活动 | 操作.
- Student A row: status `已完成`, progress 6/6, "查看报告" link → `/teacher/classes/[classId]/students/[studentId]/diagnose-status` (or similar).
- Student B row: status `进行中`, progress N/6.
- Student C row: status `未生成`, progress 0/6 — no "查看报告" link.
- Empty class renders cleanly with "班级还没有学生。" placeholder.

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 18 — Past diagnose history — list of last weeks

**Goal:** `/diagnose/history` shows the student's complete diagnose history across weeks.

### Setup

- `student-active@test.local` with **at least 3 prior weeks** of `WeeklyDiagnose` rows (mix of REPORT_READY + REPORT_FAILED). If you don't have 3 prior weeks, seed them via the SQL editor or the seed script.

### Steps

1. Log in. Navigate to `/diagnose/history`.
2. Verify all prior weeks are listed in reverse chronological order.
3. Click into one of them.

### Expected result

- Each row shows: 周次 ("YYYY年X月X日—X月X日") · 状态 · 总分 · "查看".
- Clicking a row → `/diagnose/history/[testId]` rendering the read-only report.
- The current week's row is **not** in this list (current-week is on `/diagnose` directly).
- Rows with `status = REPORT_FAILED` show a "重试报告" button or fallback copy.
- Pagination works if >20 weeks (lifetime use).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 19 — Generation rate limit — 4th retry within an hour gets 429

**Goal:** The `/api/diagnose/me/generate` rate limit (3/hr per user) holds.

### Setup

- `student-fresh@test.local` (clean rate-limit state).
- Open DevTools Network tab to inspect status codes.

### Steps

1. Log in. Trigger generate (call 1).
2. Force a failure (e.g., kill `services/ai` mid-call) so the row is left in a retryable state.
3. Restart `services/ai`. Trigger retry (call 2).
4. Force another failure. Retry (call 3).
5. Force a fourth failure. Retry (call 4).

### Expected result

- Calls 1, 2, 3 are allowed.
- Call 4 returns HTTP **429** with copy "本小时生成次数已达上限，请稍后再试".
- The `WeeklyDiagnose` row stays in its last-known state after the 429 (no corruption).
- After 1 hour from call 1, a fresh call works (sliding window or fixed-bucket — verify which is in use; either is acceptable as long as the limit holds).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Case 20 — Empty wrong-answers report — perfect score, knowledgePoints is []

**Goal:** A student who scores perfectly gets a clean empty-state report.

### Setup

- Use `student-active@test.local`. Inspect this week's diagnose `Test.payload` and pre-determine the correct answers (via `parts[*].questions[*].answer`).
- Plan to answer all 6 sections perfectly.

### Steps

1. Generate diagnose. Walk through each section answering correctly:
   - Reading: 3/3 correct.
   - Listening: 3/3 correct.
   - Vocab: 3/3 correct (use the displayed correct answer literally).
   - Grammar: 3/3 correct.
   - Writing: write a high-quality response (will not score 100/100 from AI grader, but knowledge points come from wrong answers — so AI grader scoring is fine here).
   - Speaking: provide solid responses.
2. Submit all 6 sections.
3. Wait for finalize (~60 s).
4. Open the report.

### Expected result

- Per-section scores show high values (R/L/V/G near 100; W/S whatever the AI graders say).
- 4-field summary renders normally — `strengths` populated (≥1 entry per validator rule), `weaknesses` may be empty list, `priorityActions` ≥1 entry (the validator enforces this even on a perfect score).
- **`knowledgePoints` array is empty `[]`** (no wrong answers → no clusters to render).
- Report UI renders an empty-state for the knowledge-points section: copy like "本周没有错题 — 太棒了！" instead of an empty list.
- `narrative_zh` first sentence still names the week date (validator rule from `services/ai/app/validators/diagnose.py:_YEAR_TOKEN_PATTERN` enforces this).

### Pass/Fail

- [ ] PASSED · 2026-XX-XX · ____________

---

## Notes for QA testers

- If a case fails, **do not** delete `WeeklyDiagnose` rows manually unless the failure is a known data-corruption bug. Capture the row state via `SELECT row_to_json("WeeklyDiagnose".*)` and attach to the bug report.
- For cron-related cases (4, 16), if the local environment doesn't have a cron scheduler, manually `curl -X POST http://localhost:3000/api/cron/diagnose-force-submit-expired` to simulate the trigger.
- For AI-failure cases (6), the cleanest way is `DEEPSEEK_API_BASE_URL=http://127.0.0.1:9` in `services/ai/.env` — this gives ECONNREFUSED, which the validator-loop handles distinctly from a 5xx response.
- For week-boundary cases (16), the `WEEK_NOW_OVERRIDE` env hatch (if implemented) is preferred over OS clock changes — it avoids breaking other timer-aware features in unrelated parts of the app.
- The 8-category knowledge-points include `cambridge_strategy` (replaces pretco's `translation_skill` — see spec §L9 + §5.5); reject any report that contains `translation_skill` as that means the prompt regression slipped through.

## Known limitations (out of v1 scope — do not flag as bugs)

Per spec §10:
1. No knowledge-point quests (drillable from each cluster).
2. No gamification (XP / badges).
3. No Sunday-night pre-warm cron — generation is lazy on first view.
4. No parent role / read-only parent surface.
5. No email notifications.
6. No mobile-specific runner adjustments.
7. No re-grade / appeal flow.
8. `/history` filters out diagnose attempts; they live on `/diagnose/history` only.
