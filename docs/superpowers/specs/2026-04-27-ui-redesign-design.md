# UI Redesign — Variant A Pastel/Highlighter Design Language

> **Project**: cambridge-ket-pet
> **Status**: APPROVED. Ready for implementation planning.
> **Scope rule**: visual restyle only — **no layout changes** to any existing route.
> **Reference mockups**: `design-preview/preview.html` (single self-contained HTML, 41 page sections, 320 KB).

---

## 1. Context

The shipped UI uses Tailwind starter aesthetics (white background, neutral grays, plain bordered cards, Arial). Functional but personality-free — the user described it as "way too ugly". A redesign is needed that:

1. Adds visible personality (warmth, energy) without sacrificing accessibility for the KET/PET age band (typically 9–15).
2. Keeps fonts large enough that students, parents, and older users can all read comfortably.
3. **Does not change layouts** — pages stay structurally identical, only visual styling changes. This keeps the migration scope tight.
4. Stays light-theme by default (per saved memory).

The user picked the visual reference shown in `design-preview/reference-kid-app-screenshot.png` (a pastel-and-yellow-highlighter children's learning app), with one calibration: the cartoon-character illustrations don't scale to teen learners, so we replace them with abstract paper-craft / iconographic illustrations that work equally well at age 9 and age 15.

---

## 2. Decision summary

- **Single design variant**: "Variant A — Playful Pastel" (the user explicitly chose 1 variant per page, more polish, over comparing 2 variants).
- **Build cadence**: 4 preview pages first → user confirms direction → extrapolate to all 41 page templates → spec → implementation.
- **Tech direction**: Tailwind v4 (matches current `apps/web` stack). Custom CSS classes declared once in `globals.css` (or a new `app.css`), then used as Tailwind utilities throughout. Fonts via Google Fonts CDN (Manrope, weights 500/600/700/800). No new design library, no Headless UI, no daisyUI — keep dependencies tight.
- **Implementation strategy**: port the visual system route-by-route. **No route file is allowed to change its component tree** — only `className` strings, color tokens, typography, and the addition of small decorative elements (yellow marker spans, star-stickers, abstract paper-craft illustrations).

---

## 3. Design tokens

### 3.1 Color palette

```ts
// tailwind.config (or @theme inline in globals.css)
colors: {
  ink:      '#0F172A',  // primary text + bold buttons + active state borders
  mist:     '#F4ECFF',  // backgrounds (lavender-tinted very-light)
  skywash:  '#EEF2FF',  // page background gradient stop
  lavender: { DEFAULT: '#A78BFA', soft: '#C7B8FF', tint: '#EDE7FF' },
  sky:      { DEFAULT: '#7DB8FF', soft: '#BCD8FF', tint: '#E4EFFF' },
  butter:   { DEFAULT: '#FFD96B', soft: '#FFE38A', tint: '#FFF6D6' },
  peach:    { DEFAULT: '#FFC4D1', soft: '#FFD4DD', tint: '#FFEBF0' },
  mint:     { DEFAULT: '#A8E6CF', soft: '#C6F0DC', tint: '#E6F8EE' },
  // butter-yellow #FFE066 reserved exclusively for the highlighter marker
}
```

Page background uses `linear-gradient(180deg, #eef2ff 0%, #f4ecff 100%)` on `<body>`.

### 3.2 Typography

- **Family**: Manrope (Google Fonts, weights 500/600/700/800). Falls back to system-ui.
- **Base size**: `17px` declared on `:root` for slightly-bigger-than-default density that still keeps dashboards in one viewport. Body text is `text-base` (17px) or `text-lg` (~19px) when used for content emphasis. **Headings stay BIG** — `text-3xl/4xl/5xl/6xl` font-extrabold uppercase Chinese, with the punchline phrase wrapped in `<span class="marker-yellow-thick">` (yellow `#FFE066` highlighter painted underneath the text via CSS gradient).

```css
.marker-yellow {
  background: linear-gradient(transparent 55%, #ffe066 55% 92%, transparent 92%);
  padding: 0 0.25em;
  font-weight: 800;
}
.marker-yellow-thick {
  background: linear-gradient(transparent 35%, #ffe066 35% 95%, transparent 95%);
  padding: 0 0.3em;
  font-weight: 800;
}
```

### 3.3 Components (CSS classes — all defined once, used everywhere)

| Class | Purpose |
|---|---|
| `.site-header` | Top nav bar: white card, rounded-2xl, contains logo + nav links |
| `.pill-tag` | Small rounded chip (categories, status, tags) |
| `.skill-tile` | Colored card (`min-h-11rem`, hover lifts 2px + black border) — used on hubs |
| `.arrow-chip` | Small black circle with → that translates on hover |
| `.stat-card` | Compact stat box (number + caption) |
| `.stitched-card` | Soft drop-shadow for floating cards |
| `.star-sticker` | Small yellow rotated chip ("✦ 真题"), positioned absolutely on cards |
| `.marker-yellow` / `.marker-yellow-thick` | Yellow highlighter under headline text |
| `.tile-{lavender,sky,butter,peach,mint,cream}` | Pastel gradient fills for cards/tiles |
| `.page-section` | Page wrapper (light theme, body distributes vertically) |
| `.page-section.locked-height` | Runner-style fixed-viewport-height variant — prevents page-level scroll, internal columns scroll instead |
| `.grow-fill` | `flex: 1; min-height: 0` — content area that fills remaining viewport height |

### 3.4 Skill ↔ color mapping (consistent across all pages)

| Skill | Tile color |
|---|---|
| 阅读 Reading | `tile-lavender` |
| 听力 Listening | `tile-sky` |
| 写作 Writing | `tile-butter` |
| 口语 Speaking | `tile-peach` |
| 词汇 Vocab | `tile-mint` |
| 语法 Grammar | `tile-cream` |

Status pills consistent across the app:

| Status | Pill style |
|---|---|
| 已评分 / 已完成 / SCORED / GRADED | `bg-mint-soft border-2 border-ink/15` |
| 已提交 / SUBMITTED | `bg-butter-soft border-2 border-ink/15` |
| 进行中 / IN_PROGRESS | `bg-sky-soft border-2 border-ink/15` |
| 未开始 / NOT_STARTED / FAILED | `bg-peach-soft border-2 border-ink/15` |

---

## 4. Layout rules

### 4.1 Universal rules (apply to every page)

- **Light theme only**. The dark-theme `prefers-color-scheme` block in current `globals.css` is dropped (per saved memory: app is light-theme by default).
- Page background is the lavender-to-mist gradient.
- Site header card is the FIRST visible element on every authenticated page.
- Headlines use the yellow-highlighter pattern on the punchline phrase. The headline stays `text-3xl/4xl/5xl` extrabold.
- Buttons: primary = full-pill solid ink (`rounded-full bg-ink text-white font-extrabold`); secondary = ghost-pill (`rounded-full border-2 border-ink/15`); active state = chunky 2px black border (`border-ink` or `outline outline-3 outline-ink`).
- Min hit-target: 44×44px (Cambridge KET kids click on tablets too).
- Equal-weight responsive: every page must work at 1280×800 desktop AND 390×844 mobile. Tile grids collapse from 3-col → 2-col → 1-col across breakpoints.

### 4.2 Two page archetypes by scroll behavior

**Hub-style pages** (`page-section`, default):
- Use `min-height: calc(100vh - 2rem)` so content fills at least the viewport.
- Content distributes vertically with `flex flex-col gap-N`.
- Pages whose content exceeds viewport scroll the WHOLE page (the `main.main-pane` scroller).
- Bottom-content distribution uses natural margins, not `mt-auto` push (mt-auto creates awkward gaps).

**Runner-style pages** (`page-section locked-height`):
- Use **fixed** `height: calc(100vh - 2rem)` + `max-height` cap.
- Page-level scroll is disabled.
- Internal columns scroll independently. Required CSS:
  - On the runner's grid: `grid-template-rows: minmax(0, 1fr)` + `min-h-0` on the grid wrapper.
  - On scrollable inner containers: `overflow-y-auto` + `min-h-0` + `flex: 1`.
  - On flex column containers wrapping scrollers: `overflow: hidden`.

This second archetype is critical: in the listening / reading / grammar / writing runners the user must scroll questions while the passage / audio / instructions stay pinned in view.

### 4.3 Density calibration

- Sidebar in preview is 240px wide. In the actual app there is no sidebar — that's a preview-only navigator.
- Default outer page padding: `px-4 py-4 sm:px-6 sm:py-5`.
- Card padding: `p-4` to `p-6` depending on importance.
- Gap between major content blocks: `gap-3` to `gap-4`.

---

## 5. Page archetypes covered (41 templates total)

The preview enumerates 41 page templates. Every route in `apps/web/src/app/**/page.tsx` maps to one of these.

| Group | Pages |
|---|---|
| **Entry** (3) | login, signup, teacher-activate |
| **Home** (2) | home-out (logged-out marketing), home-in (logged-in portal) |
| **Hubs** (2) | kethub, pethub |
| **Reading** (3) | reading-new (picker), reader (runner), reading-result |
| **Listening** (3) | listening-new, listening-runner (sticky audio + scroll MCQ), listening-result |
| **Writing** (3) | writing-new, writing-runner (textarea + word count), writing-result (4-criteria rubric) |
| **Speaking** (3) | speaking-new, speaking-runner (Akool video + chat transcript), speaking-result |
| **Vocab** (3) | vocab-overview, vocab-spell, vocab-listen |
| **Grammar** (3) | grammar-overview, grammar-quiz, grammar-mistakes |
| **Diagnose** (6) | diaghub, diag-section-runner, diag-report (heavy 8-category cluster page), diag-history, diag-history-detail, diag-replay |
| **Library** (3) | history, history-mistakes, classes |
| **Teacher** (8) | teacher-classes, teacher-class-new, teacher-class-detail, teacher-assignment-new, teacher-student-detail, teacher-attempt-detail, teacher-diagnose-status, classes (overlap) |

Each page template was approved by the user during the page-by-page review. The mockups in `design-preview/preview.html` are the canonical source.

---

## 6. Implementation approach (high-level — detailed plan in writing-plans)

The actual port to the codebase happens in the next phase. High-level approach:

1. **New worktree + branch** (`design/ui-redesign-pastel`) off `main`, NOT off `feat/diagnose-weekly`. The redesign affects the entire app, not just diagnose.
2. **One foundation PR**: add the design tokens + custom classes to `globals.css`, swap `body` font to Manrope, keep all existing route files untouched. Verify nothing visually breaks (it won't — no class changes yet).
3. **Per-page port PRs** (or one big PR if QA is bundled): replace `className` strings on each route file. No JSX structural changes. Order of port:
   - Site header + nav (one component, applies everywhere)
   - High-traffic pages first: home-in, kethub, pethub, diaghub
   - Runners (locked-height) — risky because the scroll fix must port too
   - Result pages
   - Long-tail (teacher pages, history)
4. **Manual QA** on the 4 preview pages plus 2-3 runners (hardest to get right). Confirm light-theme only, fonts load, marker highlights render, runners don't scroll the page.

---

## 7. Out of scope

- Component-tree refactors (e.g. extracting a `<Hero>` component). Class changes only.
- Adding new pages or features.
- Re-skinning emails / PDFs / R2-hosted assets.
- Dark theme. Explicitly dropped per memory.
- Mobile-only optimizations beyond the responsive defaults.
- Animations/transitions beyond the 150ms hover state already in the preview.
- Changing the existing fade-in `keyframes` animation in `globals.css` (kept as-is).

---

## 8. Risks & tradeoffs

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Tailwind v4 `@theme inline` doesn't accept the custom color names | Low | Verify in `tailwind.config.ts` shape, fall back to inline CSS variables |
| 2 | Manrope CDN blocked in mainland China | Medium | Self-host Manrope via `next/font/google` (cached at build time, served from origin) — this is a memory-flagged concern (China access matters). Recommend self-host from day one. |
| 3 | Locked-height runners break on mobile because the page-section + viewport calc differs by browser chrome | Medium | Use `100dvh` instead of `100vh` where supported; degrade gracefully on mobile-Safari. Test on iOS Safari + Chrome Android during QA. |
| 4 | Yellow highlighter doesn't render correctly when text wraps mid-phrase | Low | The `box-decoration-break: clone` CSS already handles this in the preview; carry forward. |
| 5 | Skill-ID color mapping conflicts with existing per-skill component colors (e.g., `bg-rose-500` for the diagnose red-dot) | Low | Documented mapping in §3.4 is authoritative. Ad-hoc accent colors stay (red-dot, error states). |
| 6 | Implementation creates layout drift because devs naturally fix things while restyling | High | PR rule: **diff must show only `className` changes + new SVG illustrations, no structural JSX changes**. Code review enforces this. |

---

## 9. Acceptance criteria

The redesign is considered done when:

1. Every route in `apps/web/src/app/**/page.tsx` matches its corresponding mockup in `preview.html` to within reasonable visual tolerance.
2. Manual QA on 6 anchor pages (home-in, kethub, diaghub, reader, writing-runner, diag-report) passes: fonts load, marker renders, runners don't page-scroll, hit-targets ≥44px.
3. Light theme is the only theme. No dark-theme regressions.
4. Tailwind type-check + ESLint + Vitest still pass.
5. Manrope is self-hosted via `next/font/google`, no external CDN dependency.
6. No JSX structural changes vs `main` (verified by `git diff --stat` showing zero JSX edits beyond className/import lines + new SVG/PNG illustration files).

---

## 10. References

- Mockups: `design-preview/preview.html` (single 320 KB self-contained HTML, all 41 templates).
- User-supplied visual reference: 3-screen kids learning app composite (the pastel/yellow-highlighter starting point).
- Design conversation: brainstorming session 2026-04-27.
- Saved memory: `feedback_ket_pet_light_theme.md` (light theme by default, `#fff` bg, `#171717` fg, Arial → being upgraded to Manrope).

---

*This spec is the contract for the implementation phase. Changes to the mockups during implementation are allowed only with a corresponding spec update. The mockup file is canonical for any visual question.*
