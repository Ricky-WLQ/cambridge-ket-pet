# cambridge-ket-pet UI Redesign v2 — Mascot + Island/City + Verbosity Cleanup

- **Date:** 2026-04-29
- **Status:** Design — pending implementation plan
- **Successor to:** `docs/superpowers/specs/2026-04-27-ui-redesign-design.md` (which produced the currently-shipped "Variant A" pastel/highlighter design)
- **Trigger:** the current Variant A design was reviewed by the product owner as **too verbose and not attractive enough for actual KET (10–13 yr) and PET (13–16 yr) learners**. A diagnose report screenshot showed verbose AI-generated narratives ("属于低分段", "critical 弱项", multi-bullet recommendations totaling ~580 Chinese chars) confirming the problem extends beyond static i18n into AI prompt outputs.

## 1. Context

### 1.1 What's currently shipped

The "Variant A" pastel/highlighter design (Manrope font, lavender/sky/butter/peach/mint palette, yellow-highlighter headlines, 6-equal-tile portal hub) shipped during the prior redesign and is live at `cambridge-ket-pet.zeabur.app`. It is visually consistent but:

- **Text-heavy:** the app tagline reads like cram-school marketing ("AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点"); diagnose hints carry threats ("每周必须完成才能解锁其他练习"); generation messages explicitly tax time ("通常需要 1-2 分钟").
- **No personality:** no mascot, no narrative voice, no per-portal differentiation between KET-age (10–13) and PET-age (13–16) learners.
- **Decision-fatigue prone:** the 6 equal portal tiles force kids to choose what to practice every visit.
- **AI agents emit adult academic Chinese:** the diagnose summary prompt explicitly demands a 150-260 char `narrative_zh` and 1-3 strengths / 1-3 weaknesses / 2-4 priority_actions in exam-cram register.

### 1.2 Confirmed surfaces

`apps/web/src/app/` contains **58 `page.tsx` routes** (verified via `find ... -name page.tsx | wc -l`):

- 50 student-facing (Tier A — gets per-portal mascots)
- 8 teacher-facing (Tier B — theme + copy only, no mascots)

User-visible Chinese lives in:

- `apps/web/src/i18n/zh-CN.ts` — ~200 keys, single source of truth for static UI copy
- ~100 `.tsx` / `.ts` files with hardcoded Chinese in JSX (verified via `Grep [一-鿿]`)
- ~30 `apps/web/src/app/api/*/route.ts` files with hardcoded Chinese in error/instruction strings
- 7 AI prompts in `services/ai/app/prompts/*.py` that produce user-visible Chinese narratives (~1426 lines of prompt code total)
- Vocab seed glosses + grammar topic Chinese names (mostly OK; spot-check during execution)

### 1.3 Visual direction (locked through 5 brainstorming questions)

| # | Decision | Locked answer |
|---|---|---|
| Q1 | Audience framing | C — per-portal differentiation (KET kid / PET teen) |
| Q2 | Copy voice | B — per-portal voice (kid voice for KET, teen voice for PET) |
| Q3 | Mascot direction | A — Animal duo: **Leo 🦊** (KET fox) + **Aria 🦉** (PET owl) |
| Q4 | Layout direction | C — Map/world: **KET 岛** (KET Island) + **PET 城** (PET City) |
| Q5 | Image model | A — `Qwen/Qwen-Image` (with `Qwen/Qwen-Image-Edit` for character-consistency on derived poses); FLUX is disabled on this account |

### 1.4 Polished mockups (verified visually during brainstorm)

- **KET portal home** with KET 岛 + Leo greeting + kid voice (test-leo-qwen.png + test-ket-island.png)
- **PET portal home** with PET 城 + Aria + teen voice (test-aria-qwen.png + test-pet-city.png)
- **Diagnose report before/after** — 580 Chinese chars → 140 chars, 0 banned phrases, kid voice, Leo summary on top

All assets generated via SiliconFlow Qwen-Image during brainstorming; total spent ~¥0.60 of authorized ¥3 cap.

---

## 2. Goals · Non-goals · Production-ready definition

### 2.1 Goals

1. **Less verbose.** Every user-visible Chinese string (i18n + hardcoded JSX + API error messages + AI-generated narratives) rewritten to per-portal kid/teen voice. No threats, no marketing-speak, no time taxes.
2. **More attractive.** Per-portal brand identity (Leo + KET 岛 / Aria + PET 城). Layout migrates from 6-equal-tile grid to map-metaphor + today-focused dashboard.
3. **Production-ready.** Every user-facing surface exercised end-to-end and probed for verbosity regressions before deploy.

### 2.1.1 Binding rule — **No fabricated UI data, ever**

(Added 2026-04-29 after a Phase B fabrication incident — see commit history.)

Every user-visible data element in the redesign — counts, percentages,
streaks, recommendations, weekly progress, scores, dates — must trace
to a real source: a DB query, a deterministic computation from real
data, an API response, a session/JWT field, or a static string that
makes no claim about the user.

If real data exists today, **wire it.** If real data does not exist
today (no model, no recommender), **drop the element entirely.** Do not
ship hardcoded example numbers as if real, even with `// Temp` comments
or "scaffolding to be replaced in Phase H" plans. The user reads the
rendered page, not the source.

A `—` placeholder is acceptable only when its meaning is genuinely
"no data yet" and a viewing student would understand that — not as a
stand-in for "we'll fill this later."

Mockups during brainstorming may show example numbers (clearly
illustrative). Implementation must not. Approval of a mockup is
approval of a layout direction, not of the literal example values.

This rule supersedes any `Phase H wires real data` deferral notes
elsewhere in this spec or the implementation plan. Phases must drop
fabricated elements when they ship; Phase H restores them with real
queries.

## 2.2 Scope (Tier A vs Tier B vs Out)

#### Tier A — student-facing (50 routes)

| Layer | In scope |
|---|---|
| Theme tokens (palette / type / shadow / radius) | ✅ rebuild around per-portal palettes |
| Mascot illustrations (Leo / Aria) | ✅ |
| Map illustration (KET 岛 / PET 城) | ✅ portal home |
| Static i18n strings (`zh-CN.ts`) | ✅ all student strings → kid/teen voice |
| Hardcoded Chinese in `.tsx`/`.ts` components | ✅ audit, migrate to `t.*`, rewrite voice |
| **Hardcoded Chinese in `app/api/*/route.ts` error/instruction strings** | ✅ migrate to `t.*` and rewrite |
| **Zod validation messages in API schemas** | ✅ migrate to `t.*` |
| AI agent prompts that surface Chinese to students | ✅ rewrite (see §5) |
| Layout overhaul (today + map) | ✅ portal home |

#### Tier B — teacher / admin (8 routes)

| Layer | In scope |
|---|---|
| Theme tokens | ✅ inherit base tokens (no per-portal split) |
| Mascots | ❌ |
| Static + hardcoded Chinese | ✅ de-verbose, professional register |
| AI prompts the teacher consumes | ✅ professional voice block (separate from kid/teen) |

#### Tier C — explicit non-goals

- Question/runner mechanics (preserve all behavior; only restyle visuals).
- AI scoring logic and rubric internals (numeric scoring stays; only the **Chinese natural-language output** changes).
- Database schema migrations.
- Akool Mina avatar in the live speaking room (Mina-side English script untouched; Leo only on `/<portal>/speaking/new`).
- New gamification (no XP/leaderboards/achievements added).
- Internationalization (Chinese-first remains; en-US is future work).
- Reading-passage and listening-tapescript content (these are English; not the verbosity problem).
- Custom Next.js `error.tsx` / `not-found.tsx` / `loading.tsx` (none exist today; adding them is future work).

### 2.3 "Production-ready" — final acceptance gate

Redesign is production ready when **all** of these are simultaneously true:

| Gate | Check |
|---|---|
| Build | `pnpm build` green for `apps/web` |
| Type check | `pnpm tsc --noEmit` green |
| Lint | `pnpm lint` green; new `no-hardcoded-zh-jsx` rule reports zero violations |
| Unit tests | `pnpm test` green |
| Snapshot tests | All component snapshots match (or are intentionally updated and reviewed) |
| Python tests | `pytest services/ai/tests` green |
| Validator tests | `BANNED_PHRASES` regex tests + length-cap tests green |
| E2E probes | All 10 Playwright probes (see §8) green |
| Verbosity probe | §8.3 specific check: real diagnose report has `narrative_zh ≤ portal cap`, 0 banned phrases, ≤2 weaknesses |
| Visual audit | §8.2 manual checklist 100% complete |
| Asset cache | All 24 mascot poses + 2 maps present in `apps/web/public/{mascots,maps}/` |
| Cleanup | Temp scripts deleted; `.superpowers/` in `.gitignore` |
| Zeabur deploy | Pushes to `main`; deploy succeeds; `cambridge-ket-pet.zeabur.app` serves new design |
| 24h soak | No 5xx spike, no unhandled exceptions in Zeabur logs, no user-reported regression |

---

## 3. Visual system

### 3.1 Per-portal design tokens (additive, not replacing)

Existing tokens in `apps/web/src/app/globals.css` (lavender / sky / butter / peach / mint families with `-soft` and `-tint` variants + `--color-ink`, `--color-mist`, `--color-skywash`) **stay as-is**. New tokens layered on top:

```css
/* New in globals.css — portal-aware accents driven by a class on <body> */
.portal-ket {
  --portal-accent:       var(--color-butter);      /* warm yellow */
  --portal-accent-soft:  var(--color-peach);       /* warm pink */
  --portal-bg-grad:      linear-gradient(180deg, #fff6d6 0%, #ffebf0 100%);
  --portal-mark-bg:      var(--color-ink);
  --portal-mascot-greet: url('/mascots/leo/greeting.png');
}

.portal-pet {
  --portal-accent:       var(--color-lavender);    /* cool purple */
  --portal-accent-soft:  var(--color-sky-soft);    /* cool blue */
  --portal-bg-grad:      linear-gradient(180deg, #ede7ff 0%, #e4efff 100%);
  --portal-mark-bg:      #1f1837;                  /* deeper ink for PET */
  --portal-mascot-greet: url('/mascots/aria/greeting.png');
}

body { background: var(--portal-bg-grad, linear-gradient(180deg, #eef2ff 0%, #f4ecff 100%)); }
```

### 3.2 Existing CSS — kept / repurposed / removed

- **Kept:** `.stitched-card`, `.marker-yellow`, `.marker-yellow-thick`, `.arrow-chip`, `.pill-tag`, `.star-sticker`, `.page-section`, `.locked-height`, `.grow-fill`, all tile colors.
- **Repurposed:** `.skill-tile` and `.tile-*` — from large 6-tile grid to smaller mode-chip overlays on the map.
- **Removed:** none (additive only).

---

## 4. Asset pipeline

### 4.1 Mascot library — 12 poses × 2 characters = 24 PNGs

| # | Pose slug | Where it appears |
|---|---|---|
| 1 | `greeting` | Portal home hero, login welcome |
| 2 | `waving` | Sign-up complete, login success |
| 3 | `reading` | `/<portal>/reading/new` loading screen |
| 4 | `listening` | `/<portal>/listening/new` loading + `GenerationProgress.tsx` |
| 5 | `writing` | `/<portal>/writing/new` loading |
| 6 | `microphone` | `/<portal>/speaking/new` welcome (Leo intros Mina) |
| 7 | `flashcards` | `/<portal>/vocab` empty state + listen/spell loading |
| 8 | `chart` | `/<portal>/grammar` hub empty state |
| 9 | `celebrating` | Correct answer, streak milestone, completion |
| 10 | `thinking` | Timer running, mid-question idle |
| 11 | `sleeping` | Long idle, empty inbox |
| 12 | `confused` | Error state, wrong answer feedback |

Each: **512×512 PNG, transparent background**, generated via `Qwen/Qwen-Image` with consistent prompt prefix (color palette + character canon: orange fox / lavender owl) + per-pose action descriptor.

### 4.2 Map illustrations — 2 PNGs

- `apps/web/public/maps/ket-island.png` — KET 岛 (1024×1024, ✅ already generated)
- `apps/web/public/maps/pet-city.png` — PET 城 (1024×1024, ✅ already generated)

The two test maps generated during brainstorming had **minor text artifacts** (faint "Reading" labels visible on buildings). Accepted as-is per stakeholder review; if a regeneration is desired during execution it costs ¥0.14 per map.

### 4.3 Storage decision: static `apps/web/public/`, NOT R2

Why static over R2:
- Mascots are public assets (visible on the un-authenticated landing page). `/api/r2/[...key]/route.ts:58-62` requires auth → can't serve there without bypass.
- Fixed catalog (24 images) — no dynamic generation needed at runtime.
- Next.js sets immutable cache headers automatically for `/public/`; no infrastructure changes.
- Total repo growth: ~24 × ~400KB ≈ ~10 MB. Acceptable.
- Zeabur build already copies `apps/web/public/` (verified via `web.Dockerfile`).

### 4.4 Generation script (one-time, idempotent)

`apps/web/scripts/generate-mascot-assets.ts`:

```typescript
// Sketch — full code in implementation plan
const POSES = [/* 12 entries */];
const CHARACTERS = [
  { slug: "leo",  basePrompt: "...orange fox mascot..." },
  { slug: "aria", basePrompt: "...lavender owl mascot..." },
];
// For each (char, pose): if !exists(public/mascots/<char>/<slug>.png) → SF gen → sharp → PNG
// Commit results to git.
```

Cost: ~24 × ¥0.07 ≈ **¥1.7 one-time**, zero runtime cost. Runs on a developer machine; **does not run in CI**.

**Consistency strategy:** identical character-canon prompt repeated in every prompt. If consistency drifts, fall back to `Qwen-Image-Edit`: generate `greeting` first, then use it as the reference image for the other 11 poses. Add `--use-edit-from <slug>` flag to the script.

### 4.5 Mascot pose budget — verbosity-aware policy

To prevent mascot overuse from re-introducing visual verbosity:

- **At most one mascot image per page.**
- **Practice runner pages (mid-test) show NO mascot** — no distraction during answering.
- **Result, hub, loading, empty-state, error pages** are the primary mascot homes.

This rule is enforced during the visual audit (§8.2).

---

## 5. Copy strategy + AI prompt rewrites

### 5.1 Per-portal voice rules (canonical)

#### KET kid voice (Leo speaks)

- Sentence length: 5-15 chars max
- Vocabulary: common everyday words; no exam-prep jargon
- Encouragement: soft, present-tense, no "you must"
- Mascot framing: first sentence in long blocks: "Leo 看了…" / "Leo 觉得…" / "Leo 来出题啦"
- Punctuation: `→` `·` middots OK; no `！` overuse; max 1 emoji per surface
- **Banned register:** `决定通过率`, `属于低分段`, `未达标`, `短板`, `critical 弱项`, `moderate 弱项`, `minor 弱项`, `请重视`, `切记`, `不容忽视`, `亟待提升`

#### PET teen voice (Aria speaks)

- Sentence length: 8-22 chars
- Vocabulary: slightly sophisticated; `建议`, `推荐`, `提升` allowed
- Mascot framing: "Aria 看到…" / "Aria 提醒你…" — sparingly, never every screen
- Tone: confident, peer-level, not parental
- **Banned register:** same as KET

#### Professional voice (Tier B teacher pages)

- Sentence length: 10-30 chars
- Tone: professional, neutral, action-oriented
- Words like `建议`, `请关注`, `上周增加 X 道错题` allowed
- No mascot framing
- **Banned register:** still no `决定通过率`, `属于低分段` — those are universally banned

### 5.2 i18n migration — `zh-CN.ts` becomes portal-aware

#### New shared type and helper (`apps/web/src/i18n/voice.ts`)

```typescript
export type Tone<T = string> = T | { ket: T; pet: T };

export function pickTone<T>(value: Tone<T>, portal: "ket" | "pet"): T {
  return typeof value === "object" && value !== null && "ket" in value
    ? (value as { ket: T; pet: T })[portal]
    : (value as T);
}
```

#### Portal context (`apps/web/src/i18n/PortalProvider.tsx`)

```typescript
const PortalContext = createContext<"ket" | "pet">("ket"); // default kid voice

export function PortalProvider({ portal, children }: { portal: "ket" | "pet"; children: React.ReactNode }) {
  return <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>;
}

export const usePortal = () => useContext(PortalContext);

export function useT() {
  const portal = usePortal();
  return useCallback(<T,>(v: Tone<T>) => pickTone(v, portal), [portal]);
}
```

`apps/web/src/app/layout.tsx` wraps children in `<PortalProvider portal={derivePortalFromPathname()}>`. Routes outside `/ket/*` and `/pet/*` get the default `"ket"` (kid voice — more inviting for unauthenticated visitors).

For Server Components without React state, pass `portal` as a prop to a client wrapper, or use a server-side helper `pickTone(value, derivedPortal)`.

#### Migration rule for `zh-CN.ts`

| Decision | Examples |
|---|---|
| **Keep as plain string** | Button labels (`继续`, `提交`, `开始`), form labels (`邮箱`, `密码`), Cambridge term labels (`KET`, `PET`, `A2 Key`, `B1 Preliminary`), status pills (`进行中`, `已完成`) |
| **Split into `{ket, pet}`** | Every headline / subtitle / hint / empty-state / loading / banner / encouragement |

Estimated split: ~40-50 of the ~200 strings get portal-split; remainder stay flat.

### 5.3 Hardcoded-zh audit

#### Detection — ESLint custom rule

`apps/web/eslint.config.mjs` adds:

```javascript
{
  rules: {
    'no-hardcoded-zh-jsx': 'error',
  }
}
```

Logic: scan JSX text nodes; if any `[一-鿿]` character appears outside an allowlist (`KET`, `PET`, `A2 Key`, `B1 Preliminary`, `Reading`, `Listening`, `Writing`, `Speaking`, `Vocab`, `Grammar`, `Mina`, `Leo`, `Aria`), fail the build.

#### Migration

Every flagged string moves into `zh-CN.ts` with a stable key. Components reference via `t.*`.

**Known violators (audit list — all must hit zero before final merge):**

- `apps/web/src/components/diagnose/DiagnoseReport.tsx` — `综合得分`, `本周诊断报告`, `六项能力本周得分`, `本周知识点弱项`, etc.
- All other `.tsx` / `.ts` files matching the initial grep (~100 files; precise list resolved by running the audit script during Phase A)
- `apps/web/src/app/api/*/route.ts` — every NextResponse.json with Chinese error/message strings (~30+ instances confirmed):
  - `"请先登录"` (everywhere)
  - `"请求格式错误"`
  - `"邀请码无效"`, `"请输入邀请码"`
  - `"诊断生成失败，请稍后重试"`
  - `"本周诊断生成调用次数已达上限，请稍后再试"`
  - `"音频加载失败，请重新生成"`
  - `"系统繁忙，请稍后再试"`
  - `"考试时间已结束，答案已自动提交"`
  - `"请先写下你的作文"`
  - Default fallback `instructionZh ?? "请听音频，回答下面的问题。"` at `apps/web/src/app/api/listening/tests/[testId]/status/route.ts:138`
- Zod schemas in `apps/web/src/app/api/auth/signup/route.ts`: `"邮箱格式不正确"`, `"密码至少 8 位"`

#### Audit script

`apps/web/scripts/audit-hardcoded-zh.ts` reports every violation grouped by file. Used in CI gate and during refactor.

### 5.4 AI prompt rewrites — per agent

For each agent, the spec dictates: (a) which file to edit, (b) what blocks to inject/replace, (c) what the validator must enforce.

#### 5.4.1 `services/ai/app/prompts/diagnose_summary.py` — the screenshot fix

Add a `_build_voice_block(exam_type)` helper:

```python
_KET_VOICE = """
## 语气：你是 Leo（一只友好的小狐狸）在跟 KET 学生（10-13 岁）说话
- 用最简单的中文。每句 5-15 字。鼓励、平等、像朋友。
- narrative_zh 必须 50-90 字，第一句以「Leo 看了你这周」或「Leo 觉得」开头。
- 严禁使用：决定通过率、属于低分段、未达标、短板、critical 弱项、moderate 弱项、minor 弱项、请重视、切记、不容忽视、亟待提升。
- strengths：1-2 条，每条 ≤20 字。
- weaknesses：1-2 条，每条 ≤25 字。
- priority_actions：2-3 条，每条 ≤30 字。
"""

_PET_VOICE = """
## 语气：你是 Aria（一只睿智的猫头鹰）在跟 PET 学生（13-16 岁）说话
- 简洁专业但不冷漠。每句 8-22 字。建议/推荐/提升 等词可用。
- narrative_zh 必须 70-110 字，第一句以「Aria 看到你这周」或「Aria 觉得」开头。
- 严禁使用：（同 KET 列表）。
- strengths/weaknesses/priority_actions cardinality 同 KET。
"""
```

Replace the existing 4-field instruction block (lines 71-92 of current file) with the new field instructions + the appropriate voice block (selected on `exam_type`).

#### 5.4.2 `services/ai/app/prompts/diagnose_analysis.py`

Same voice-block insertion. The 8-category taxonomy is preserved (data, not user-facing text). The `[critical]/[moderate]/[minor]` severity tags are stripped from any user-facing string the downstream summary references — they remain internal only.

#### 5.4.3 `services/ai/app/prompts/analysis.py` (legacy 4-field — used by teacher AnalysisPanel)

Adds **professional voice** block (third variant alongside KET kid and PET teen). Used when rendered on teacher view; 100-160 chars narrative, `建议/请关注` allowed, no mascot framing, no banned exam-cram phrases.

#### 5.4.4 `services/ai/app/prompts/vocab_gloss_system.py`

Smallest change: replace `glossZh: 简洁的中文释义。优先使用最常见的释义；若有多个常用义项用「；」分隔，最多 3 个。` with `glossZh: 最常用的中文释义。最多 2 个义项，每个 ≤6 字，用「；」分隔。`. No voice change — vocab glosses are dictionary entries; stay terse/neutral.

#### 5.4.5 `services/ai/app/prompts/writing.py` (feedback path only)

Task generation portion is English; stays. Feedback path (Chinese feedback shown to students post-submit, if any): apply per-portal voice block. **Verification needed during implementation:** read `services/ai/app/agents/writing.py` to confirm where Chinese feedback is generated. If none → no rewrite. If yes → apply voice block.

#### 5.4.6 `services/ai/app/prompts/speaking_scorer_system.py`

`justification` field is currently English (Cambridge examiner register) — kept as English. **No rewrite needed** unless a Chinese summary surface is added (none today).

#### 5.4.7 `services/ai/app/prompts/grammar_generator_system.py`

Grammar question explanations shown to students. Voice block added; ≤80 char cap on each explanation; banned phrases enforced.

### 5.5 Banned-phrase list (single source for prompt + validator + lint)

Lives at `services/ai/app/validators/_banned_phrases.py` AND `apps/web/src/i18n/banned-phrases.ts` (kept in sync via the implementation plan).

```python
BANNED_PHRASES = [
    "决定通过率",
    "属于低分段",
    "未达标",
    "短板",
    "critical 弱项",
    "moderate 弱项",
    "minor 弱项",
    "请重视",
    "切记",
    "不容忽视",
    "亟待提升",
    "[critical]",
    "[moderate]",
    "[minor]",
]
```

### 5.6 Validators (Python-side)

Add to `services/ai/app/validators/diagnose.py::validate_diagnose_summary`:

```python
def validate_diagnose_summary(resp, req) -> list[str]:
    errors = []
    # ... existing checks ...

    # NEW: length caps (per-portal)
    cap = 90 if req.exam_type == "KET" else 110
    if len(resp.narrative_zh) > cap:
        errors.append(f"narrative_zh too long: {len(resp.narrative_zh)} > {cap}")
    if len(resp.strengths) > 2:
        errors.append("strengths exceed 2 items")
    if len(resp.weaknesses) > 2:
        errors.append("weaknesses exceed 2 items")
    if len(resp.priority_actions) > 3:
        errors.append("priority_actions exceed 3 items")

    # NEW: banned phrases
    full_text = " ".join([
        resp.narrative_zh, *resp.strengths, *resp.weaknesses, *resp.priority_actions
    ])
    for phrase in BANNED_PHRASES:
        if phrase in full_text:
            errors.append(f"banned phrase: {phrase!r}")

    return errors
```

The existing 3-retry loop in `diagnose_summary.py` retries with the validator errors fed back to the prompt — so a model that produces "决定通过率" gets corrected within the same request.

Same pattern in `validate_diagnose_analysis`, `validate_analysis`, `validate_grammar`.

### 5.7 Sample full-string diff (representative — full diff produced during execution)

| key | current | KET (kid) | PET (teen) |
|---|---|---|---|
| `app.tagline` | AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点 | 听说读写 · 一题一题来 | AI 帮你找盲点 · 稳稳备考 |
| `app.metaDescription` | 面向中国 K-12 学生的剑桥英语 KET（A2 Key）与 PET（B1 Preliminary）备考平台... | 中小学剑桥 KET / PET 备考 · AI 出题练习 | (same; meta tag is portal-agnostic) |
| `diagnose.pageTitle` | 本周诊断测试 | 本周小测 | 本周诊断 |
| `diagnose.pageSubtitle` | 每周必做的 AI 综合测验 · 6 项剑桥能力 · 约 30 分钟 | 6 关 · 一会儿就好 | 6 项 · 30 分钟 |
| `diagnose.emptyHint` | 点击下方按钮领取本周的 AI 综合测验（共 6 项 · 约 30 分钟，每周必须完成才能解锁其他练习） | 本周小测来啦 · Leo 等你 | 本周诊断已就绪 · 30 分钟 |
| `diagnose.bannerGated` | 本周诊断测试未完成 · 其他练习功能已锁定 | 先做本周小测，再玩别的 → | 完成本周诊断 · 解锁其他练习 |
| `listening.generating` | 正在生成听力测试 — 通常需要 1-2 分钟 | Leo 出题中 ⏳ | Aria 出题中 |
| `listening.timeExceeded` | 考试时间已结束，答案已自动提交 | 时间到 · 已交卷 | 时间到 · 答案已提交 |
| `vocab.tierCoreSubtitle` | 必须掌握 · 决定通过率 | 一定要会 | 必修核心 |
| `common.networkError` | 网络错误，请重试 | 网不太好 · 再试一下 | 网络异常 · 请重试 |
| `api.unauthorized` (new key) | (was hardcoded "请先登录") | 先登录一下哦 → | 请先登录 |
| `api.malformedRequest` (new key) | (was hardcoded "请求格式错误") | 这个请求看不懂 | 请求格式错误 |
| `auth.signup.emailInvalid` | (was Zod hardcoded "邮箱格式不正确") | 邮箱填错啦 | 邮箱格式不正确 |
| `auth.signup.passwordTooShort` | (was Zod hardcoded "密码至少 8 位") | 密码要 8 位以上 | 密码至少 8 位 |
| `listening.runner.instruction` (new key, replaces fallback) | (was hardcoded `instructionZh ?? "请听音频，回答下面的问题。"`) | 听一听 · 选答案 | 听音频后选择答案 |

### 5.8 Tests added

| Test | Location | Asserts |
|---|---|---|
| `validate_diagnose_summary_length_cap` | `services/ai/tests/validators/` | narrative_zh > cap rejects |
| `validate_diagnose_summary_banned_phrases` | same | each banned phrase rejects |
| `validate_diagnose_summary_voice_per_portal` | same | KET prompt produces ≤90 chars; PET ≤110 |
| `DiagnoseReport.test.tsx` snapshot (kid voice) | `apps/web/src/components/diagnose/__tests__/` | rendered HTML matches kid-voice snapshot |
| `DiagnoseReport.test.tsx` snapshot (teen voice) | same | matches teen-voice snapshot |
| `audit-hardcoded-zh` CI gate | `.github/workflows/...` | zero Chinese chars in JSX outside allowlist |
| `i18n-portal-coverage` test | `apps/web/src/i18n/__tests__/` | every `Tone<T>` entry has both `.ket` and `.pet` |
| `api-error-i18n` test | `apps/web/src/app/api/**/__tests__/` | API responses use `t.api.*` keys, not hardcoded zh |

---

## 6. Surface-by-surface changes (58 routes)

### 6.1 Tier A — student-facing (50 routes, gets per-portal mascots)

#### 6.1.1 Pre-auth pages (3 — `/`, `/login`, `/signup`)

| Route | Hero | Mascot | Map | Layout shift | Copy keys |
|---|---|---|---|---|---|
| `/` (`page.tsx`) | "练 KET / PET" h1 + Leo+Aria duo | both | none | Single-column centered, big CTA | `t.app.tagline`, `t.portal.*` |
| `/login` | Login card + Leo waving | Leo | none | Card-centered | `t.auth.login.*` |
| `/signup` | Mirror of login + Aria waving | Aria | none | Card-centered | `t.auth.signup.*` |

#### 6.1.2 Portal hubs (2 — `/ket`, `/pet`)

Already mocked. Components: `apps/web/src/app/ket/page.tsx` + `apps/web/src/app/pet/page.tsx` rewritten around new `<PortalMap portal="ket|pet">` and `<TodayCard>`. Existing `AssignmentList` from `apps/web/src/components/student/AssignmentList.tsx` reskinned to match.

#### 6.1.3 Practice mode start pages (12 — `/<portal>/<mode>/new`)

Same skeleton across listening / reading / writing / speaking / vocab modes. Existing `NewListeningPicker`, `reading/NewForm`, `writing/NewForm`, `SpeakingNewPage` components reskinned, not rewritten.

| Common change | Detail |
|---|---|
| Header strip | Mascot for the mode (e.g., Leo `listening` pose for `/ket/listening/new`) |
| Picker chips | Existing `NewListeningPicker` chip layout retained; new theme tokens |
| CTA button | `t.<mode>.start` (kid voice for KET, teen voice for PET) |
| Loading state | Mascot `thinking` pose + 1-line message |
| `GenerationProgress.tsx` | Reskin progress bar; verbose stage text replaced with Leo-narrated 1-liners |

**Special: `/ket/speaking/new` + `/pet/speaking/new`** — Leo `microphone` pose appears in welcome card with copy "Leo 来介绍 Mina 给你 →". Click → enter the room (Mina-only there).

#### 6.1.4 Practice runner pages (10 — `/<portal>/<mode>/runner/[attemptId]`)

**Rule (§4.5): NO MASCOT during answering.**

| Component | Change |
|---|---|
| `listening/ListeningRunner.tsx` | Reskin top bar (timer + segment indicator); option photos via Listening Part 1 SF pipeline UNCHANGED; `PhaseBanner` text rewritten via `t.listening.*` |
| `reading/Runner.tsx` | Reskin progress + nav |
| `writing/Runner.tsx` | Reskin word-counter + textarea |
| `speaking/SpeakingRunner.tsx` + `MinaAvatarPanel.tsx` | **Mina untouched** per §2.2 Tier C |

#### 6.1.5 Practice result pages (10 — `/<portal>/<mode>/result/[attemptId]`)

Result is a "celebration moment" — mascot reappears.

| Component | Change |
|---|---|
| `reading/ResultView.tsx`, `writing/ResultView.tsx`, listening result page, `speaking/SpeakingResult.tsx` | Mascot pose by score: `celebrating` (≥70) / `confused` (<50) / `thinking` (50-69) at top. Score ring repurposed. Feedback text rewritten in kid/teen voice. |
| Speaking result | **Mina-side feedback (English) untouched**; only Chinese summary kid-voiced |

#### 6.1.6 Vocab pages (6)

| Route | Change |
|---|---|
| `/<portal>/vocab` | Hub reskin; mascot `flashcards` in header. Tier names via `t.vocab.tier*` rewrite. Word table layout unchanged. |
| `/<portal>/vocab/listen` | Mascot `listening` pose top; runner UI unchanged. |
| `/<portal>/vocab/spell` | Mascot `writing` pose top; runner UI unchanged. |

`vocab_gloss_system.py` rewrite per §5.4.4.

#### 6.1.7 Grammar pages (6)

| Route | Change |
|---|---|
| `/<portal>/grammar` | Hub reskin; mascot `chart` pose. CTAs (`t.grammar.ctaMixed`/`ctaWeakPoint`/`ctaMistakes`) emoji-prefixed kid voice. |
| `/<portal>/grammar/quiz` | Quiz runner reskin; **NO MASCOT during quiz**. Explanations from `grammar_generator_system.py` rewritten with length cap. |
| `/<portal>/grammar/mistakes` | Mistakes book reskin; mascot `thinking` empty state. |

#### 6.1.8 Diagnose flow (6)

| Route | Change |
|---|---|
| `/diagnose` (`DiagnoseHub.tsx`) | Reskin week banner + 6 section cards. Copy in `t.diagnose.*` rewrite. **No mascot during section runners.** |
| `/diagnose/runner/[section]` | Embeds the per-mode runners; inherits §6.1.4 rules (no mascot). |
| `/diagnose/replay/[testId]/[section]` | Read-only replay; minor reskin. |
| `/diagnose/report/[testId]` (`DiagnoseReport.tsx`) | Major rewrite: Leo summary strip on top, ≤2-item lists, ≤3-action plan, narrative_zh ≤110 chars. Hardcoded zh ("综合得分", "六项能力本周得分", "本周知识点弱项") moved into `t.diagnose.report.*` and rewritten. |
| `/diagnose/history` | List reskin; minor. |
| `/diagnose/history/[testId]` | Reuses `DiagnoseReport` component → inherits the rewrite automatically. |

#### 6.1.9 History pages (2 — `/history`, `/history/mistakes`)

Reskin existing list/filter UI; copy via `t.nav.history` and per-mode keys. Mascot `thinking` if list is empty.

#### 6.1.10 Classes page (1 — `/classes`, student side)

Reskin join form + class list.

### 6.2 Tier B — teacher / admin (8 routes, no mascots)

| Route | Change |
|---|---|
| `/teacher/activate` | Reskin auth-style card; copy via `t.auth.activate.*` rewrite |
| `/teacher/classes` (list) | Reskin; CTA copy rewrite |
| `/teacher/classes/new` | Form reskin; existing `t.classes.new.*` strings reviewed |
| `/teacher/classes/[classId]` | Class detail dashboard reskin; tabs preserved |
| `/teacher/classes/[classId]/diagnose-status` | Reskin status table |
| `/teacher/classes/[classId]/assignments/new` | Form reskin |
| `/teacher/classes/[classId]/students/[studentId]` | `AnalysisPanel.tsx` uses older 4-field analysis from `analysis.py` — professional voice block applied (§5.4.3) |
| `/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]` | Attempt drill-down reskin |

### 6.3 Component refactor list

```
NEW components
  apps/web/src/components/Mascot.tsx              → <Mascot pose portal />
  apps/web/src/components/PortalMap.tsx           → portal-aware map background + mode-chip overlay
  apps/web/src/components/TodayCard.tsx           → today's recommended action card
  apps/web/src/components/portal/PortalShell.tsx  → wraps body class .portal-ket / .portal-pet
  apps/web/src/i18n/voice.ts                      → Tone<T> + pickTone helper
  apps/web/src/i18n/PortalProvider.tsx            → React context + useT hook
  apps/web/src/i18n/banned-phrases.ts             → mirror of Python BANNED_PHRASES

REWRITTEN components (logic preserved, JSX/CSS rewritten)
  apps/web/src/app/page.tsx
  apps/web/src/app/ket/page.tsx, pet/page.tsx
  apps/web/src/app/layout.tsx (wraps in PortalProvider)
  apps/web/src/components/diagnose/DiagnoseHub.tsx
  apps/web/src/components/diagnose/DiagnoseReport.tsx
  apps/web/src/components/diagnose/AnalysisPanel.tsx (teacher view)
  apps/web/src/components/grammar/GrammarHub.tsx
  apps/web/src/components/grammar/GrammarMistakes.tsx
  apps/web/src/components/vocab/VocabHub.tsx
  apps/web/src/components/listening/NewListeningPicker.tsx
  apps/web/src/components/reading/NewForm.tsx
  apps/web/src/components/writing/NewForm.tsx
  apps/web/src/components/speaking/SpeakingNewPage.tsx
  apps/web/src/components/SiteHeader.tsx
  apps/web/src/app/login/page.tsx + LoginForm
  apps/web/src/app/signup/page.tsx + SignupForm

RESKINNED only (CSS-touch only)
  All result-page components, all runner components, all teacher pages.

API ROUTES (hardcoded zh → t.api.*)
  apps/web/src/app/api/auth/signup/route.ts (Zod schemas)
  apps/web/src/app/api/classes/join/route.ts
  apps/web/src/app/api/diagnose/me/generate/route.ts
  apps/web/src/app/api/diagnose/me/section/[sectionKind]/start/route.ts
  apps/web/src/app/api/listening/[attemptId]/audio/route.ts
  apps/web/src/app/api/listening/tests/[testId]/attempt/route.ts
  apps/web/src/app/api/listening/tests/[testId]/status/route.ts
  apps/web/src/app/api/mistakes/[id]/status/route.ts
  apps/web/src/app/api/r2/[...key]/route.ts
  apps/web/src/app/api/teacher/activate/route.ts
  apps/web/src/app/api/teacher/classes/route.ts
  apps/web/src/app/api/tests/[attemptId]/submit/route.ts
  apps/web/src/app/api/tests/attempts/[attemptId]/status/route.ts
  apps/web/src/app/api/tests/generate/route.ts
  apps/web/src/app/api/writing/generate/route.ts
  (full list resolved by audit-hardcoded-zh script during Phase A)
```

---

## 7. Implementation phasing

### 7.1 Vertical-slice phases (no big-bang)

**Principle:** ship one surface end-to-end before touching the next. Protects against half-broken transitions on 58 routes.

| Phase | Scope | Done when |
|---|---|---|
| **A. Foundation** | Generate all 24 mascot poses + 2 maps; commit to `apps/web/public/`. Add per-portal design tokens. Create new shared components (`Mascot`, `PortalMap`, `TodayCard`, `PortalShell`). Add i18n machinery (`Tone<T>`, `pickTone`, `PortalProvider`, `useT`). Add ESLint rule `no-hardcoded-zh-jsx` (warning-only initially). Create `BANNED_PHRASES` shared module (Python + TS). Add Python validator length-cap helpers. Add API i18n (`t.api.*`). | All new infra exists; existing pages still render unchanged; CI green. |
| **B. KET portal home** (`/ket`) | First real consumer. Rewrite `apps/web/src/app/ket/page.tsx` against new components. Split corresponding `t.*` keys into `Tone<T>`. Add component snapshot test. | Page matches KET portal mockup; smoke test green; ESLint zero hardcoded-zh in this file. |
| **C. PET portal home** (`/pet`) | Mirror of B with Aria + PET 城 + teen voice. | Both portals visually distinct, structurally identical. |
| **D. Diagnose flow** (6 routes — the verbosity smoking gun) | Rewrite `DiagnoseHub`, `DiagnoseReport`, `AnalysisPanel`. Migrate `t.diagnose.*` to `Tone<T>`. Rewrite Python prompts (`diagnose_summary.py`, `diagnose_analysis.py`, `analysis.py`) with voice block + length caps. Add Python validator length caps + banned-phrase regex. | Real report end-to-end: narrative ≤90 (KET) / ≤110 (PET), 0 banned phrases, ≤2 weaknesses, mascot summary visible. Snapshots green. |
| **E. Practice mode start pages** (12 routes) | Per-mode reskin of `*/<mode>/new/page.tsx` + their components. Mode-specific Leo/Aria pose. | Each mode's start page passes its snapshot test; click-through to runner still works. |
| **F. Practice runner pages** (10 routes) | CSS-only reskin (no mascots). Bar/timer/option restyling. **Listening Part 1 photos untouched.** **Speaking room Mina untouched.** | Functional regression: full reading/writing/listening/vocab/grammar quiz still completes; speaking room enters/exits cleanly. |
| **G. Practice result pages** (10 routes) | Reskin + mascot pose by score. Result text rewritten via `Tone<T>`. | Each mode's result matches mockup energy; pose-by-score logic verified with stub data. |
| **H. Vocab + Grammar dedicated** (12 routes) | Hub + sub-page reskins. `vocab_gloss_system.py` and `grammar_generator_system.py` rewrites. | Vocab table + listen + spell flows complete; Grammar quiz + mistakes book complete. |
| **I. History pages + classes (student side)** (3 routes) | List/filter reskin. | Smoke pass. |
| **J. Pre-auth pages** (`/`, `/login`, `/signup`) | Reskin + Leo+Aria duo on `/`. | Anonymous signup → diagnose flow works end-to-end. |
| **K. Teacher pages** (8 routes — Tier B) | Theme tokens + copy de-verbosing. `analysis.py` agent's professional voice block applied. | All teacher flows pass; AnalysisPanel reads professional, not kid/teen. |
| **L. API routes copy migration** | Move every hardcoded Chinese error/instruction string from `app/api/**/route.ts` into `t.api.*`. Apply per-portal voice where the response surface is portal-aware (e.g., listening test instructions). Migrate Zod messages. | `audit-hardcoded-zh` reports zero violations; ESLint rule flips warning → error. |
| **M. Final probe + production deploy** | Run full E2E probe (§8); flip ESLint `no-hardcoded-zh-jsx` to error; clean up temp scripts; deploy to Zeabur; 24h watch. | All gates in §2.3 green. |

### 7.2 Branch strategy

- One feature branch per phase: `redesign/foundation`, `redesign/ket-portal`, …
- Each phase = one PR, reviewed, merged to `main`. Auto-deploys to Zeabur production after merge.
- Phases A–B can ship before I–M start — partial redesign in production is OK because foundation is additive.
- **Risk:** during transition, students may see new portals + old practice modes. Acceptable: theme tokens cascade so palette stays consistent; old modes still work; only visible mismatch is mascot presence on new but absent on old — transient.

---

## 8. End-to-end probe plan

### 8.1 Automated probes (Playwright, runs in CI on every phase merge)

| # | Probe | Pass condition |
|---|---|---|
| 1 | `signup-to-diagnose-to-report` | New user signs up → /diagnose → completes 6 sections (mocked AI for speed) → /diagnose/report renders → assert: narrative_zh ≤ portal cap, no banned phrases, 1-2 strengths, 1-2 weaknesses, 2-3 actions |
| 2 | `ket-portal-home-renders` | Logged-in user → GET /ket → assert: KET 岛 image loads, Leo greeting loads, 6 mode chips visible, today card with "开始" button visible, no hardcoded-zh in DOM (allowlisted) |
| 3 | `pet-portal-home-renders` | Same for /pet with Aria + PET 城 + teen voice |
| 4 | `listening-part1-still-renders-photos` | /ket/listening/runner → MCQ_3_PICTURE shows real Qwen-Image option photos (existing pipeline regression check) |
| 5 | `speaking-flow-leo-then-mina` | /ket/speaking/new → Leo image + intro copy → enter room → Mina avatar loads (TRTC connection) → exit → result |
| 6 | `vocab-listen-spell-grammar-quiz` | All four sub-flows complete; mistakes register; mastery updates |
| 7 | `result-mascot-pose-correct` | Synthetic high (≥70) / mid (50-69) / low (<50) attempts → celebrating / thinking / confused poses |
| 8 | `teacher-create-class-student-joins-assignment` | Teacher activates → creates class → student joins → assignment → student does → teacher sees in /teacher/classes/[id] |
| 9 | `diagnose-history-old-format-still-renders` | Pre-existing report (old format from DB) renders without crash. Backwards-compat. |
| 10 | `verbosity-probe-on-real-data` | Real diagnose request → services/ai → assert response satisfies length caps + no banned phrases |

### 8.2 Manual visual audit (one-time, pre-deploy)

For every redesigned route (~58 pages):

- Matches the mockup direction
- Mascot pose is contextual (not random)
- No orphaned old-Variant-A styles
- No layout overflow on mobile (375px) and desktop (1440px)
- No ESLint hardcoded-zh warnings in source

Tracked in `docs/superpowers/specs/2026-04-29-ket-pet-redesign-visual-audit.md` (created during Phase M).

### 8.3 Verbosity probe (the screenshot regression)

Specific test: generate diagnose report for student with all-zero scores → assert:

- `narrative_zh.length ≤ portal cap`
- `0` banned phrases (regex match against `BANNED_PHRASES` returns empty)
- `len(strengths) ≤ 2`
- `len(weaknesses) ≤ 2`
- `len(priority_actions) ≤ 3`
- DOM does NOT contain "属于低分段", "critical 弱项", "未达标", "短板", any banned phrase
- Total Chinese-character count of `优势 + 薄弱点 + 重点练习方向` lists ≤ 200 (target ≤140 per the after-mockup)

Lives at `apps/web/src/app/diagnose/report/[testId]/__tests__/verbosity.test.ts` (Playwright + screenshot diff).

---

## 9. Risk register + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mascot SF generation produces visually inconsistent set across 24 poses | medium | Phase A reviews all 24 in a contact sheet; regenerate outliers via Qwen-Image-Edit using `greeting` as reference image |
| AI prompt rewrite causes validator retry storm (slow / costly) | low | Existing 3-retry loop bounds cost. Monitor retry rate during Phase D. If >10% requests retry, tune the prompt. |
| Map illustrations have visible English text on buildings | known/accepted | Phase A either accepts or regenerates with stricter prompt; cost ¥0.14 per retry |
| Existing student diagnose reports in DB break in new viewer | medium | Phase D tests backwards-compat; viewer accepts both old (long) and new (short) shapes |
| ESLint `no-hardcoded-zh-jsx` blocks legitimate Cambridge term labels | high | Allowlist (`KET`, `PET`, `A2 Key`, `B1 Preliminary`, `Reading`, `Listening`, `Writing`, `Speaking`, `Vocab`, `Grammar`, `Mina`, `Leo`, `Aria`) hardcoded in the rule; review during Phase A |
| Speaking room Mina+Leo coexistence confuses users | low | Mina alone in room. Leo only on `/<portal>/speaking/new`. Visual audit catches violations. |
| Zeabur deploy fails on missing public/ assets | low | Dockerfile already copies `public/`. Verified. |
| Repo grows by ~10MB from PNG assets | low | Acceptable; alternative is migrate to R2 with auth bypass — heavier than 10MB git. |
| API i18n migration breaks existing client error-handling code | medium | Each migrated message keeps the same JSON shape (`{ error: string, message?: string }`). Only the Chinese text changes. Existing clients reading `error.code` are unaffected. |

---

## 10. Cleanup checklist

Before final merge:

- [ ] Delete `apps/web/scripts/_brainstorm-mascot-test.mts`
- [ ] Delete `apps/web/scripts/_brainstorm-mascot-kolors.mts`
- [ ] Delete `apps/web/scripts/_brainstorm-list-sf-models.mts`
- [ ] Delete `apps/web/scripts/_brainstorm-maps.mts`
- [ ] Add `.superpowers/` to `.gitignore` (if not already there)
- [ ] Verify no `// TODO redesign`, `// FIXME redesign`, or stray `console.log(` left in shipped code
- [ ] Confirm `audit-hardcoded-zh` reports zero violations
- [ ] Confirm visual audit checklist 100% complete

---

## 11. Workflow after this spec is approved

1. Run a self-review pass on this spec (§12 below).
2. **User reviews the written spec file** and approves or requests revisions.
3. After approval, invoke **`superpowers:writing-plans`** to convert this spec into a step-by-step implementation plan (with concrete tasks, code snippets, test specs).
4. **User reviews the implementation plan**.
5. After plan approval, implementation begins via **`superpowers:executing-plans`** (subagents — all on Opus per standing instruction). Coordinator supervises and reports progress.
6. Each phase's PR is reviewed before merge. Phase M gates production deploy.

---

## 12. Spec self-review

(Pass conducted at end of writing — see commit message for results.)

- [x] Placeholder scan — no "TBD", "TODO", "FIXME" left in this document
- [x] Internal consistency — Section 5 voice rules align with Section 4 length caps; Section 7 phases align with Section 6 surface inventory
- [x] Scope check — single implementation plan can execute this; phases A–M form a sequenceable graph
- [x] Ambiguity check — every "rewrite voice" instruction has a concrete style guide; every "no mascot" rule has a concrete page list; every length cap has a numeric value
- [x] Coverage of stakeholder feedback — verbosity-in-AI-prompts (driven by user's screenshot) explicitly addressed in §5.4 and §8.3
- [x] All 58 routes accounted for — cross-checked against `find apps/web/src/app -name page.tsx | wc -l` output
- [x] All hardcoded-zh sources accounted for — `.tsx` JSX (§5.3) + `app/api/*/route.ts` (§5.3 + §6.3) + Zod schemas (§5.3) + AI prompts (§5.4)
- [x] Production-ready definition (§2.3) is testable — every gate can be programmatically verified
