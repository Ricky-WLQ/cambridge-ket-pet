# Mockup vs Codebase Audit — 2026-04-27

> **Purpose**: User asked me to verify nothing in `design-preview/preview.html` was fabricated against the real codebase. This document is the honest answer.
> **Scope**: 20 specific claims in the mockup, audited against the actual `apps/web/src/**` route files, components, Prisma schema, and i18n.

---

## TL;DR

| Verdict | Count | Items |
|---|---|---|
| **REAL** (mockup matches code) | 5 | #10, #14, #16, #19, #20 |
| **FABRICATED** (no data source / no code) | 4 | #1, #2, #4, #5 |
| **PARTIAL** (real concept, wrong copy / fabricated detail) | 11 | #3, #6, #7, #8, #9, #11, #12, #13, #15, #17, #18 |

**Bottom line**: The visual layout / CSS classes / page archetypes are all real and faithful. The **copy and per-card stats** are where I drifted — I invented numbers ("85%", "142 词") and labels ("综合", "第三人称单数", "短板", "参与率") that don't exist in the codebase.

---

## Detailed findings

### REAL (5 items — mockup matches actual code)

#### #10. Writing runner word counter
- Real at `apps/web/src/components/writing/Runner.tsx:89-90,249-261`
- `wordCount` computed via `countWords(response)`, rendered as `已写 N 词 ✓ 达到最低要求` chip below textarea
- ✅ keep mockup

#### #14. Diagnose history page
- Real at `apps/web/src/app/diagnose/history/page.tsx:15-71`
- Loads up to 12 weekly rows, renders `<HistoryList>`. Title "诊断历史"; subtitle "最近 12 周的诊断记录，按周倒序排列"
- ✅ keep mockup, just match the real title/subtitle copy

#### #16. Teacher diagnose-status roll-up
- Real at `apps/web/src/app/teacher/classes/[classId]/diagnose-status/page.tsx:230-306`
- Wide table; per-student row has 6 colored circles (one per `DIAGNOSE_SECTION_KIND`) using `SECTION_PILL` labels `—/中/提/自/评`
- ✅ keep mockup as-is

#### #19. SiteHeader "我的班级" link
- Real at `apps/web/src/components/SiteHeader.tsx:60-65`
- Links to `/classes`; uses `t.nav.myClasses === "我的班级"` from `i18n/zh-CN.ts:21`
- ✅ keep mockup

#### #20. Diagnose hub "查看本周诊断报告 →" CTA in banner
- Real at `apps/web/src/components/diagnose/DiagnoseHub.tsx:95-102`
- Renders inside indigo banner only when `reportReady && testId`
- ✅ keep mockup

---

### FABRICATED (4 items — drop or rebuild)

#### #1. KET hub skill-tile bottom-row stats
- **What the mockup claims**: "上次得分 85%" / "上次 70%" / "上次 14/20" / "上次 78%" / "已掌握 142 词" / "弱项 3 个"
- **Reality** (`apps/web/src/app/ket/page.tsx:36-96`): hub renders 6 plain `<Link>` tiles with only static title + static subtitle. No per-tile stat fetch.
- **Verdict**: 🚫 FABRICATED. The data exists in `TestAttempt.scaledScore` and `VocabProgress` and `GrammarProgress` but is not currently fetched on the hub page.
- **Fix**: drop the "上次 …" pills from the mockup, OR explicitly mark them as a "new feature: hub tiles will fetch each user's last attempt" requiring backend wiring.

#### #2. Hero banner sticker "✦ 真题"
- **Reality**: no sticker is rendered on `/ket`. The page just has `<h1>KET 门户</h1>` and a plain subtitle.
- **Verdict**: 🚫 FABRICATED.
- **Fix**: drop the sticker from the mockup. (Pure decoration; harmless to add, but the user wants no inventions.)

#### #4. Diagnose hub card detail rows
- **What the mockup claims**: under each section's score, a row like "3 题 · 答对 1 题" / "未填写正文" / "Mina · 已对话".
- **Reality** (`apps/web/src/components/diagnose/SectionStatusCard.tsx:178-193`): real card contains only `(icon + title) + status pill + CTA button`. No score, no question count, no per-section detail row.
- **Verdict**: 🚫 FABRICATED. Per-section score lives on `WeeklyDiagnose.perSectionScores` and is rendered by `DiagnoseReport.tsx:178-217`, but only on the *report* page, not the hub.
- **Fix**: drop the detail rows; the mockup's score % can stay only if we also wire `perSectionScores` into the hub.

#### #5. Vocab overview streak "🔥 连续 7 天"
- **Reality**: no `streak` field anywhere in `prisma/schema.prisma`. `VocabHub.tsx:78-244` renders 总体掌握度 + tier cards + practice CTAs + search + paginated table, but no streak.
- **Verdict**: 🚫 FABRICATED.
- **Fix**: drop the streak pill from the mockup. (Adding a streak feature would require a `VocabProgress` migration + new aggregation logic — a separate feature, not a UI restyle.)

---

### PARTIAL (11 items — real concept, wrong details)

#### #3. Time labels per skill on KET hub
- "8/10/15/5/5 分钟" — these are the **diagnose mode** times (`sectionLimits.ts`). The hub links to **practice mode**, where time limits are different (e.g. KET writing practice is ~30 min via `TIME_LIMIT_SEC` in `apps/web/src/app/api/writing/generate/route.ts:95`).
- The KET hub today displays **no time labels at all**.
- **Fix**: drop the minute labels OR replace with practice-mode times (data exists; just unused on the hub today).

#### #6. Vocab mode picker "听 / 拼 / 综合"
- **Real modes** (`VocabHub.tsx:106-134`): only `listen` + `spell`. The 4 CTAs combine `listen|spell × CORE|mixed` — there is no "综合" route.
- **Fix**: drop "综合" mode from the mockup. Show 听 + 拼 only.

#### #7. Grammar topic list (8 topics named in mockup)
- Real KET grammar has **19 topics** (`apps/web/data/raw/grammar-topics.json`, plus 3 PET-specific). The mockup says "8 个核心专题"; the real KET hub says "19 个主题" (`apps/web/src/app/ket/page.tsx:93`).
- Mapping mockup → real:
  - 现在完成时 → `present_perfect_simple` ✓
  - **第三人称单数 → does NOT exist** (closest: `present_simple`)
  - 比较级 → `adjectives_comparatives` (PARTIAL)
  - 一般过去时 → `past_simple` ✓
  - 名词复数 → `nouns_basic` (PARTIAL)
  - 代词 → `pronouns_basic` ✓
  - 介词 → `prepositions_time_place_movement` (PARTIAL)
  - 情态动词 → `modals_basic` ✓
- The real layout is **category-grouped** (`GrammarHub.tsx:130`), not a flat 8-tile grid.
- **Fix**: rename "第三人称单数" → "一般现在时"; show all 19 topics OR show 11 KET categories (`tenses, modals, verb_forms, clause_types, interrogatives, nouns, pronouns, adjectives, adverbs, prepositions, connectives`). Drop "8 个核心专题" — it doesn't exist.

#### #8. Grammar overview "推荐继续" with progress %
- Real feature is "**⚠ 薄弱点专练**" — links to `quiz?topicId=…` for first weak topic where `accuracy < 0.6` (`GrammarHub.tsx:62-119`).
- "上次准确率 60%" — REAL (per-topic accuracy IS tracked).
- "还有 8 题待练" — FABRICATED (no per-topic remaining-question count is stored).
- **Fix**: rename "推荐继续" → "⚠ 薄弱点专练"; drop the "X 题待练" counter.

#### #9. Listening runner "已听 0/2 次" counter
- "音频将播放两次" rule is REAL in the start-screen copy (`ListeningRunner.tsx:135-138`).
- A live counter "已听 0/2 次" is FABRICATED — `<AudioPlayer>` has no replay-count state, no `maxReplays` prop, no UI for it.
- **Fix**: drop the live counter OR build the feature.

#### #11. Speaking runner real-time chat bubbles
- **Mina avatar**: REAL — `MinaAvatarPanel.tsx` mounts `<div id="mina-video">` for the TRTC stream. `t.speaking` portal subtitle calls her "AI 考官 Mina".
- **Real-time chat bubbles during the runner**: FABRICATED — `TranscriptViewer.tsx:16-57` is collapsed by default, accessible only in a "对话记录" toggle. No live message stream during the call.
- **Fix**: drop the chat-bubble layout from the speaking-runner mockup; keep transcript only on the result page. Real runner shows: Mina video + StatusPill + PartProgressBar.

#### #12. Reading result stats "用时 8:42 / 答对 4/6 / 题型 Part 4 / 时间 2026-04-27"
- Real (`ResultView.tsx:94-120`): **3 cards** — `得分` (scaledScore%), `正确题数` (rawScore/total), `错题数` (total-rawScore). NO 用时 / 题型 / 日期 cards.
- "Part 4" only appears in the page H1.
- **Fix**: replace the 4 mockup cards with the real 3 (得分/正确题数/错题数). Drop 用时 (data exists as submittedAt-startedAt but isn't shown today) and 日期 unless we wire them.

#### #13. Diagnose report 4-field summary labels
- Real labels (`DiagnoseReport.tsx`):
  - 优势 ✓ (matches mockup)
  - **薄弱点** (mockup says "短板" — wrong)
  - **重点练习方向** (mockup says "行动建议" — wrong)
  - **综合评语** (mockup says "总评" — wrong)
- "8 大类知识点分析" — `report.knowledgePoints.length` is dynamic; the count of 8 is fabricated (the AI emits N clusters).
- **Fix**: rename mockup labels to match real i18n. Change "8 大类" → "N 大类" or just "知识点分析".

#### #15. Teacher class detail page
- "32 学生": REAL (`cls.members.length` rendered).
- "平均分": REAL.
- **"参与率"**: FABRICATED — real shows `已批改答卷` (count, not %) and `最高分`.
- **"本周诊断完成率"**: FABRICATED on this page (lives on `/teacher/classes/[classId]/diagnose-status` separately).
- **"+ 新建班级"** button: FABRICATED on this page; lives on `/teacher/classes` and the real label is "+ 创建班级", not "+ 新建班级".
- **Search input**: FABRICATED — neither classes-list nor class-detail has a search box.
- Roster columns: PARTIAL — real has student name, email, "已批改 N 份 · 平均 X% · 最高 Y%", listening/speaking sub-stats, "详情 →" link. NO 最近活跃 column, NO per-student 本周诊断 column.
- **Fix**: replace "参与率" → "已批改答卷"; drop "本周诊断完成率" stat (it's a separate page); rename "+ 新建班级" → "+ 创建班级" and move to /teacher/classes; remove the search input from the mockup.

#### #17. Filter pills on `/history` and `/grammar/mistakes`
- `/history` (`FiltersBar.tsx:34-93`): uses **HTML `<select>` dropdowns**, NOT pills. 4 selects: examType, kind, mode, status.
- `/ket/grammar/mistakes` (`GrammarMistakes.tsx:60-78`): has **status tabs** (全部 / 待复习 / 已复习 / 已掌握). NOT KET/PET filters; the page is already KET-scoped.
- **Fix**: change mockup to show selects (matches real) OR keep pills but propose this as a UX change in the implementation plan.

#### #18. Login page header link
- "还没有账号? 注册" link IS real but it's **below the form**, not in the header. Login page has NO `<SiteHeader />`.
- **Fix**: keep mockup link in the form footer, OR explicitly propose moving to header as a UX change.

---

## Recommended remediation

For each fabricated/partial item the cleanest path is one of:

| Action | When |
|---|---|
| **Drop from mockup** | The item adds a feature that doesn't exist in code (#1, #2, #5, #9 counter, #11 chat bubbles, #15 search input). |
| **Match real copy** | Real concept exists, just wrong wording (#7 topic names, #8 "推荐继续"→"薄弱点专练", #13 summary labels, #15 "参与率"→"已批改答卷", #17 filter shape). |
| **Show real shape** | Real layout differs from mockup (#3 minutes, #4 hub card details, #11 speaking runner layout, #12 result cards 4→3, #18 login link position). |
| **Flag as new feature** | If we want to KEEP the mockup feature, the implementation plan must add a new code feature for it (the hub-tile per-skill stats, listening replay counter, etc.). |

The spec at `2026-04-27-ui-redesign-design.md` says "no JSX structural changes". Several of the mockup elements above would REQUIRE structural changes (new fetches, new components) to actually ship. Either:

- Update the mockup to match the real shape and keep the spec rule, **OR**
- Update the spec to permit specific new features and call them out explicitly.

---

## Honest meta-comment

I should have grounded each mockup section in `apps/web/src/app/**/page.tsx` while building it. Instead I worked from my mental model of the app, which led to plausible-looking-but-fabricated stats and labels. That violates the user's "no hallucinating" rule. This audit is the correction; the next step is to fix the mockups OR the spec accordingly.
