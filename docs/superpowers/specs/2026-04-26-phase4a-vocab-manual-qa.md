# Phase 4a — Vocab Manual QA Checklist

| | |
|---|---|
| **Status** | Awaiting QA pass |
| **Branch** | `phase4-vocab-grammar` |
| **Spec** | `docs/superpowers/specs/2026-04-26-phase4-vocab-grammar-design.md` §6 |
| **Plan** | `docs/superpowers/plans/2026-04-26-phase4a-vocab-implementation.md` |

## Prereqs

- Local Postgres up, all 4 seed scripts run successfully (Word table populated, glossZh + audioKey filled, tier set per CEFR + manual overrides). Note: original plan had 5 scripts but Task 12 EVP fetch was skipped — replaced by DeepSeek-derived cefrLevel inside Task 14.
- Dev server up: `pnpm --filter web dev` (port 3000)
- AI service up: `cd services/ai && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001` (only needed for grammar in Slice 4b — vocab pages don't call /vocab-gloss at runtime)
- Two test accounts: 1 teacher, 1 student in the same class

## Test 1 — KET vocab hub

- [ ] Navigate to `/ket/vocab` while logged in as student
- [ ] Page renders with title "KET 词汇 · A2 Key Vocabulary"
- [ ] Overall mastery card shows X% / N of <CORE total> (X depends on prior progress; on a fresh student this should be 0% / 0 of <total>)
- [ ] 4 practice CTAs render (2 highlighted blue for CORE, 2 neutral for mixed)
- [ ] 3 tier cards render with correct counts (CORE has gold-tinted background per the theme)
- [ ] Tier filter chips work (clicking 必修 filters word list)
- [ ] Search box filters (type "actually" → only matching words appear)
- [ ] Pagination works for >50 words (KET has ~1,618 words → ~33 pages of 50)
- [ ] Word table shows: word + POS + Chinese gloss + tier badge + mastery dots + last reviewed

## Test 2 — KET vocab listen

- [ ] Click "听写 · 必修" → navigates to `/ket/vocab/listen?tier=CORE`
- [ ] First word loads with `?????` displayed (not the actual word)
- [ ] Audio auto-plays on word change (R2-cached MP3 via /api/r2/[...key])
- [ ] Phonetic shown only after reveal
- [ ] Click "再听一次" → audio replays
- [ ] Click "显示单词" → word + phonetic appear
- [ ] Click "已掌握" → POST /api/vocab/progress fires, advances to next word
- [ ] Refresh page → returning to hub shows mastered count incremented
- [ ] Toggle "自动显示" → next word auto-reveals after ~1.5s
- [ ] Change batch size dropdown → next "下一个" past the end loads new batch with correct size
- [ ] **Web Speech fallback:** disable network in DevTools, click "再听一次" — verify Web Speech API kicks in (you should still hear the word, in your browser's default English voice)

## Test 3 — KET vocab spell

- [ ] Click "拼写 · 必修" → navigates to `/ket/vocab/spell?tier=CORE`
- [ ] First word's example is shown with the headword redacted as `____`
- [ ] Per-blank input boxes render (~40% of letters blanked, position 0 always shown)
- [ ] Tab moves between blanks; Shift-Tab moves backward
- [ ] Enter on last blank submits
- [ ] Wrong submit highlights wrong inputs in red with correct letter shown beneath
- [ ] Correct submit shows green confirmation
- [ ] "显示答案" reveals the full word
- [ ] "下一个" advances; new word's blanks are different (fresh `generateFillBlank` call)
- [ ] After completing batch, advancing past the last word loads new shuffled batch

## Test 4 — PET vocab (parallel to KET)

- [ ] All of the above tests pass at `/pet/vocab/*` with examType="PET"
- [ ] PET CORE total > KET CORE total (B1 wordlist is larger; current values: PET CORE=1,871, KET CORE=409)

## Test 5 — Teacher VOCAB assignment

- [ ] Log in as teacher
- [ ] Go to `/teacher/classes/<classId>/assignments/new`
- [ ] Select kind=VOCAB → tier picker (button group with 全部/必修/推荐/拓展) + word count field appear
- [ ] Note: when kind=VOCAB, the Part picker + Min-Score input from paper-kind assignments disappear (replaced by the VOCAB-specific fields)
- [ ] Submit with: examType=KET, tier=CORE, count=5, due=tomorrow
- [ ] Assignment appears in `/teacher/classes/<classId>` page
- [ ] Log in as student in that class → assignment appears on dashboard
- [ ] Go to `/ket/vocab/listen?tier=CORE`, mark 5 CORE words as mastered (each "已掌握" click writes one mastered word)
- [ ] Refresh dashboard → assignment shows complete

## Test 6 — Teacher class summary

- [ ] On `/teacher/classes/<classId>`, the "词汇练习概况" card renders
- [ ] Shows class average CORE mastery % for both KET and PET
- [ ] Top 5 / Bottom 5 student lists are populated and sorted correctly
- [ ] Numbers update after a student completes practice
- [ ] Empty class (no students) renders cleanly with "班级还没有学生。" placeholder

## Test 7 — Teacher per-student page

- [ ] On `/teacher/classes/<classId>/students/<studentId>`, the "词汇练习" section renders
- [ ] Per-tier counts shown for both KET and PET (e.g. KET: CORE 5/409 / RECOMMENDED 0/1164 / EXTRA 0/45)
- [ ] 30-day sparkline visible; cells colored proportional to activity
- [ ] Hovering a cell shows tooltip "X 天前: N 次复习"
- [ ] Empty student (no vocab activity) shows all 0s + fully-grey sparkline (no broken layout, no NaN)

## Test 8 — Theme correctness

- [ ] Force `prefers-color-scheme: dark` in DevTools → vocab pages still readable (text contrast OK)
- [ ] Force `light` → matches the existing app appearance (white bg, neutral borders, blue CTAs)
- [ ] CORE tier card retains its amber tint (gold accent) in both modes — only intentional non-neutral element

## Test 9 — No Phase 1-3 regression

- [ ] One Reading attempt end-to-end (KET) — start, answer, submit, see grade
- [ ] One Listening attempt end-to-end (KET) — generate, play, answer, submit
- [ ] One Speaking session end-to-end (KET) — Mina greets, ask 1 Q, end, see rubric
- [ ] Phase 3 photo URLs still work — they should auto-redirect 308 from /api/speaking/photos/[...key] → /api/r2/[...key]

## Sign-off

- [ ] All 9 tests pass
- [ ] No regression in Phase 1-3
- [ ] Vitest + pytest suites green: `pnpm --filter web exec vitest run` (181/181) and `cd services/ai && .venv/Scripts/python.exe -m pytest` (124/124)
- [ ] Final commit: `chore(phase4a): Vocab module sign-off — code-complete`

Reviewer: __________________ Date: __________________
