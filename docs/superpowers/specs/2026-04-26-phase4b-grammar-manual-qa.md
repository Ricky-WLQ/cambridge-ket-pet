# Phase 4b — Grammar Manual QA Checklist

| | |
|---|---|
| **Status** | ✅ QA passed 2026-04-26 |
| **Branch** | `phase4-vocab-grammar` |
| **Spec** | `docs/superpowers/specs/2026-04-26-phase4-vocab-grammar-design.md` §7 |
| **Plan** | `docs/superpowers/plans/2026-04-26-phase4b-grammar-implementation.md` |

## Prereqs

- Local Postgres up, all 3 grammar seed scripts run successfully (40 GrammarTopic rows + ~600 GrammarQuestion rows + glosses populated)
- Dev server up: `pnpm --filter web dev` (port 3000)
- AI service up: `cd services/ai && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001` (needed for /api/grammar/generate; not for hub/quiz/mistakes)
- Two test accounts: 1 teacher, 1 student in the same class (reuse Slice 4a accounts if available)

## Test 1 — KET grammar hub

- [ ] Navigate to `/ket/grammar` while logged in as student
- [ ] Page renders with title "KET 语法 · A2 Key Grammar"
- [ ] 3 stat cards across top: 总答题 / 总正确率 / 错题 (zeros for fresh student)
- [ ] 3 quick CTAs: 随机混合 (blue) / 薄弱点专练 (gray + disabled message for fresh student) / 错题复习 (gray with 0 count)
- [ ] Categories section renders 11 KET categories (时态, 情态动词, 动词形式, 从句类型, 疑问句, 名词, 代词, 形容词, 副词, 介词, 连词)
- [ ] Each category card shows topic chips inside; chips show "未练习" + dim dot for fresh student
- [ ] Click a chip → navigates to `/ket/grammar/quiz?topicId=...`

## Test 2 — KET grammar quiz (single topic)

- [ ] From hub, click 现在完成时 (or any topic chip)
- [ ] Quiz loads with topic pill at top showing "现在完成时" + "第 1 / 10 题" counter
- [ ] Progress bar at 10%
- [ ] First question renders with text + 4 ABCD options
- [ ] Click an option → option turns blue (selected) → POST /api/grammar/progress fires (check Network tab)
- [ ] After ~1 sec: correct option turns green, wrong option (if user picked wrong) turns red, explanation panel slides in
- [ ] "下一题 →" button advances; progress bar to 20%
- [ ] Continue through all 10 questions
- [ ] On question 10 after answer: button changes to "完成 ✓" → returns to /ket/grammar
- [ ] Refresh hub → 总答题 = 10, 总正确率 reflects student's actual %, 现在完成时 chip now colored

## Test 3 — KET grammar quiz (mixed)

- [ ] Click 🎲 随机混合 from hub
- [ ] Quiz loads with topic pill showing "混合主题"
- [ ] Verify ≥4 different topics appear across 10 questions (open Network tab to inspect /api/grammar/questions response — `topicId` should vary)

## Test 4 — KET grammar mistakes review

- [ ] After answering some questions wrong (Test 2/3), click 📓 错题复习
- [ ] Page renders with title "语法错题本"
- [ ] 4 status tabs: 全部 / 待复习 / 已复习 / 已掌握 with counts
- [ ] Wrong answers appear as cards with red left border (NEW status)
- [ ] Each card shows: topic pill, question, options (correct in green, user's wrong with strikethrough red), Chinese explanation
- [ ] Click "标记已复习" → card moves to "已复习" tab + border turns amber
- [ ] Click "标记已掌握" → card moves to "已掌握" tab + border turns green
- [ ] In "已掌握" tab, "重新学习" sends card back to "待复习"
- [ ] Tab counts update correctly across moves

## Test 5 — PET grammar (parallel to KET)

- [ ] All Test 1-4 steps pass at `/pet/grammar/*` with examType="PET"
- [ ] PET hub shows 14 categories (KET 11 + conditionals + reported_speech + phrasal_verbs)
- [ ] PET total topic count > KET total topic count (~21 vs ~19)

## Test 6 — Teacher GRAMMAR assignment

- [ ] Log in as teacher → `/teacher/classes/<classId>/assignments/new`
- [ ] Select kind=语法 (GRAMMAR) → topic picker (with 全部主题 as first option) + 正确率达标线 input appear
- [ ] Note: Part picker + Min-Score (paper) input + Vocab fields all hidden
- [ ] Submit with: examType=KET, targetTopicId=Present Perfect Simple, minScore=70, due=tomorrow
- [ ] Assignment appears in class page
- [ ] As student, dashboard shows the new assignment (incomplete)
- [ ] Take the topic quiz, get ≥7/10
- [ ] Refresh dashboard → assignment shows complete

## Test 7 — Teacher class summary grammar block

- [ ] On `/teacher/classes/<classId>`, the "语法练习概况" card renders below the vocab block
- [ ] Shows class average accuracy % for both KET and PET
- [ ] Top 5 / Bottom 5 student lists populated
- [ ] If students have ≥3 attempts on weak topics, "常见薄弱主题" section lists 3 topics

## Test 8 — Teacher per-student page

- [ ] On `/teacher/classes/<classId>/students/<studentId>`, "语法练习" section renders
- [ ] Per-topic accuracy bars (top 6 by attempts) for KET + PET
- [ ] 30-day sparkline visible; cells colored proportional to activity
- [ ] Hovering a cell shows tooltip "X 天前: N 次答题"

## Test 9 — /api/grammar/generate rate limit + AI service

- [ ] As teacher (or via curl with session cookie), hit POST /api/grammar/generate 5 times in quick succession with valid topicId + count=5
- [ ] All 5 succeed (200), each adding 5 questions to GrammarQuestion table
- [ ] 6th request within the 60s window returns 429 with `retry-after` header
- [ ] Wait 65s → next request succeeds again

## Test 10 — Theme correctness

- [ ] Force `prefers-color-scheme: dark` in DevTools → grammar pages still readable
- [ ] Force `light` → matches existing app appearance (white bg, neutral borders, blue CTA, accent green/amber/red on accuracy chips)

## Test 11 — No Phase 1-3-4a regression

- [ ] One Reading attempt end-to-end (KET) — start, answer, submit, see grade
- [ ] One Listening attempt end-to-end (KET) — generate, play, answer, submit
- [ ] One Speaking session end-to-end (KET)
- [ ] One Vocab listen session — audio plays, mastery advances
- [ ] One Vocab spell session — submit + reveal works
- [ ] Vocab tile + Grammar tile both visible on /ket and /pet portals

## Sign-off

- [ ] All 11 tests pass
- [ ] No regression in Phase 1-3 + Slice 4a
- [ ] Vitest + pytest suites green:
  - `pnpm --filter web exec vitest run` (≈190+/190+ tests including new grammar tests)
  - `cd services/ai && .venv/Scripts/python.exe -m pytest` (≈140+/140+ tests including new grammar tests)
- [ ] Final commit: `chore(phase4b): Grammar module sign-off — code-complete`

Reviewer: Liqun Wu  Date: 2026-04-26
