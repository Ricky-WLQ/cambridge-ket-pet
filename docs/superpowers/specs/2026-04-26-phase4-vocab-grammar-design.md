# Phase 4 — Vocab + Grammar · Design

| | |
|---|---|
| **Status** | Draft — pending user approval |
| **Date** | 2026-04-26 |
| **Phase** | 4 of 4 |
| **Branch** | `phase4-vocab-grammar` (off `main` after Phase 2 + Phase 3 merges) |
| **Depends on** | Phase 1 (Reading + Writing), Phase 2 (Listening), Phase 3 (Speaking) — all merged to `main` (`4bbb34d`) and signed off |
| **Reference project** | `C:\Users\wul82\Desktop\英语AB级\pretco-app` — same-stack PRETCO A/B-level prep app with shipping vocab + grammar features. Patterns adopted, content re-sourced for Cambridge KET/PET. |
| **Slices** | 4a (Vocab, ~2.5 wks) → 4b (Grammar, ~2.5 wks) — separate branches/PRs, each independently shippable |

## 1. Context

The Cambridge KET/PET exam-prep web app has shipped Phase 1 (Reading + Writing), Phase 2 (Listening), and Phase 3 (Speaking — Akool streaming avatar) to `main`. Phase 4 adds the **Vocab + Grammar** modules promised by the README roadmap — closing out the four-phase plan.

Cambridge KET (A2 Key) and PET (B1 Preliminary) do not have a dedicated "vocabulary section" or "grammar section" in the real exam — both are tested implicitly across the four papers. Phase 4 is therefore not a fifth exam paper, but a **standalone study-aid module** that complements the exam-paper modules. Students self-direct vocab + grammar practice; teachers can assign vocab + grammar homework alongside the existing four papers.

The design follows the proven patterns from a sister project the user owns: `pretco-app` (PRETCO A/B-level prep, same Next.js 16 + Prisma + DeepSeek + Edge-TTS stack). A directed deep-read of pretco-app produced an "adopt / adapt / skip" report; this spec takes the strong-adopt patterns (SRS schema, snapshot-on-attempt mistake notebook, round-robin question variety, 3-status workflow) and rejects the weak ones (PRETCO-specific 16-type grammar taxonomy, level-1/2/3 tiering, three drifted GRAMMAR_TYPES maps, the duplicate `/api/grammar/stats` route).

Project remains non-commercial and research-grade; infrastructure costs are paid by the project owner. Hosting on Zeabur Singapore; Chinese users; AI endpoints must be China-reachable (DeepSeek direct API satisfies this).

## 2. Goals + scope

### 2.1 In scope

**Slice 4a — Vocab module:**
- Cambridge A2 Key (KET, ~1,599 words) and B1 Preliminary (PET, ~3,046 words) wordlists ingested from official Cambridge PDFs
- Three-tier essentiality scheme — `CORE / RECOMMENDED / EXTRA` — derived from English Vocabulary Profile (EVP) CEFR per-word levels with manual override layer (~5-10% editorial review)
- Three student-facing pages per exam type: vocab hub (browse + filter + practice CTAs + word table), listen+reveal practice, fill-blanks spell practice — at `/{ket,pet}/vocab/*`
- 6-step SRS interval mastery (`1m / 10m / 1h / 1d / 1w / 1mo`)
- Pre-generated single British voice audio per word (Edge-TTS → R2; ~140 MB; same voice as Phase 2 Listening for consistency)
- Chinese gloss + simple example sentence DeepSeek-authored for every word (~$5 one-time spend)
- `Assignment` extended with `VOCAB` kind: teacher targets a tier and word count by date; completion derived from `VocabProgress.mastery >= 4` count

**Slice 4b — Grammar module:**
- Cambridge handbook structure inventory (A2 Key handbook pp. 49-51, B1 Preliminary handbook pp. 70-72) ingested as ~39 grammar topics across 11 KET / 14 PET categories
- Three student-facing pages per exam type: topic hub (categories → topic chips with accuracy bars), 10-question MCQ quiz runner, mistakes review notebook — at `/{ket,pet}/grammar/*`
- AI-generated MCQ question bank (~15 per topic, ~585 total, persisted to DB; cost ~$1-2)
- 3-status mistake notebook (`NEW → REVIEWED → MASTERED`) reusing existing `NoteStatus` enum
- `Assignment` extended with `GRAMMAR` kind: teacher targets a topic and accuracy threshold; completion derived from `GrammarProgress` accuracy
- Grammar question generator agent in the Python AI service (Pydantic AI + DeepSeek + post-gen validators + 3-retry on validation failure)

**Cross-slice (both):**
- Teacher dashboard integration consistent with Phase 1-3 (per-class summary cards, per-student visibility)
- Theme matches existing app: light by default (`#ffffff` bg, `#171717` fg, Arial/Helvetica, `border-neutral-300` cards, hover-to-`border-neutral-900`); CORE tier is the only non-neutral element (`#fefce8` bg, `#ca8a04` border)
- Annual-refresh story: snapshot Cambridge PDFs into `data/raw/` with SHA256, re-seed once a year
- Cambridge attribution preserved on every record (`source` field: `"© UCLES 2025; cambridgeenglish.org/.../506886-..."`)

### 2.2 Out of scope (deferred)

- **Tight integration with Phase 1-3 mistake data** — no auto-routing of `MistakeNote` (Reading) wrong words into vocab drill, no auto-routing of Speaking `weakPoints` (e.g. `grammar.past_simple`) into grammar drill. This was explicitly considered as Path B in brainstorming and deferred to Phase 4.5 (Path A "standalone modules" chosen).
- **Unified `/history/mistakes` federation** — grammar mistakes live at `/{ket,pet}/grammar/mistakes` (siloed per pretco). A federated view across all 4 mistake silos (reading + grammar + low-mastery vocab + speaking weak points) is Phase 4.5 polish.
- **Vocab mistake notebook** — pretco doesn't have one; we don't either. Low-mastery list lives on the vocab dashboard.
- **Combined "KET+PET" wordlist** — student picks KET *or* PET per session. No tri-source like pretco's `pretco-syllabus`.
- **Per-topic grammar study guide** with Cambridge spec text + Murphy unit cross-ref + worked examples — content-authoring-heavy, deferred (Slice L territory in brainstorming).
- **Anki-style flashcard mode** — beyond the listen/spell loops, no separate flashcard swipe page in MVP.
- **Voice picker** (UK male / UK female / US male / US female like pretco) — single British voice for MVP. Voice path in R2 key (`vocab/{voice}/...`) leaves room for expansion.
- **Live timer / score on grammar quizzes** — practice mode only, no timed mock.
- **Fill-blank grammar question type** — MCQ only for MVP. Schema has `questionType` field for future expansion.
- **EVP per-word A1/A2 fine tier** — current scheme uses 3 tiers (CORE/RECOMMENDED/EXTRA). Finer-grained EVP tagging is Phase 4.5.
- **Teacher-curated custom question banks** — teachers cannot author or edit grammar questions in MVP. AI-generated bank is canonical.
- **Quest / smart-practice system** — pretco's `Quest` model and `/api/grammar/generate` consumer is out of scope for our equivalent.
- **Playwright E2E** — manual QA checklist sister to Phase 2/3, no CI automation.
- **Pre-recorded audio for B1-only words in PET** beyond vocab — sentence audio still uses Edge-TTS at runtime.

### 2.3 Success criteria (used as slice-level sign-off gates)

**Slice 4a:**
- KET vocab hub renders 1,599 words across 3 tiers with correct counts; PET hub renders ~3,046 words
- Student can complete a 20-word listen session and a 20-word spell session end-to-end
- "已掌握" advances mastery to ≥4; spell submit advances by +1 on correct, decrements on wrong
- Audio plays for every word (R2 cached primary; Web Speech fallback if R2 fetch fails)
- Teacher creates `VOCAB` assignment ("master 200 CORE KET words by Friday"); student sees it on dashboard; completion lights up automatically when threshold crossed
- Vocab pages render correctly in both light and dark `prefers-color-scheme`
- Vitest + pytest suites green; manual QA checklist signed off

**Slice 4b:**
- KET grammar hub shows 11 categories / ~16 topics; PET shows 14 categories / ~23 topics; topic accuracy color (red/amber/green) reflects student data
- Student can complete a 10-question quiz on any topic; instant feedback after each answer; explanation in Chinese; mistakes captured to GrammarProgress
- Mistakes notebook filters by status correctly; status promote/demote (NEW → REVIEWED → MASTERED) persists across refresh
- "薄弱点专练" CTA only renders when `weakTopics[]` non-empty (≥3 attempts at <60% accuracy)
- Teacher creates `GRAMMAR` assignment ("score ≥80% on Present Perfect Simple"); student completion lights up when met
- Grammar question generator produces valid MCQs in ≥95% of calls (3-retry catches the rest); validators reject classification questions and out-of-level vocab
- Vitest + pytest suites green; manual QA checklist signed off

**Phase 4 overall:**
- No regression in Phase 1-3 features after merge (Reading, Writing, Listening, Speaking all green on regression sweep)
- Schema migration applies cleanly to a fresh DB and to a Phase-3 production-snapshot DB
- Cambridge attribution surfaced on at least one user-facing screen per module
- Annual-refresh runbook documented in `apps/web/scripts/README.md`

## 3. Pretco-app pattern study — adopt / adapt / skip

The full deep-read report lives in conversation history; the relevant decisions:

### Strong adopt
- **`VocabProgress` SRS schema** with 6-step interval table (port verbatim, rename `vocabType` → `examType` to match our enum)
- **`GrammarQuestion` shared bank + `GrammarProgress` per-user attempt with snapshot fields** (questionText / questionOptions / correctIndex / explanationZh copied into the attempt row — survives question deletes/edits; the single best decision in pretco's schema)
- **`generateFillBlank()`** algorithm (40% letter blanks, segments) — pure function, exam-agnostic
- **`/api/grammar/questions` round-robin-by-topic** spread for variety in mixed quizzes
- **3-status mistake workflow** (`NEW → REVIEWED → MASTERED`) — reuse existing `NoteStatus` enum
- **Web Speech API client-side fallback** — zero cost, China-friendly, when R2 fetch fails
- **Listen + Spell page UX** — definition-first / word-hidden display, per-blank Enter/Tab spell input

### Drop / fix from pretco
- **Pretco's `level: 1|2|3` ★-star tiering** — replaced with our 3-tier `WordTier` enum derived from EVP CEFR (different basis, defensible to teachers)
- **`/api/grammar/stats` literal duplicate** — collapsed into `/api/grammar/progress`
- **Three drifted `GRAMMAR_TYPES` maps** (lib/pretco-passages.ts: 14; grammar/page.tsx: 16; mistakes/page.tsx: 31 with aliases) — replaced with one canonical `GrammarTopic` table seeded from Cambridge handbook
- **Pretco's 16-type grammar taxonomy** (subjunctive, inversion, etc.) — PRETCO-specific, advanced. Re-derived from Cambridge handbook structure inventory for KET/PET.
- **`mistakePatterns[0]` weak-point button** wired to a field the API never returns — bug. Our equivalent reads `weakTopics[]` actually returned by `/api/grammar/progress`.
- **`/api/grammar/generate` pretco threw away results** — we persist to `GrammarQuestion` so AI spend isn't wasted.
- **Three siloed mistake stores** (MistakeNote / GrammarProgress / VocabProgress) without unification — kept siloed for MVP per Path A choice; `/history/mistakes` federation is Phase 4.5.

### Adapt
- **Static JSON word data → Postgres `Word` table** — pretco bundles JSON; we seed into DB for teacher-side queryability and cleaner versioning.
- **Pretco's grammar AI prompt** (whitelist + classification-question reject + ABCD shuffler) — excellent design, port through our Python AI service for structured outputs (Pydantic AI + DeepSeek + validators) instead of raw fetch.
- **Audio strategy** — pretco uses Web Speech API only. We use Edge-TTS pre-generated MP3s in R2 for voice consistency with Phase 2 Listening, with Web Speech as client fallback.

## 4. Sourcing — Cambridge canonical, EVP cross-reference, DeepSeek for gloss

### 4.1 Vocabulary

| Source | URL | Format | Word count | Use |
|---|---|---|---|---|
| **A2 Key Vocabulary List** | `cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf` | 32-page PDF, alphabetical, headword + POS in parens + optional disambiguation example, topic appendix | 1,599 (Aug 2025 update slightly larger) | KET wordlist canonical |
| **B1 Preliminary Vocabulary List** | `cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf` | 53-page PDF, same conventions | 3,046 | PET wordlist canonical |
| **Cambridge methodology note** | `cambridgeenglish.org/images/561337-key-preliminary-revisions-wordlists.pdf` | 9-page UCLES research note | — | Provenance citation in spec |
| **English Vocabulary Profile (EVP)** | englishprofile.org (free registration) | CSV with per-word CEFR (A1/A2/B1/B2/...) | ~5,000+ items | Initial tier derivation |

PDFs cached locally by the sourcing agent in `~\.claude\projects\...\tool-results\`; copied into `data/raw/` on first ingest with SHA256 checksum recorded.

### 4.2 Grammar

| Source | URL | Page range | Use |
|---|---|---|---|
| **A2 Key Handbook for Teachers** | `cambridgeenglish.org/images/504505-a2-key-handbook-2020.pdf` | pp. 49-51 "Language specifications" | KET grammar inventory canonical |
| **B1 Preliminary Handbook for Teachers** | `cambridgeenglish.org/Images/168150-b1-preliminary-teachers-handbook.pdf` | pp. 70-72 "Language specifications" | PET grammar inventory canonical |
| **Murphy English Grammar in Use** (Intermediate, 5th ed., British, 145 units) | `cambridge.org/cambridgeenglish/catalog/grammar-vocabulary-and-pronunciation/english-grammar-use-5th-edition` | full TOC | Murphy unit cross-ref per topic |
| **Murphy Essential Grammar in Use** (4th ed., A1-A2, 115 units) | `assets.cambridge.org/97811074/80551/frontmatter/9781107480551_frontmatter.pdf` | full TOC | A2-level Murphy unit cross-ref |

Grammar inventory text is small (~5 KB total across both handbooks). Hand-transcribed once into `data/raw/grammar-topics.json` with category slugs assigned by the architect. Murphy TOC similarly hand-transcribed into `data/raw/murphy-toc.json`.

### 4.3 Chinese gloss + example authoring

DeepSeek-authored via the AI service. Per the sourcing agent's recommendation, this beats scraping `testdaily.cn` / `百词斩` / `扇贝` cross-reference because:
- Total quality control (we own the prompt and output)
- ~$5 one-time spend for full PET 3,046-word list including examples
- Examples can target Chinese student daily life (school / family / weekend / subjects / food) for relatability
- Avoids quality variance and paywall / SEO-spam risks of 3rd-party Chinese sources

Cross-reference materials (思维导图剑桥KET/PET词汇巧学巧记 books, TestDaily blog series) used only for spot-checking ambiguous entries during the manual override pass.

### 4.4 Copyright posture

All four primary PDFs are `© UCLES` / `© CUPA`. Cambridge's published terms permit teachers/learners to download and use these freely; redistributing the *content* in derivative form is treated as factual data (which is not copyrightable in most jurisdictions, though selection-and-arrangement may be). Standard EdTech practice: cite Cambridge as source on every record, do not republish the PDFs themselves, surface attribution to the user. If commercialization is later considered, consult a Chinese copyright lawyer.

## 5. Architecture overview

5 new Postgres tables, 2 new Python AI agents, schema additions to the existing `Assignment` model, no changes to auth / classes / TestAttempt.

```
Browser (student + teacher)
    │
    ├── /{ket,pet}/vocab/* ── 3 vocab pages (hub, listen, spell)
    ├── /{ket,pet}/grammar/* ─ 3 grammar pages (hub, quiz, mistakes)
    └── /teacher/... ──── Assignment forms gain VOCAB + GRAMMAR types
                           Class summary card gains vocab + grammar rows
                           Per-student page gains vocab + grammar visibility
    ↓ HTTPS (server-only — DeepSeek key never leaves the server)
Next.js (apps/web)
    ├── /api/vocab/{words,progress,audio/[wordId]}      ── 5 routes (vocab)
    ├── /api/grammar/{topics,questions,progress,mistakes,generate}  ── 7 routes
    └── existing routes unchanged
    ↓ Prisma 6
Postgres
    ├── (new) Word                    ── Cambridge wordlist + EVP-derived tier
    ├── (new) VocabProgress            ── per-user SRS state
    ├── (new) GrammarTopic             ── handbook structure inventory + Murphy refs
    ├── (new) GrammarQuestion          ── AI-generated MCQ bank (persisted, top-up on demand)
    ├── (new) GrammarProgress          ── per-user attempt log + mistake notebook
    ├── (extended) Assignment          ── +VOCAB / +GRAMMAR kinds + 3 nullable target fields
    ├── (extended) TestKind enum       ── +VOCAB +GRAMMAR
    └── existing tables unchanged

Python AI service (services/ai/)
    ├── (new) agents/vocab_gloss.py            ── one-shot batch: EN word → ZH gloss + example
    ├── (new) agents/grammar_generator.py      ── per (examType, topicId) → 10-15 MCQs
    ├── (new) prompts/{vocab_gloss,grammar_generator}_system.py
    ├── (new) schemas/{vocab,grammar}.py        ── Pydantic AI output_type models
    └── (new) validators/{vocab,grammar}.py    ── post-gen rejection + 3-retry

External
    ├── Edge-TTS (reused) ── pre-gen ~4,600 word MP3s (single British voice)
    └── R2 (reused)        ── new prefix vocab/{voice}/{cambridgeId}.mp3
                              served via existing r2-signed-url helper

Seed pipeline (apps/web/scripts/, run-once + annual)
    ├── parse-cambridge-pdfs.ts        ── PDFs → Word rows (~4,600)
    ├── fetch-evp-cefr-tags.ts          ── EVP CSV → Word.tier auto-assign
    ├── apply-tier-overrides.ts         ── data/raw/word-tier-overrides.csv → Word.tier
    ├── generate-vocab-glosses.ts       ── DeepSeek → Word.glossZh + example
    ├── generate-vocab-audio.ts         ── Edge-TTS → R2 → Word.audioKey
    ├── parse-handbook-grammar.ts       ── data/raw/grammar-topics.json → GrammarTopic rows
    ├── seed-grammar-glosses.ts         ── DeepSeek → labelZh + examples + Murphy units
    └── seed-grammar-questions.ts       ── DeepSeek → ~585 GrammarQuestion rows
```

All seed scripts are **idempotent** — re-runs skip rows already populated.

### 5.1 Schema additions to existing models

```prisma
enum TestKind {
  READING
  WRITING
  LISTENING
  SPEAKING
  VOCAB        // NEW (Phase 4)
  GRAMMAR      // NEW (Phase 4)
  MOCK_FULL
  MOCK_SECTION
}

enum WordTier {
  CORE          // 必修 ★★★ — must master to pass
  RECOMMENDED   // 推荐 ★★  — strongly recommended for confident pass
  EXTRA         // 拓展 ★   — extension; not required, helps high scores
}

// add to Assignment
model Assignment {
  // ... existing fields ...
  targetTier       WordTier?    // VOCAB only — null = "all tiers"
  targetWordCount  Int?         // VOCAB only — "master >= N words from targetTier"
  targetTopicId    String?      // GRAMMAR only — null = "any topic"
  // existing minScore: Int?  (0-100) is reused — for GRAMMAR assignments it
  // means accuracy threshold (e.g. minScore=80 → "score ≥80% on the topic").
  // For VOCAB, use targetWordCount instead; minScore is ignored.
  // existing dueAt, examType, kind, classId, etc. unchanged
}
```

`NoteStatus` enum (`NEW / REVIEWED / MASTERED`) is reused unchanged for grammar mistake review.

## 6. Slice 4a — Vocab module

### 6.1 Data model

```prisma
model Word {
  id            String   @id @default(cuid())
  examType      ExamType            // KET (A2) or PET (B1)
  cambridgeId   String              // stable key, e.g. "ket-act-v"
  word          String              // headword as in list
  pos           String              // "adj" | "n" | "v" | "phr v" | "n & v" | ...
  phonetic      String?             // IPA from EVP if available
  glossEn       String?             // Cambridge example or AI-authored short defn
  glossZh       String              // DeepSeek-authored Chinese gloss
  example       String?             // Cambridge example, else AI-authored
  topics        String[]            // ["Food and Drink", ...] appendix-2 tags
  tier          WordTier @default(RECOMMENDED)
  audioKey      String?             // "vocab/en-GB-RyanNeural/{cambridgeId}.mp3"
  source        String              // "© UCLES 2025; cambridgeenglish.org/.../506886-..."
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([examType, cambridgeId])
  @@index([examType, tier])
  @@index([examType, topics])
}

model VocabProgress {
  id            String    @id @default(cuid())
  userId        String
  examType      ExamType
  wordId        String                       // FK to Word.id
  word          String                       // denormalized snapshot
  mastery       Int       @default(0)        // 0-5
  lastReviewed  DateTime?
  nextReview    DateTime?                    // SRS-driven
  reviewCount   Int       @default(0)
  correctCount  Int       @default(0)
  source        String?                      // "spell" | "listen" | "assignment"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, wordId])
  @@index([userId, examType, mastery])
  @@index([userId, examType, nextReview])
}
```

**SRS interval table** (port from pretco, validated):

| Mastery | Next review delta on correct |
|---|---|
| 0 → 1 | 1 minute |
| 1 → 2 | 10 minutes |
| 2 → 3 | 1 hour |
| 3 → 4 | 1 day |
| 4 → 5 | 1 week |
| 5 (hold) | 1 month |

Wrong answer → `mastery = max(0, mastery - 1)`. `markMastered: true` (from "已掌握" button on listen page) → `mastery = 4` directly.

### 6.2 API surface — 5 routes

| Route | Method | Inputs | Returns |
|---|---|---|---|
| `/api/vocab/words` | GET | `?examType= &tier?= &topic?= &search?= &page?= &pageSize?=` | `{words[], totalCount, pagination}` (pageSize ≤100) |
| `/api/vocab/progress` | GET | `?examType= &tier?=` | `{progress[], stats: {total, mastered, byTier:{CORE,RECOMMENDED,EXTRA}, byMastery:[6 buckets]}}` (take=500 cap) |
| `/api/vocab/progress` | POST | `{wordId, examType, isCorrect, markMastered?, source?}` | `{progress}` — upsert + recompute mastery + nextReview |
| `/api/vocab/progress` | PUT | `{examType, limit=20}` | `{dueWords[]}` — `nextReview <= NOW`; for review-due practice |
| `/api/vocab/progress` | DELETE | `?examType= &tier?=` | `{success}` — wipes progress (optionally tier-scoped) |
| `/api/vocab/audio/[wordId]` | GET | path | 302 → R2 signed URL (5 min TTL) — reuses `r2-signed-url.ts` |

All session-gated via existing `getAuthUser()` helper.

### 6.3 Pages — 3 files

**`/{ket,pet}/vocab/page.tsx`** — Hub + practice dashboard:
- Header card with overall mastery % (computed against CORE only — students don't get deflated by EXTRA)
- 4 practice CTAs (listen/spell × CORE/mixed) — primary CTAs are CORE-tier
- 3 tier cards in a row — CORE highlighted with `#fefce8` bg + `#ca8a04` border (only non-neutral element); RECOMMENDED + EXTRA neutral
- Filter row: tier chip toggle / topic dropdown / mastery dropdown / search input
- Word table (paginated 50/page): word, POS, gloss, tier pill, mastery dots, last reviewed
- Reset button per tier (with `confirm()` dialog)

**`/{ket,pet}/vocab/listen/page.tsx`** — Audio + reveal practice:
- Settings header: tier filter, batch size (10-50, default 20), auto-reveal toggle
- Centered card: word as `?????` until reveal, audio play button, Chinese gloss, example with word redacted
- After reveal: word + phonetic appear
- Action buttons: 再听一次 / 显示单词 / ✓ 已掌握 (writes mastery=4, advances)
- Bottom nav: prev / next / 换一批

**`/{ket,pet}/vocab/spell/page.tsx`** — Fill-blanks practice:
- Settings header: tier filter, batch size, difficulty (standard / easy)
- Centered card: audio + gloss + example with word redacted
- Per-blank `<input>` boxes generated by `generateFillBlank()` (40% letter blanks, position 0 always shown)
- Enter on last blank submits; Tab/Shift-Tab navigates between blanks
- Action buttons: 再听 / 提交 (Enter) / 显示答案
- On submit: highlight wrong inputs red with correct letter shown beneath; POST progress
- On reveal: POST progress with `isCorrect=false`

All three pages share a thin layout shell with back-nav and tier-filter persistence (carries between pages).

### 6.4 Audio pipeline

- **Voice**: same British voice as Phase 2 Listening (read from `apps/web/src/lib/audio/voices.ts` at impl time — likely `en-GB-RyanNeural` or `en-GB-SoniaNeural`)
- **Format**: MP3, 16 kHz mono (~30 KB/word)
- **R2 key**: `vocab/{voice}/{cambridgeId}.mp3` (voice in path enables future variants)
- **Concurrency**: 5 parallel Edge-TTS requests during seed (matches Phase 2 listening cap)
- **Total seed time**: ~4,600 words × ~1.2s ÷ 5 ≈ ~18 min for full pre-gen
- **Storage**: ~140 MB total per voice variant; cost ~$0.002/month
- **Serving**: `/api/vocab/audio/[wordId]` returns 302 → R2 signed URL (5 min TTL) using existing helper
- **Client fallback**: if R2 fetch errors, vocab pages fall back to `window.speechSynthesis.speak(word)` so audio always works

### 6.5 Seed pipeline — 5 scripts in order

| # | Script | Inputs | Outputs |
|---|---|---|---|
| 1 | `parse-cambridge-pdfs.ts` | `data/raw/506886-a2-key-2020-vocabulary-list.pdf`, `506887-b1-preliminary-vocabulary-list.pdf` | ~4,600 `Word` rows with `tier=RECOMMENDED` placeholder. Uses Python `pdfplumber` via shell-out (matches Phase 2's ffmpeg pattern). |
| 2 | `fetch-evp-cefr-tags.ts` | EVP CSV from englishprofile.org (one-time download with free registration); `data/raw/evp-cefr.csv` | `Word.tier` auto-assigned per CEFR mapping: KET — A1→CORE / A2→RECOMMENDED / B1→EXTRA; PET — A1+A2→CORE / B1→RECOMMENDED / B2→EXTRA |
| 3 | `apply-tier-overrides.ts` | `data/raw/word-tier-overrides.csv` (hand-curated, ~5-10% of words) | `Word.tier` overridden for listed entries. Override CSV checked into git for auditability. |
| 4 | `generate-vocab-glosses.ts` | All `Word` rows missing `glossZh` or `example`; AI service `/vocab-gloss` endpoint | `Word.glossZh`, `Word.example` filled. Batches of 50, ~$5 total spend. |
| 5 | `generate-vocab-audio.ts` | All `Word` rows missing `audioKey`; Edge-TTS | R2 objects + `Word.audioKey` updated. ~18 min total. |

All idempotent — re-runs skip populated rows.

PDF parsing edge cases (multi-line bulleted examples, multi-POS entries like `back (n, adv & adj)`) get a manual cleanup pass; estimate ~30 min per 1,000 entries (KET ~15 min, PET ~90 min).

### 6.6 Teacher integration — VOCAB assignments

**Schema additions** (covered in §5.1): `targetTier?`, `targetWordCount?` on `Assignment`.

**Assignment-creation UI** (`/teacher/classes/[classId]/assignments/new`) gains VOCAB-specific form when `kind=VOCAB`:
- Tier picker: CORE / RECOMMENDED / EXTRA / ALL (radio)
- Word count target (numeric input, default suggested = 100)
- Due date (existing field)

**Completion derivation** (server-side, in `lib/assignmentActions.ts`):
```
For each (student, assignment) where assignment.kind == VOCAB:
  count = SELECT COUNT(*) FROM VocabProgress
          WHERE userId = student.id
            AND examType = assignment.examType
            AND mastery >= 4
            AND (assignment.targetTier IS NULL OR Word.tier = assignment.targetTier)
  complete = count >= assignment.targetWordCount
```

**Class summary card** (`/teacher/classes/[classId]/page.tsx`) gains a vocab row:
- "Average vocab mastery (CORE) — KET 38% · PET 12%" (class-aggregated)
- Top 5 students by CORE-tier mastery
- Bottom 5 (intervention list)

**Per-student page** (`/teacher/classes/[classId]/students/[studentId]/page.tsx`) gains:
- Vocab mastery sparkline (last 30 days)
- Per-tier breakdown (CORE / RECOMMENDED / EXTRA mastered counts)

### 6.7 Testing strategy

**Vitest** (TypeScript, in `apps/web/src/lib/vocab/__tests__/` and route `__tests__/`):
- SRS interval math — all 6 mastery levels × {correct, wrong, markMastered} = 18 cases
- `generateFillBlank()` — port from pretco + edge cases (1-letter words, words with apostrophes/hyphens, all-vowel words)
- All 5 API route handlers — happy paths + auth-rejection + invalid-input
- `vocab/words` filter combinations (tier × topic × search × mastery)

**pytest** (Python AI service, in `services/ai/tests/`):
- `vocab_gloss` agent: structured output schema validation
- Reject responses with English-only gloss, missing example field, or example not containing the headword
- 3-retry behavior on validation failure

**Manual QA checklist** at `docs/superpowers/specs/2026-XX-phase4a-vocab-manual-qa.md`:
- Hub: 3 tier sections render correctly; word list paginates; filter combos work
- Listen: audio plays; reveal works; 已掌握 advances mastery
- Spell: Enter/Tab navigation; correct/wrong feedback; reveal-answer
- Teacher: VOCAB assignment created → student sees on dashboard → completion lights up at threshold
- KET and PET both end-to-end
- Theme correct in light + dark `prefers-color-scheme`

### 6.8 Effort estimate

| Bucket | Hours |
|---|---|
| Schema migration | 1 |
| Seed scripts (5) | 12 |
| API routes (5) | 6 |
| Vocab pages (3) | 16 |
| Audio pipeline + R2 wiring | 4 |
| Teacher integration (assignment + class card + student page) | 8 |
| Tests (Vitest + pytest) | 8 |
| Manual QA + polish | 4 |
| **Slice 4a total** | **~60h ≈ 2.5 weeks** |

## 7. Slice 4b — Grammar module

### 7.1 Data model

```prisma
model GrammarTopic {
  id            String   @id @default(cuid())
  examType      ExamType            // KET or PET
  category      String              // "tenses" | "modals" | "verb_forms" | "clause_types" | ...
  topicId       String              // stable slug "present_perfect_simple"
  labelEn       String              // "Present perfect simple"
  labelZh       String              // "现在完成时"
  spec          String              // Cambridge handbook spec text (verbatim quote)
  description   String?             // longer explanation for future study-guide use
  examples      String[]            // 3-5 hand-curated example sentences
  murphyUnits   Int[]               // Murphy English Grammar in Use unit numbers
  source        String              // "© UCLES 2025; A2 Key handbook 2020 p.49"

  questions     GrammarQuestion[]
  progress      GrammarProgress[]

  @@unique([examType, topicId])
  @@index([examType, category])
}

model GrammarQuestion {
  id            String   @id @default(cuid())
  examType      ExamType
  topicId       String              // FK to GrammarTopic.id
  topic         GrammarTopic @relation(fields: [topicId], references: [id])

  questionType  String   @default("mcq")  // MVP = MCQ only; fill-blank later
  question      String              // "She _____ in this factory since 2018."
  options       String[]            // 4 options
  correctIndex  Int                 // 0..3
  explanationEn String?             // optional English explanation
  explanationZh String              // always present
  difficulty    Int      @default(2)  // 1-5
  source        String              // "ai:deepseek:2026-04-26" or "seed:cambridge"
  createdAt     DateTime @default(now())

  @@index([examType, topicId])
}

model GrammarProgress {
  id              String     @id @default(cuid())
  userId          String
  questionId      String              // FK to GrammarQuestion.id
  examType        ExamType
  topicId         String              // denormalized for fast filtering
  topic           GrammarTopic @relation(fields: [topicId], references: [id])

  isCorrect       Boolean
  userAnswer      Int                 // 0..3 index

  // snapshot fields — survive question deletes/edits (pretco's best pattern)
  questionText    String
  questionOptions String[]
  correctIndex    Int
  explanationZh   String

  status          NoteStatus @default(NEW)   // reuse existing enum
  createdAt       DateTime   @default(now())
  reviewedAt      DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, examType, topicId])
  @@index([userId, examType, status])
  @@index([userId, isCorrect])
}
```

### 7.2 Topic taxonomy

Cambridge handbook structure inventory mapped into 11 KET / 14 PET categories with ~16 KET / ~23 PET total topics. Hub displays **categories**; clicking expands to topic chips.

**KET categories** (11): `tenses`, `modals`, `verb_forms`, `clause_types`, `interrogatives`, `nouns`, `pronouns`, `adjectives`, `adverbs`, `prepositions`, `connectives`.

**KET topics** (~16):
- `tenses`: Present simple, Present continuous, Past simple, Past continuous, Present perfect, Future (will / going to)
- `modals`: Modals (can/could/would/should/must/may/need)
- `verb_forms`: Imperatives, Gerunds, Infinitives (with/without `to`), Passive (present + past simple)
- `clause_types`: Main + subordinate (`if`/`when`/`because`)
- `interrogatives`: Question forms (wh-, yes/no, short answers)
- (one rolled-up topic each for the remaining 6 categories)

**PET adds** 3 new categories + ~4 new topics within existing categories (PET = KET inventory + extras):
- New categories: `conditionals` (Type 0/1/2), `reported_speech` (statements/questions/commands), `phrasal_verbs` (common phrasal verbs)
- New topics within existing categories: `tenses/was_were_going_to`, `modals/might_ought_used_to`, `verb_forms/modal_passive`, `clause_types/relative` (defining + non-defining), plus reflexive pronouns, sentence adverbs, and prepositions-following-words rolled in as topic-level extensions of `pronouns` / `adverbs` / `prepositions`

Total: ~39 topics × 15 questions ≈ ~585 grammar questions to AI-seed.

### 7.3 API surface — 7 routes

| Route | Method | Inputs | Returns |
|---|---|---|---|
| `/api/grammar/topics` | GET | `?examType=` | `{topics[], byCategory: {tenses:[...], modals:[...], ...}}` |
| `/api/grammar/questions` | GET | `?examType= &topicId?= &count=10` | `{questions[], totalCount}` — round-robin spread across topics if no `topicId` |
| `/api/grammar/progress` | GET | `?examType=` | `{totalAttempted, totalCorrect, accuracy, perTopic, weakTopics[]}` |
| `/api/grammar/progress` | POST | `{questionId, examType, topicId, userAnswer, isCorrect, questionText, questionOptions, correctIndex, explanationZh}` | `{progress}` — idempotent (skip if `(userId, questionId)` exists) |
| `/api/grammar/mistakes` | GET | `?examType= &status?= &page?= &pageSize?=` | `{data, grouped:{byTopic}, counts:{NEW, REVIEWED, MASTERED, total}, pagination}` |
| `/api/grammar/mistakes` | PUT | `{id, status: NoteStatus}` | `{progress}` — status promote/demote |
| `/api/grammar/generate` | POST | `{examType, topicId, count}` | `{questions, source: 'ai'\|'fallback'}` — rate-limited 5/min/user; persists to `GrammarQuestion` |

`weakTopics[]` = topics with `accuracy < 0.6` AND `attempts >= 3`, sorted ascending by accuracy.

### 7.4 Pages — 3 files

**`/{ket,pet}/grammar/page.tsx`** — Hub (categories → topics):
- 3 stats cards across the top: total attempted / accuracy% / mistake count
- 3 quick CTAs: 随机混合 (10题, mixed), 薄弱点专练 (only renders if `weakTopics[].length > 0`), 错题复习 (with count)
- Categories list — each card shows category name (zh + en) with topic chips inside
- Topic chips colored by accuracy: green (≥80%), amber (50-80%), red (<50%), dim (unpracticed)
- Click chip → navigate to quiz runner with that topic

**`/{ket,pet}/grammar/quiz/page.tsx`** with `?topicId=X` query param — Quiz runner:
- Top: topic pill, "第 N / 10 题" counter, progress bar
- Question text with `_____` blank (or no blank if it's a usage MCQ)
- 4 ABCD option buttons
- Click → POST progress immediately → highlight selected (correct=green, wrong=red), show correct option always green, show Chinese explanation in callout
- Bottom: prev/next nav; last → "完成" returns to hub

**`/{ket,pet}/grammar/mistakes/page.tsx`** — Mistakes review:
- 4 status tabs: 全部 / 待复习 / 已复习 / 已掌握 (with counts)
- Topic filter dropdown
- Per-mistake card: topic pill + question + all options (user's wrong in red, correct in green) + Chinese explanation
- Per-card action buttons by current status:
  - NEW: 标记已复习 / 标记已掌握
  - REVIEWED: 标记已掌握 / 重新练习此题
  - MASTERED: 重新学习 (back to NEW)
- Left border color tracks status (red / amber / green)

All three pages share the back-nav-to-hub shell.

### 7.5 AI question generator agent

New Pydantic AI agent at `services/ai/app/agents/grammar_generator.py`.

**Endpoint**: `POST /grammar-generate` on the AI service.

**Inputs**:
```python
{ examType: "KET" | "PET", topicId: str, spec: str,
  examples: list[str], existingQuestions: list[str], count: int }
```

**Output schema** (`schemas/grammar.py`):
```python
class GrammarMCQ(BaseModel):
    question: str           # contains exactly one "_____" blank OR a complete-sentence question
    options: list[str]      # exactly 4, distinct
    correct_index: int      # 0..3
    explanation_zh: str     # Chinese explanation
    difficulty: int         # 1-5

class GrammarGenerateResponse(BaseModel):
    questions: list[GrammarMCQ]
```

**Validators** (`validators/grammar.py`, runs post-gen, 3-retry on failure — matches Phase 2/3 pattern):
1. exactly 4 options, all distinct (case-insensitive trim)
2. `correct_index` in `[0, 3]`
3. either exactly one `_____` blank OR no blank (usage MCQ)
4. explanation contains CJK characters (regex `[一-鿿]`)
5. vocabulary stays at level — cross-ref against `Word` table; reject if any non-A2 word in KET items
6. reject classification questions ("which of the following is a verb?")
7. distractors plausible — each option shares POS with correct answer (heuristic: if correct is a verb, all 4 must be verb forms)
8. no duplicate question text vs. existingQuestions list (avoid generator repetition)

**System prompt** highlights (`prompts/grammar_generator_system.py`):
- Use Cambridge A2/B1 vocabulary only — embed sample wordlist or category
- Generate distractors that reflect common Chinese-student errors (tense confusion, preposition mix-up, V-ing vs to-V)
- Examples should reflect Chinese student daily life (school, family, weekend, subjects, food) for relatability
- One sentence per item; no compound questions
- Avoid culture-specific references (no specific UK holidays / cities students may not know)
- Output valid JSON matching `GrammarGenerateResponse` schema

### 7.6 Seed pipeline — 3 scripts in order

| # | Script | Inputs | Outputs |
|---|---|---|---|
| 1 | `parse-handbook-grammar.ts` | `data/raw/grammar-topics.json` (hand-authored from handbook PDFs pp.49-51 / 70-72) | ~37 `GrammarTopic` rows. `labelEn`, `category`, `spec`, `source` filled. |
| 2 | `seed-grammar-glosses.ts` | All `GrammarTopic` rows missing `labelZh` / `examples` / `murphyUnits`; `data/raw/murphy-toc.json` | rows updated. AI-authored `labelZh` + 3-5 examples; manual Murphy unit lookup from TOC JSON. |
| 3 | `seed-grammar-questions.ts` | All `(examType, topicId)` pairs with fewer than 15 questions | ~585 `GrammarQuestion` rows. AI cost ~$1-2 total. |

All idempotent. Step 1's hand-curated JSON is ~5 KB total; ~2 hours of architect work to author.

### 7.7 Teacher integration — GRAMMAR assignments

**Schema additions** (covered in §5.1): `targetTopicId?` on `Assignment`. Reuses existing `minScore?: Int` for accuracy threshold.

**Assignment-creation UI** when `kind=GRAMMAR`:
- Topic picker (dropdown of `GrammarTopic`, grouped by category, with "ALL TOPICS" first option)
- Accuracy threshold slider (default 70%)
- (no minimum-questions field for MVP — completion logic hard-codes a floor of 10 attempts before evaluating accuracy; if teachers later want control over this floor, add `targetQuestions?: Int` to `Assignment` in Phase 4.5)
- Due date (existing field)

**Completion derivation**:
```
For each (student, assignment) where assignment.kind == GRAMMAR:
  rows = SELECT * FROM GrammarProgress
         WHERE userId = student.id AND examType = assignment.examType
           AND (assignment.targetTopicId IS NULL OR topicId = assignment.targetTopicId)
  attempted = COUNT(rows)
  correct = COUNT(rows WHERE isCorrect = true)
  complete = (attempted >= 10) AND (correct / attempted >= assignment.minScore / 100)
```

**Class summary card** additions:
- "Average grammar accuracy — KET 64% · PET 58%"
- Top 5 students by grammar accuracy
- "Common weakness topics" — top 3 across class with lowest accuracy (≥3 attempts class-wide)

**Per-student page** additions:
- Grammar accuracy sparkline (last 30 days)
- Per-topic accuracy bars (mirrors student's hub view)
- Mistakes count + status breakdown

### 7.8 Testing strategy

**Vitest**:
- All 7 API route handlers — happy paths + auth + invalid-input
- `/grammar/questions` round-robin distribution test (verify ≥4 different topics in a 10-question mixed pull)
- `/grammar/progress` POST snapshot integrity (verify question text/options/correctIndex copied to attempt row)
- `/grammar/mistakes` filter combos + status promote/demote (NEW→REVIEWED→MASTERED→NEW cycle)
- `/grammar/generate` rate limiting (5/min/user)

**pytest**:
- `grammar_generator` agent: structured output schema validation
- Each of 8 validators tested individually with positive + negative cases
- 3-retry behavior on validation failure
- Distractor quality (sample 50 generated questions, manually rate ≥80% as plausible — recorded in QA doc, not automated)

**Manual QA checklist** at `docs/superpowers/specs/2026-XX-phase4b-grammar-manual-qa.md`:
- Hub renders all categories with topic chips colored correctly
- Quiz: 10 questions complete, wrong answer creates GrammarProgress row with status NEW
- Mistakes: all 4 tabs filter correctly, status persists across refresh
- Teacher: GRAMMAR assignment created → student sees on dashboard → completion lights up
- KET and PET both end-to-end

### 7.9 Effort estimate

| Bucket | Hours |
|---|---|
| Schema migration | 1 |
| AI service grammar_generator + validators + pytest | 8 |
| Seed scripts (3) | 8 |
| API routes (7) | 8 |
| Grammar pages (3) | 18 |
| Teacher integration (assignment + class card + student page) | 8 |
| Tests (Vitest) | 8 |
| Manual QA + polish | 4 |
| **Slice 4b total** | **~63h ≈ 2.5 weeks** |

## 8. Theme + design system

Phase 4 uses the **existing app theme** unchanged. Per `apps/web/src/app/globals.css`:

| Token | Value | Notes |
|---|---|---|
| Background (light) | `#ffffff` | Default mode |
| Background (dark) | `#0a0a0a` | `prefers-color-scheme: dark` only — auto, no toggle |
| Foreground (light) | `#171717` | |
| Foreground (dark) | `#ededed` | |
| Font | `Arial, Helvetica, sans-serif` | NOT Geist, despite the CSS variable name |
| Border base | `border-neutral-300` (`#d4d4d4`) | |
| Border subtle | `border-neutral-200` (`#e5e5e5`) | filter rows, table dividers |
| Border hover | `border-neutral-900` (`#171717`) | + `hover:shadow-sm` |
| Card pattern | `rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm` | reused across portal pages |

**Accent palette** (for accuracy bars and status indicators only — not chrome):
- Green `#16a34a` (≥80% / mastered / correct)
- Amber `#d97706` (50-80% / reviewed / amber tier)
- Red `#dc2626` (<50% / new mistake / wrong)
- Blue `#2563eb` (primary CTAs, info, progress bars)

**CORE tier card** is the **only intentional break** from the neutral palette: subtle amber tint (`bg-yellow-50 #fefce8`, `border-yellow-600 #ca8a04`, `text-yellow-800 #a16207`) to draw attention to the must-master tier without being visually loud.

**No new components** added to a shared library in Phase 4 — page-local components are sufficient. If a vocab/grammar primitive proves reusable in Phase 5+, it gets promoted then.

## 9. Risks + mitigations

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | **Cambridge PDFs change silently** between annual checks; word counts drift | Medium | Snapshot PDFs with SHA256 in `data/raw/`; document annual refresh in `apps/web/scripts/README.md`; never hard-code 1,599/3,046 — let parsers report whatever they find |
| 2 | **PDF parsing breaks on multi-line bulleted examples or compound POS entries** like `back (n, adv & adj)` | High | Manual cleanup pass budgeted in effort estimate (~30 min/1k entries); regression test on a fixed sample of 50 known-tricky entries; reject parser output that diverges from expected count by >5% |
| 3 | **EVP CSV format changes or registration becomes paywalled** | Low | Store the EVP CSV in `data/raw/` once downloaded; if EVP is unavailable on a refresh, fall back to default `tier=RECOMMENDED` and rely on manual override CSV |
| 4 | **DeepSeek-authored Chinese gloss is occasionally wrong or culturally tone-deaf** | Medium | Validators reject English-only gloss + missing-headword example; manual spot-check 5% of seeded entries during initial QA; teachers can flag bad entries via `/teacher/...` (Phase 4.5 — for MVP just fix in DB) |
| 5 | **AI grammar generator produces invalid MCQs** (5+ options, classification questions, out-of-level vocab) | Medium | 8 post-gen validators with 3-retry; sample 50 manually during QA; rate-limit to 5/min/user prevents bulk-bad-output runaway |
| 6 | **Cambridge attribution / copyright concerns** if monetized | Low (currently non-commercial) | Source citation on every Word + GrammarTopic record; never republish PDFs; treat wordlist as factual data; consult lawyer if commercialization is later considered |
| 7 | **R2 cost spike if vocab audio gets requested heavily** | Low | Cost is dominated by storage (~$0.002/mo for 140 MB), not egress; 5-min signed URLs prevent unauthenticated hot-linking |
| 8 | **Schema migration breaks Phase 3 production snapshot** | Low | Migration is purely additive (new tables + new enum values + new nullable columns on Assignment); no data backfills required; test against Phase 3 prod snapshot before deploy |
| 9 | **Web Speech API silently differs across browsers** (Safari iOS quirks) | Medium | Edge-TTS + R2 is primary path; Web Speech is fallback only; test on Safari iOS during manual QA |
| 10 | **Pretco mistake-system silos persist into Phase 4** (3 mistake stores not unified) | Low | Documented as out-of-scope; Phase 4.5 federation work is a known follow-up |

## 10. Open questions

None blocking spec sign-off. Phase 4.5 candidates already enumerated in §2.2.

## 11. Sign-off gates

**Slice 4a sign-off requires:**
- All 5 success criteria in §2.3 met
- Vitest + pytest suites green
- Manual QA checklist signed
- KET + PET end-to-end pass on a real student account
- Theme correct in light + dark `prefers-color-scheme`
- No regression in Phase 1-3 features (smoke test: one Reading attempt, one Listening attempt, one Speaking session)

**Slice 4b sign-off requires:**
- All 7 success criteria in §2.3 met
- Same test + QA + regression checks as 4a
- Sample 50 AI-generated grammar questions manually rated ≥80% plausible

**Phase 4 sign-off requires:**
- Both slices signed off
- Combined cross-phase E2E (per the deferred Phase 2 / Phase 3 manual QA note: "Phase 4 final E2E covers all four phases together")
- Annual-refresh runbook documented

---

## Appendix A — Effort summary

| Slice | Hours | Weeks |
|---|---|---|
| 4a (Vocab) | ~60 | 2.5 |
| 4b (Grammar) | ~63 | 2.5 |
| **Phase 4 total** | **~123** | **~5 weeks** |

## Appendix B — File / folder additions

```
apps/web/
├── prisma/
│   ├── schema.prisma                          # extended: TestKind enum, Assignment fields, 5 new models
│   └── migrations/
│       └── 2026XX_phase4_vocab_grammar/migration.sql
├── scripts/
│   ├── parse-cambridge-pdfs.ts
│   ├── fetch-evp-cefr-tags.ts
│   ├── apply-tier-overrides.ts
│   ├── generate-vocab-glosses.ts
│   ├── generate-vocab-audio.ts
│   ├── parse-handbook-grammar.ts
│   ├── seed-grammar-glosses.ts
│   ├── seed-grammar-questions.ts
│   └── README.md                              # annual refresh runbook
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── vocab/{words,progress,audio/[wordId]}/route.ts
│   │   │   └── grammar/{topics,questions,progress,mistakes,generate}/route.ts
│   │   ├── ket/{vocab,grammar}/...page.tsx
│   │   └── pet/{vocab,grammar}/...page.tsx
│   ├── components/{vocab,grammar}/             # page-local components
│   ├── lib/
│   │   ├── vocab/{srs.ts,fillBlank.ts,...}
│   │   └── grammar/{taxonomy.ts,...}
│   └── i18n/zh-CN.ts                           # extended with vocab + grammar strings
└── data/raw/
    ├── 506886-a2-key-2020-vocabulary-list.pdf  # snapshot, gitignored — SHA256 in scripts/README.md
    ├── 506887-b1-preliminary-vocabulary-list.pdf
    ├── 504505-a2-key-handbook-2020.pdf
    ├── 168150-b1-preliminary-teachers-handbook.pdf
    ├── evp-cefr.csv                            # gitignored
    ├── word-tier-overrides.csv                 # IN GIT — auditable curation
    ├── grammar-topics.json                     # IN GIT — handbook structure inventory transcription
    └── murphy-toc.json                         # IN GIT — Murphy unit cross-ref source

services/ai/
├── app/
│   ├── agents/
│   │   ├── vocab_gloss.py
│   │   └── grammar_generator.py
│   ├── prompts/
│   │   ├── vocab_gloss_system.py
│   │   └── grammar_generator_system.py
│   ├── schemas/
│   │   ├── vocab.py
│   │   └── grammar.py
│   ├── validators/
│   │   ├── vocab.py
│   │   └── grammar.py
│   └── main.py                                  # registers /vocab-gloss and /grammar-generate routes
└── tests/
    ├── test_vocab_gloss.py
    ├── test_grammar_generator.py
    └── test_grammar_validators.py

docs/superpowers/
├── specs/
│   ├── 2026-04-26-phase4-vocab-grammar-design.md   # THIS DOC
│   ├── 2026-XX-phase4a-vocab-manual-qa.md          # written during slice 4a
│   └── 2026-XX-phase4b-grammar-manual-qa.md        # written during slice 4b
└── plans/
    ├── 2026-XX-phase4a-vocab-implementation.md     # written next via writing-plans
    └── 2026-XX-phase4b-grammar-implementation.md   # written after 4a sign-off
```

End of design.
