# UI Redesign Implementation Plan (Variant A Pastel/Highlighter)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved Variant A pastel/yellow-highlighter design system from `design-preview/preview.html` (41 mockup sections) into the `apps/web` codebase across all ~40 routes. Visual restyle only — no JSX structural changes, no new features.

**Architecture:** One foundation PR that adds the Manrope font + design tokens + custom CSS classes to `globals.css`. Then per-route tasks that flip only `className` strings (and add `<span class="marker-yellow-thick">…</span>` decorations) — every diff must be className/import/font lines only, no JSX structural changes. Each task corresponds to one mockup section in `design-preview/preview.html`; the mockup is the canonical visual contract.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 (uses `@theme inline` in CSS, no `tailwind.config`) · Manrope (loaded via `next/font/google`, self-hosted at build time) · Existing component tree (no refactors).

---

## Spec → plan map

This plan implements the spec at `docs/superpowers/specs/2026-04-27-ui-redesign-design.md`. Every requirement has a task:

| Spec section | Tasks |
|---|---|
| §3.1 Color palette | Task 1.2 |
| §3.2 Typography (Manrope) | Task 1.1 |
| §3.3 Components (CSS classes) | Task 1.2 |
| §3.4 Skill ↔ color mapping | Tasks 3.2, 3.3 (KET/PET hubs) and 6.* (runners) |
| §4 Layout rules | Task 1.2 + Task 2.1 (page-section + locked-height) |
| §5 41 page archetypes | Tasks 2.1, 3.1–3.4, 4.1–4.3, 5.1–5.4, 6.1–6.7, 7.1–7.5, 8.1–8.2, 9.1–9.5, 10.1–10.3, 11.1–11.7 |
| §6 Implementation approach | Phase 0 (worktree) + Phase 1 (foundation) + Phases 2–11 (per-route) + Phase 12 (QA + PR) |
| §7 Out of scope | Verified at every commit (diff check) |
| §8 Risk #2 (Manrope CDN) | Task 1.1 (next/font/google self-hosts) |
| §8 Risk #3 (100dvh) | Task 12.4 |
| §8 Risk #6 (devs sneaking in JSX changes) | Verification step in every task: `git diff --stat` shows only className/import lines |
| §9 Acceptance criteria | Tasks 12.1–12.6 |

---

## File structure

### Created

- `apps/web/src/app/fonts.ts` — Manrope `next/font/google` declaration (single export `manrope`).

### Modified — global

- `apps/web/src/app/globals.css` — adds 80+ lines of design tokens (color CSS variables under `@theme inline`) + custom CSS classes (`.marker-yellow*`, `.stitched-card`, `.skill-tile`, `.arrow-chip`, `.stat-card`, `.star-sticker`, `.pill-tag`, `.tile-{color}`, `.site-header`, `.page-section`, `.locked-height`, `.grow-fill`, `.nav-item-mini`, `.nav-group-title`, `.nav-num`).
- `apps/web/src/app/layout.tsx` — replaces existing `Geist`/`Geist_Mono` imports with `manrope` from `./fonts.ts`; sets `<html>` className to `manrope.variable`.

### Modified — per-route (40 files)

Listed by phase in the tasks below. Every per-route diff must contain ONLY:
- `className` string changes
- Optional small wrapping (e.g. wrap an existing h1's punchline word in `<span class="marker-yellow-thick">…</span>`)
- New imports if any (e.g. importing a new icon component, but icons should match what's in the mockup)

Forbidden in per-route diffs:
- Adding/removing JSX elements
- Restructuring component hierarchies
- Adding new state, fetches, or props
- Changing the data model

If a route's component visually requires a structural change to match the mockup, **the mockup is wrong**, not the component — this happened during the audit (e.g. login mockup had a SiteHeader; real /login has none, mockup was corrected).

---

## Restyle Pattern Library (defined once, referenced from every task)

Every per-route task tells the implementer "apply patterns P-A, P-B, P-C from the library". Patterns capture the most common className transitions.

### P-Headline · big extrabold + yellow marker on the punchline phrase

```diff
- <h1 className="text-2xl font-semibold">KET 门户</h1>
+ <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight">
+   <span className="marker-yellow-thick">KET 门户</span>
+ </h1>
```

For two-phrase headlines, marker the second phrase only:

```diff
- <h1 className="text-2xl font-semibold">本周诊断测试</h1>
+ <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.05]">
+   <span>本周</span> <span className="marker-yellow-thick">诊断测试</span>
+ </h1>
```

### P-Subtitle · medium body, ink/75

```diff
- <p className="text-sm text-neutral-500">…</p>
+ <p className="mt-3 text-base sm:text-lg text-ink/75 leading-relaxed">…</p>
```

### P-Card · rounded-2xl/3xl, soft shadow, optional pastel fill

```diff
- <div className="rounded-md border border-neutral-300 p-4">
+ <div className="rounded-2xl bg-white border-2 border-ink/10 p-5 stitched-card">
```

For colored tile cards (skill tiles), use `.tile-{color}` instead of `bg-white`:

```diff
- <Link className="rounded-lg border border-neutral-300 p-5 hover:border-neutral-900">
+ <Link className="skill-tile tile-lavender stitched-card">
```

### P-Button-Primary · full-pill solid ink

```diff
- <button className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700">
+ <button className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-3 hover:bg-ink/90 transition">
```

### P-Button-Secondary · ghost-pill

```diff
- <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
+ <button className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold hover:bg-ink/5 transition">
```

### P-Input · big rounded with focus ring

```diff
- <input className="rounded-md border border-neutral-300 px-3 py-2" />
+ <input className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition" />
```

### P-Pill-Tag · small rounded chip

```diff
- <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">…</span>
+ <span className="pill-tag bg-lavender-tint border-2 border-ink/10">…</span>
```

### P-Status-Pill · color matches the canonical status mapping

| Status | Pill style |
|---|---|
| GRADED / 已评分 / SCORED | `pill-tag bg-mint-soft border-2 border-ink/15` |
| SUBMITTED / 已提交 / AUTO_SUBMITTED | `pill-tag bg-butter-soft border-2 border-ink/15` |
| IN_PROGRESS / 进行中 | `pill-tag bg-sky-soft border-2 border-ink/15` |
| NOT_STARTED / 未开始 / FAILED | `pill-tag bg-peach-soft border-2 border-ink/15` |

### P-Site-Header · the universal authenticated-page header

```diff
- <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
+ <header className="site-header">
```

### P-Skill-Color · canonical skill ↔ color mapping (apply inside the route's tile)

| Skill | Tile class |
|---|---|
| 阅读 / Reading | `tile-lavender` |
| 听力 / Listening | `tile-sky` |
| 写作 / Writing | `tile-butter` |
| 口语 / Speaking | `tile-peach` |
| 词汇 / Vocab | `tile-mint` |
| 语法 / Grammar | `tile-cream` |

### P-Locked-Height · runner-style fixed-viewport-height pages

For runner pages (reader, listening-runner, writing-runner, speaking-runner, vocab-spell, vocab-listen, grammar-quiz), the outermost `<main>` or page-root container needs:

```diff
- <main className="flex min-h-screen flex-col">
+ <main className="page-section locked-height flex flex-col gap-3">
```

And inside the runner, any 2-column passage/questions layout needs:

```diff
- <div className="grid lg:grid-cols-[1.05fr_1fr] gap-4">
+ <div className="grid lg:grid-cols-[1.05fr_1fr] gap-3 grow-fill min-h-0"
+      style={{ gridTemplateRows: 'minmax(0, 1fr)' }}>
```

Plus on the inner scrolling column wrapper:
```diff
- <div className="flex flex-col gap-3">
+ <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
```

This combination prevents page-level scroll — the inner columns scroll independently. **This is the most common bug** when porting runners; the first time you port a runner, verify by mouse-wheel scrolling in the questions column and confirming the passage column stays put.

---

## Phase 0 — Worktree setup

### Task 0.1: Create implementation worktree

**Files:** none yet.

- [ ] **Step 1: Switch to main checkout and pull latest**

```bash
cd /c/Users/wul82/Desktop/cambridge-ket-pet
git checkout main
git pull origin main
```

Expected: clean working tree, up to date with origin/main.

- [ ] **Step 2: Verify .worktrees/ is gitignored**

```bash
git check-ignore -q .worktrees && echo OK || echo FAIL
```

Expected: `OK`.

- [ ] **Step 3: Create worktree**

```bash
git worktree add .worktrees/ui-redesign -b design/ui-redesign-pastel
cd .worktrees/ui-redesign
```

Expected: new directory at `.worktrees/ui-redesign` on branch `design/ui-redesign-pastel` based on main.

- [ ] **Step 4: Install dependencies and verify baseline tests**

```bash
pnpm install --filter @cambridge-ket-pet/web
cd apps/web
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: all green. Capture pass/fail counts as the baseline.

- [ ] **Step 5: Commit (no changes yet — just the worktree handshake)**

No commit needed; worktree creation does not produce a commit. Move to Phase 1.

---

## Phase 1 — Foundation (Manrope + design tokens + custom CSS classes)

### Task 1.1: Self-host Manrope via `next/font/google`

**Files:**
- Create: `apps/web/src/app/fonts.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create the font declaration**

Create `apps/web/src/app/fonts.ts`:

```typescript
import { Manrope } from "next/font/google";

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
```

- [ ] **Step 2: Wire Manrope into the root layout**

Open `apps/web/src/app/layout.tsx`. The current file imports `Geist` and `Geist_Mono` from `next/font/google` and applies them as className on the `<html>` tag. Replace those imports with the Manrope import + apply the variable.

```diff
- import { Geist, Geist_Mono } from "next/font/google";
+ import { manrope } from "./fonts";
…
- const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
- const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
…
- <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
+ <html lang="zh-CN" className={manrope.variable}>
```

(Also change `lang="en"` → `lang="zh-CN"` to match the actual app language. The mockup uses `zh-CN`.)

- [ ] **Step 3: Verify the foundation build still passes**

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm exec eslint src/app/layout.tsx src/app/fonts.ts
```

Expected: exit 0 from both.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/fonts.ts apps/web/src/app/layout.tsx
git commit -m "feat(ui): self-host Manrope via next/font/google"
```

### Task 1.2: Add design tokens + custom CSS classes to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

The current file is 40 lines (mostly the Tailwind import, root color vars, body styles, and a fade-in keyframe). After this task it will be ~250 lines.

- [ ] **Step 1: Replace `globals.css` with the redesign foundation**

Open `apps/web/src/app/globals.css` and replace the entire contents with the following. This preserves the existing fade-in animation, replaces the dark-theme block (light theme only per spec §4.1), and adds tokens + classes from the mockup file.

```css
@import "tailwindcss";

:root {
  /* Backwards-compat */
  --background: #ffffff;
  --foreground: #0f172a;

  /* Variant A tokens */
  --color-ink: #0f172a;
  --color-mist: #f4ecff;
  --color-skywash: #eef2ff;

  --color-lavender: #a78bfa;
  --color-lavender-soft: #c7b8ff;
  --color-lavender-tint: #ede7ff;
  --color-sky: #7db8ff;
  --color-sky-soft: #bcd8ff;
  --color-sky-tint: #e4efff;
  --color-butter: #ffd96b;
  --color-butter-soft: #ffe38a;
  --color-butter-tint: #fff6d6;
  --color-peach: #ffc4d1;
  --color-peach-soft: #ffd4dd;
  --color-peach-tint: #ffebf0;
  --color-mint: #a8e6cf;
  --color-mint-soft: #c6f0dc;
  --color-mint-tint: #e6f8ee;

  --font-sans: var(--font-manrope), system-ui, sans-serif;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --color-ink: var(--color-ink);
  --color-mist: var(--color-mist);
  --color-skywash: var(--color-skywash);
  --color-lavender: var(--color-lavender);
  --color-lavender-soft: var(--color-lavender-soft);
  --color-lavender-tint: var(--color-lavender-tint);
  --color-sky: var(--color-sky);
  --color-sky-soft: var(--color-sky-soft);
  --color-sky-tint: var(--color-sky-tint);
  --color-butter: var(--color-butter);
  --color-butter-soft: var(--color-butter-soft);
  --color-butter-tint: var(--color-butter-tint);
  --color-peach: var(--color-peach);
  --color-peach-soft: var(--color-peach-soft);
  --color-peach-tint: var(--color-peach-tint);
  --color-mint: var(--color-mint);
  --color-mint-soft: var(--color-mint-soft);
  --color-mint-tint: var(--color-mint-tint);

  --font-sans: var(--font-sans);
}

html {
  font-size: 17px;
}

body {
  background: linear-gradient(180deg, #eef2ff 0%, #f4ecff 100%);
  color: var(--color-ink);
  font-family: var(--font-sans);
  min-height: 100vh;
}

/* Yellow highlighter on headline punchline phrases */
.marker-yellow {
  background: linear-gradient(transparent 55%, #ffe066 55% 92%, transparent 92%);
  padding: 0 0.25em;
  font-weight: 800;
  -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
}
.marker-yellow-thick {
  background: linear-gradient(transparent 35%, #ffe066 35% 95%, transparent 95%);
  padding: 0 0.3em;
  font-weight: 800;
  -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
}

/* Card shadows */
.stitched-card {
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.04),
    0 8px 24px -10px rgba(15, 23, 42, 0.1);
}

/* Pill chip */
.pill-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.9rem;
}

/* Universal site header (used on every authenticated page) */
.site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: #fff;
  padding: 0.7rem 1.1rem;
  border-radius: 1rem;
  box-shadow:
    0 1px 0 rgba(15, 23, 42, 0.04),
    0 6px 18px -8px rgba(15, 23, 42, 0.08);
}

/* Skill tile (KET/PET hub + vocab/grammar overview tiles) */
.skill-tile {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem 1.4rem;
  border-radius: 1.25rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
  min-height: 11rem;
}
.skill-tile:hover {
  border-color: var(--color-ink);
  transform: translateY(-2px);
}

.arrow-chip {
  display: inline-grid;
  place-items: center;
  height: 2.25rem;
  width: 2.25rem;
  border-radius: 9999px;
  background: var(--color-ink);
  color: #fff;
  transition: transform 0.15s;
}
.skill-tile:hover .arrow-chip {
  transform: translateX(3px);
}

.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
}

.star-sticker {
  position: absolute;
  background: #ffe066;
  color: var(--color-ink);
  font-weight: 800;
  font-size: 0.78rem;
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  border: 2px solid var(--color-ink);
  transform: rotate(-6deg);
}

/* Pastel tile fills */
.tile-lavender { background: linear-gradient(135deg, #ede7ff 0%, #d9c9ff 100%); }
.tile-sky      { background: linear-gradient(135deg, #e4efff 0%, #c8defe 100%); }
.tile-butter   { background: linear-gradient(135deg, #fff6d6 0%, #ffe38a 100%); }
.tile-peach    { background: linear-gradient(135deg, #ffebf0 0%, #ffd4dd 100%); }
.tile-mint     { background: linear-gradient(135deg, #e6f8ee 0%, #b3e8c9 100%); }
.tile-cream    { background: linear-gradient(135deg, #fff7e8 0%, #ffe9b8 100%); }

/* Page-section: hub-style (default) and runner-style (locked-height) */
.page-section {
  min-height: calc(100dvh - 2rem);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.page-section.locked-height {
  min-height: 0;
  height: calc(100dvh - 2rem);
  max-height: calc(100dvh - 2rem);
}
.grow-fill {
  flex: 1;
  min-height: 0;
}

/* Existing fade-in (kept verbatim from old globals.css) */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 180ms ease-out both;
}
```

Note: this drops the `prefers-color-scheme: dark` block from the original globals.css per spec §7 ("Dark theme. Explicitly dropped per memory.").

Note: this uses `100dvh` (dynamic viewport height) for `.page-section` per spec §8 risk #3 (handles iOS Safari browser-chrome quirks).

- [ ] **Step 2: Verify CSS parses (Tailwind compile)**

```bash
cd apps/web
pnpm dev
```

Open http://localhost:3000 in a browser. Expected: site loads in light theme, body uses Manrope, gradient background visible.

Stop the dev server (Ctrl+C).

- [ ] **Step 3: Verify TS still compiles + lint passes**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/app/globals.css || true   # ESLint may not lint CSS, that's OK
```

Expected: tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(ui): add design tokens + custom CSS classes to globals.css"
```

### Task 1.3: Foundation smoke test

The foundation is in but no page uses any new class yet. Open the 4 anchor pages and confirm: (a) Manrope is rendering, (b) the body has the gradient background, (c) pages are still functional. No styling regressions.

- [ ] **Step 1: Boot dev server**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 2: Visual smoke test the 4 anchor routes**

In a browser, visit each:
- http://localhost:3000/ — landing (logged-out)
- http://localhost:3000/login — auth form still works
- http://localhost:3000/ket — KET hub, tiles still clickable (after login)
- http://localhost:3000/diagnose — diagnose hub renders

Expected for each: page renders without console errors, fonts load, gradient background visible at body, all existing functionality preserved.

- [ ] **Step 3: Stop dev server. Commit nothing (no file changes from this verification step).**

---

## Phase 2 — SiteHeader (universal nav, restyle once, applies everywhere)

### Task 2.1: Restyle SiteHeader

**Files:**
- Modify: `apps/web/src/components/SiteHeader.tsx`

**Mockup reference:** open `design-preview/preview.html` and find the site-header at the top of the `#kethub` section (lines beginning `<div class="site-header">`). The bare-bones logo+nav layout is in `#login`.

- [ ] **Step 1: Read the current file and the mockup section side-by-side**

```bash
cat apps/web/src/components/SiteHeader.tsx
grep -n 'site-header' design-preview/preview.html | head -10
```

- [ ] **Step 2: Apply patterns**

Use Edit tool to apply these transitions to `SiteHeader.tsx`:

1. The outermost `<header>`: replace `className="flex items-center justify-between border-b border-neutral-200 px-6 py-4"` with `className="site-header"` (P-Site-Header).

2. Logo block: wrap the existing `{t.app.name}` Link in a flex with the K-square logo:

```diff
- <Link href="/" className="text-lg font-semibold">{t.app.name}</Link>
+ <Link href="/" className="flex items-center gap-2.5">
+   <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white font-extrabold text-sm">K</span>
+   <span className="font-extrabold text-base">{t.app.name}</span>
+ </Link>
```

3. The nav area: change `className="flex items-center gap-3 text-sm"` → `className="flex flex-wrap items-center gap-1.5 text-sm font-bold"`.

4. Each nav `<Link>`: change `className="text-neutral-700 hover:text-neutral-900"` → `className="rounded-full px-3.5 py-1.5 hover:bg-ink/5"`.

5. The teacher panel `<Link>` and the apply-teacher fallback (currently has `border-2 border-neutral-300 px-3 py-1.5`): use P-Button-Secondary.

6. The signOut button: use P-Button-Secondary.

7. The teacher-badge `<span>`: change `bg-neutral-900 text-white` → `bg-ink text-white` and use the new pill-tag spacing if visually crowded.

8. The email span: change to `hidden sm:inline rounded-full bg-mist px-3.5 py-1.5 text-ink/70`.

9. The diagnose red-dot indicator span: keep its existing positioning, just confirm `bg-rose-500 ring-2 ring-white` still renders correctly on the new background.

- [ ] **Step 3: Verify diff is className-only**

```bash
git diff --stat apps/web/src/components/SiteHeader.tsx
git diff apps/web/src/components/SiteHeader.tsx | grep -E '^[+-]' | grep -vE '^[+-]\s*(import|className=|\$|<span|<Link|<button|^[+-]+$)' | head
```

Expected: no JSX structural diffs (no new/removed `<Link>` children, no new state).

- [ ] **Step 4: Type-check + lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/components/SiteHeader.tsx
```

Expected: exit 0.

- [ ] **Step 5: Visual check**

Boot `pnpm dev`, open `/ket` (after login). Expected: SiteHeader has the white rounded card, K logo, pill-shaped nav links, ink-pill primary buttons. The red dot still appears on `/diagnose` link if user is gated.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/SiteHeader.tsx
git commit -m "feat(ui): restyle SiteHeader to Variant A pastel/pill nav"
```

---

## Phase 3 — Hub pages (highest traffic, ports first)

Same pattern for each: open the mockup section in preview.html, port classNames in the route file. Each task ~5 minutes of restyling + verification.

### Task 3.1: Home page (logged-in + logged-out branches)

**Files:** Modify `apps/web/src/app/page.tsx`

**Mockup sections:** `#home-out` (logged-out) and `#home-in` (logged-in) in `design-preview/preview.html`.

- [ ] **Step 1: Read mockup + source**

```bash
grep -n 'id="home-out"\|id="home-in"' design-preview/preview.html
cat apps/web/src/app/page.tsx
```

- [ ] **Step 2: Apply patterns**

For the outer `<div className="flex min-h-screen flex-col">` → `<div className="page-section">`.

For the `<main>` inside, change `className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12"` → `className="grow-fill flex flex-col items-center justify-center gap-8 px-6 py-12"`.

For the headline group:
- `<h1 className="text-4xl font-bold">{t.app.title}</h1>` → wrap title's punchline in `<span className="marker-yellow-thick">…</span>` and bump to `text-4xl sm:text-5xl font-extrabold leading-[1.05]` (P-Headline). Note: t.app.title is "剑桥 KET / PET 备考"; pick the punchline phrase to highlight (e.g. "备考").
- `<p className="max-w-lg text-neutral-600">` → P-Subtitle: `text-base sm:text-lg text-ink/75 leading-relaxed`.

For the logged-in 2-portal block:
- The KET portal `<Link>`: replace `className="rounded-lg border border-neutral-300 px-8 py-4 text-center transition hover:border-neutral-900 hover:shadow-sm"` with `skill-tile tile-lavender stitched-card max-w-xs` (P-Card + P-Skill-Color, lavender for KET).
- PET portal `<Link>`: same pattern but `tile-sky` (B1).
- Inside each portal: `text-2xl font-semibold` → `text-2xl sm:text-3xl font-extrabold`.

For the logged-out CTA `<Link href="/signup">`: use P-Button-Primary with bigger size: `rounded-full bg-ink text-white font-extrabold px-8 py-4 hover:bg-ink/90 transition text-lg`.

- [ ] **Step 3: Verify diff**

```bash
git diff apps/web/src/app/page.tsx
```

Confirm only className changes + the marker-yellow span wrap. No new JSX elements.

- [ ] **Step 4: Type-check + lint**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src/app/page.tsx
```

- [ ] **Step 5: Visual check on both branches**

```bash
pnpm dev
```

Visit `/` while logged out → expect headline + CTA. Log in → revisit `/` → expect 2 portal tiles.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(ui): restyle home page (logged-out + logged-in)"
```

### Task 3.2: KET hub

**Files:** Modify `apps/web/src/app/ket/page.tsx`

**Mockup:** `#kethub` in preview.html.

- [ ] **Step 1: Read mockup + source side-by-side**

```bash
grep -n 'id="kethub"' design-preview/preview.html
cat apps/web/src/app/ket/page.tsx
```

- [ ] **Step 2: Apply patterns**

- Outer `<div className="flex min-h-screen flex-col">` → `<div className="page-section">`.
- `<main>` inner: change padding to `mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-5` and add `grow-fill` if the content needs to fill; otherwise leave as-is.
- `<h1 className="mb-2 text-2xl font-semibold">KET 门户</h1>` → P-Headline with `marker-yellow-thick` on "KET 门户" entirely (one phrase, marker the whole thing).
- `<p className="mb-6 text-sm text-neutral-500">` → P-Subtitle.
- The 6 skill tiles `<Link className="rounded-lg border border-neutral-300 p-5 ...">`: each one gets P-Card + P-Skill-Color. Map: 阅读→`tile-lavender`, 写作→`tile-butter`, 听力→`tile-sky`, 口语→`tile-peach`, 词汇→`tile-mint`, 语法→`tile-cream`. Inside each: `text-lg font-semibold` → `text-xl sm:text-2xl font-extrabold leading-tight`. Description `text-xs text-neutral-500` → `text-sm font-medium text-ink/70 leading-snug`.
- For each skill tile, append an `<span className="arrow-chip">→</span>` in the top-right inside the tile (this is the only NEW JSX allowed — it's a decorative element matching the design system, not a new feature).

⚠️ Verify ⚠️ — adding the arrow-chip is the ONE structural addition allowed for this task. If you find yourself adding more JSX, stop and ask the user.

- [ ] **Step 3: Verify diff is className+arrow-chip-only**

```bash
git diff apps/web/src/app/ket/page.tsx
```

- [ ] **Step 4: Type-check + lint**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src/app/ket/page.tsx
```

- [ ] **Step 5: Visual check**

`pnpm dev`, visit `/ket` while logged in. Expect: 6 pastel tiles in 3-col grid (sm:2-col), proper colors per skill, arrow-chips top-right, hover lifts the tile.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/ket/page.tsx
git commit -m "feat(ui): restyle KET hub with 6 pastel skill tiles"
```

### Task 3.3: PET hub

**Files:** Modify `apps/web/src/app/pet/page.tsx`

**Mockup:** `#pethub` in preview.html.

Identical to Task 3.2, but the route is PET. Same skill ↔ color mapping. The route content differs only in subtitle ("Cambridge B1 Preliminary") and per-tile sub-text counts (B1 词表 has more words).

- [ ] **Step 1–6:** Repeat Task 3.2's steps for `apps/web/src/app/pet/page.tsx`. Mockup ref: `#pethub`. Commit message: `feat(ui): restyle PET hub with 6 pastel skill tiles`.

### Task 3.4: Diagnose hub

**Files:**
- Modify: `apps/web/src/app/diagnose/page.tsx` (page component, mostly fetches and passes data to DiagnoseHub).
- Modify: `apps/web/src/components/diagnose/DiagnoseHub.tsx` (the actual visual component).
- Modify: `apps/web/src/components/diagnose/SectionStatusCard.tsx` (per-section card).

**Mockup:** `#diaghub` in preview.html.

- [ ] **Step 1: Read mockup + 3 source files**

```bash
grep -n 'id="diaghub"' design-preview/preview.html
cat apps/web/src/components/diagnose/DiagnoseHub.tsx
cat apps/web/src/components/diagnose/SectionStatusCard.tsx
```

- [ ] **Step 2: Apply patterns to DiagnoseHub.tsx**

The week-banner `<div className="rounded-md border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-5">` → `<div className="rounded-3xl border-2 border-ink/10 p-6 sm:p-7 stitched-card relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)' }}>`.

The "AI" badge `<span className="flex h-6 w-6 ... rounded-full bg-indigo-600 text-xs font-bold text-white">AI</span>` → `<span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white text-[11px] font-extrabold tracking-wider">AI</span>`.

The KET/PET pill `<span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">{examType}</span>` → `<span className="pill-tag bg-white border-2 border-ink/10">{examType}</span>`.

The h1 inside the banner: bump to P-Headline with marker-yellow-thick on the punchline phrase from `t.diagnose.pageTitle` (e.g. "本周 诊断测试" → marker on "诊断测试").

The "查看本周诊断报告 →" Link button (when reportReady): use P-Button-Primary.

The progress bar `<div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-200">` + inner `bg-indigo-600` → `<div className="h-3 w-full rounded-full bg-mist border-2 border-ink/10 mb-5 overflow-hidden">` + inner `bg-ink rounded-full`.

The h2 sectionsTitle: P-Headline (smaller — `text-xl sm:text-2xl`).

The sections grid: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` stays. Each card is rendered by SectionStatusCard.

- [ ] **Step 3: Apply patterns to SectionStatusCard.tsx**

Outer card → P-Card with `tile-{color}` per section kind (use P-Skill-Color mapping based on the `kind` prop).

Section title text → `text-lg font-extrabold` (already pretty bold, just confirm).

Status pill → P-Status-Pill (mapping based on status prop).

CTA button → P-Button-Primary with smaller size (`px-3 py-1.5 text-xs`) for inline cards.

- [ ] **Step 4: Verify diff is className-only**

```bash
git diff apps/web/src/components/diagnose/DiagnoseHub.tsx apps/web/src/components/diagnose/SectionStatusCard.tsx
```

- [ ] **Step 5: Type-check + lint**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/components/diagnose/DiagnoseHub.tsx src/components/diagnose/SectionStatusCard.tsx
```

- [ ] **Step 6: Visual check**

`pnpm dev`, visit `/diagnose`. Expect: pastel banner, big yellow-marker headline, 6 colored section cards, status pills.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/diagnose/DiagnoseHub.tsx apps/web/src/components/diagnose/SectionStatusCard.tsx
git commit -m "feat(ui): restyle diagnose hub + section status cards"
```

---

## Phase 4 — Auth pages (3 tasks)

### Task 4.1: Login

**Files:** Modify `apps/web/src/app/login/page.tsx`

**Mockup:** `#login` in preview.html. Note the rebuilt mockup correctly omits a SiteHeader (the real /login has none).

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer wrapper → centered card layout, `min-h-screen flex items-center justify-center px-4`.
  - The form card → P-Card with rounded-3xl + `stitched-card` + `border-2 border-ink/10`. Add a decorative shadow sibling: `<div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[24px] bg-lavender-soft -z-10"></div>` inside a `relative max-w-md` wrapper.
  - The h1 "登录" → P-Headline with marker-yellow on "登录".
  - The subtitle → P-Subtitle.
  - Email/password inputs → P-Input.
  - Submit button → P-Button-Primary (full width: `w-full`).
  - Footer "还没有账号？注册" link → keep wording, restyle to bold ink link.
- [ ] **Step 3: Verify diff (mostly className).**
- [ ] **Step 4: tsc + eslint.**
- [ ] **Step 5: Visual check `/login`.**
- [ ] **Step 6: Commit**: `feat(ui): restyle login page`

### Task 4.2: Signup

**Files:** Modify `apps/web/src/app/signup/page.tsx`

**Mockup:** `#signup`. Same patterns as login. Has 姓名/邮箱/密码 inputs (verify exact field names in source).

Same step structure as Task 4.1. Commit: `feat(ui): restyle signup page`.

### Task 4.3: Teacher activate

**Files:**
- Modify: `apps/web/src/app/teacher/activate/page.tsx`
- Modify: `apps/web/src/components/teacher/ActivateForm.tsx` (or wherever the form lives — verify by reading the page file for the actual form component import).

**Mockup:** `#teacher-activate`.

Same patterns: standalone narrow card, P-Headline, P-Input, P-Button-Primary. Commit: `feat(ui): restyle teacher activate page`.

---

## Phase 5 — Skill pickers (4 tasks, one per skill)

### Task 5.1: Reading new

**Files:** Modify `apps/web/src/components/reading/NewForm.tsx`

**Mockup:** `#reading-new`. Real layout: 5 KET parts (or 6 PET) as buttons + mode radio + submit.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer container → `page-section` with appropriate width container.
  - Heading h1 "新建 KET 阅读练习" → P-Headline with marker on "阅读练习".
  - Subtitle → P-Subtitle.
  - "返回门户" link → P-Button-Secondary.
  - The 5 part `<button>` cards: each becomes a `skill-tile` with rotating pastel `tile-{color}` (use the canonical P-Skill-Color for Reading, then within Reading tiles, rotate the pastels for visual variety: P1=lavender, P2=sky, P3=butter, P4=peach, P5=mint, P6=cream when present). Inside: `font-medium` → `font-extrabold text-base` for "Part N", subtitle `text-xs text-neutral-500` → `text-sm font-medium text-ink/70`.
  - Mode radio (PRACTICE/MOCK): convert to two pill-tag buttons styled like P-Button-Secondary, with the active one using `bg-ink text-white border-ink`.
  - Submit button → P-Button-Primary.
  - Error message div: keep existing red styling but use `border-2 border-rose-200 bg-rose-50 rounded-2xl p-3 text-sm font-medium text-rose-700`.
- [ ] **Step 3: Verify diff.**
- [ ] **Step 4: tsc + eslint.**
- [ ] **Step 5: Visual check `/ket/reading/new` and `/pet/reading/new`.**
- [ ] **Step 6: Commit**: `feat(ui): restyle reading new picker`

### Task 5.2: Listening new

**Files:** Modify `apps/web/src/components/listening/NewListeningPicker.tsx` (verify component name by reading the route's page.tsx).

**Mockup:** `#listening-new`. Same patterns as 5.1; pastel rotation P1=sky, P2=lavender, etc. KET has 5 parts, PET has 4. Commit: `feat(ui): restyle listening new picker`.

### Task 5.3: Writing new

**Files:** Modify `apps/web/src/components/writing/NewForm.tsx`

**Mockup:** `#writing-new`. KET has Part 6 (邮件) and Part 7 (图片故事). PET has different parts. Same patterns.

Commit: `feat(ui): restyle writing new picker`.

### Task 5.4: Speaking new

**Files:**
- Modify: `apps/web/src/app/ket/speaking/new/page.tsx` (verify path)
- Modify: `apps/web/src/components/speaking/MicPermissionGate.tsx`
- Modify: `apps/web/src/components/speaking/ConnectionTest.tsx`
- Modify: `apps/web/src/components/speaking/NewForm.tsx` (or whatever the parent page component is)

**Mockup:** `#speaking-new`. Real layout has only Mic gate + Connection test + single CTA — confirm by reading the source.

Apply patterns. The mic-permission "✓ 麦克风已就绪" status → P-Status-Pill (mint when ready, peach when not). The CTA "开始测试" → P-Button-Primary. Commit: `feat(ui): restyle speaking new page`.

---

## Phase 6 — Skill runners (7 tasks; CRITICAL: locked-height + column-scroll fix)

For every runner, P-Locked-Height MUST be applied correctly. This is the bug that will bite if you're not careful — the page-level scroll instead of column scroll.

### Task 6.1: Reading runner

**Files:** Modify `apps/web/src/components/reading/Runner.tsx`

**Mockup:** `#reader` in preview.html.

- [ ] **Step 1: Read mockup + source. Pay special attention to the locked-height + grid CSS.**
- [ ] **Step 2: Apply patterns.**
  - Outer wrapper → `page-section locked-height`.
  - Top status bar → restyle to `site-header` pattern (ink/5 back button, butter-tint timer pill, ink primary submit button).
  - The 2-column grid → P-Locked-Height pattern: `grid lg:grid-cols-[1.05fr_1fr] gap-3.5 grow-fill min-h-0` + inline `style={{ gridTemplateRows: 'minmax(0, 1fr)' }}`.
  - Passage card → `self-start min-h-0 max-h-full overflow-y-auto rounded-3xl bg-white border-2 border-ink/10 p-5 sm:p-6 stitched-card`.
  - Question card outer → `flex flex-col gap-3 min-h-0 overflow-hidden`.
  - Question list inner div → `space-y-3 overflow-y-auto pr-1 grow-fill min-h-0`.
  - Each question card → P-Card.
  - Each MCQ option button → `w-full text-left rounded-xl border-2 border-ink/10 px-3.5 py-2.5 hover:border-ink transition flex items-center gap-2.5`. Active state (when selected): `bg-butter-tint border-ink`.
  - Letter chip A/B/C → `grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink/5 font-extrabold text-xs` (default) or `bg-ink text-white` (active).
  - Counter footer → `rounded-2xl bg-mint-tint border-2 border-ink/10 px-4 py-2.5 flex items-center gap-2.5 shrink-0`.
- [ ] **Step 3: Verify diff. CONFIRM: no new JSX elements, only className + inline-style for grid-template-rows.**
- [ ] **Step 4: tsc + eslint.**
- [ ] **Step 5: Visual + scroll check.**

⚠️ CRITICAL ⚠️ — boot dev server, generate a reading attempt (or open an existing attempt), and:
1. Mouse-wheel scroll inside the questions column → only questions scroll, passage stays put.
2. Mouse-wheel scroll on empty area between columns → page does NOT scroll.
3. Resize browser window → grid still works, columns scroll.

If the page scrolls instead of columns, P-Locked-Height was applied wrong; reread Task 6.1 step 2.

- [ ] **Step 6: Commit**: `feat(ui): restyle reading runner with locked-height column scroll`

### Task 6.2: Listening runner

**Files:**
- Modify: `apps/web/src/components/listening/ListeningRunner.tsx`
- Modify: `apps/web/src/components/listening/AudioPlayer.tsx`

**Mockup:** `#listening-runner`. Real layout: single column with sticky audio at top + scrollable questions below. Audio player controls (play/pause/seek/speed/per-segment replay) all real per AudioPlayer.tsx.

- [ ] **Step 1: Read mockup + 2 source files.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section locked-height`.
  - Header strip → site-header pattern.
  - Single-column body: outer div uses `grow-fill flex flex-col gap-3 min-h-0`. Top: sticky audio card (P-Card + `sticky top-0 z-10`). Below: questions list `space-y-3 overflow-y-auto pr-1 grow-fill min-h-0`.
  - Audio progress bar: `<div className="h-2 w-full rounded-full bg-mist border-2 border-ink/10 overflow-hidden"><div className="h-full bg-ink" style={{ width: ... }}></div></div>`.
  - Per-segment replay buttons: P-Button-Secondary smaller.
  - Speed pills: P-Pill-Tag with tile-butter for active.
  - Question cards: same pattern as reading runner.
- [ ] **Step 3–5:** verify diff + tsc + eslint + visual scroll check.
- [ ] **Step 6: Commit**: `feat(ui): restyle listening runner + audio player`

### Task 6.3: Writing runner

**Files:** Modify `apps/web/src/components/writing/Runner.tsx`

**Mockup:** `#writing-runner`. Real layout: 2 columns — task card on left, textarea on right. Word counter chip on right column.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section locked-height`.
  - Header → site-header pattern with butter-tint word-count chip ("已写 N 词 ✓ 达到最低要求") and ink primary submit.
  - 2-col grid → P-Locked-Height grid pattern.
  - Task card (left): P-Card with content_points list as small pill-tags.
  - Textarea (right): full-height textarea with `rounded-2xl border-2 border-ink/15 bg-white p-5 text-base font-medium focus:border-ink outline-none resize-none flex-1 min-h-0`.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle writing runner`

### Task 6.4: Speaking runner

**Files:**
- Modify: `apps/web/src/components/speaking/SpeakingRunner.tsx` (or `ClientSpeakingRunner.tsx`)
- Modify: `apps/web/src/components/speaking/MinaAvatarPanel.tsx`
- Modify: `apps/web/src/components/speaking/StatusPill.tsx`
- Modify: `apps/web/src/components/speaking/PartProgressBar.tsx`
- Modify: `apps/web/src/components/speaking/EndTestButton.tsx`
- Modify: `apps/web/src/components/speaking/PhotoPanel.tsx`
- Modify: `apps/web/src/components/speaking/TranscriptViewer.tsx`

**Mockup:** `#speaking-runner`. Real layout: Mina video panel + StatusPill + PartProgressBar (no live chat bubbles, transcript collapsed by default).

- [ ] **Step 1: Read mockup + 7 source files.**
- [ ] **Step 2: Apply patterns to each.**
  - SpeakingRunner outer wrapper: `page-section locked-height`.
  - 2-col grid: P-Locked-Height grid; left col = Mina video + photo panel, right col = status + progress + collapsed transcript.
  - StatusPill: P-Status-Pill with state-mapped colors (mint=ready, butter=processing, peach=error, sky=in-progress).
  - PartProgressBar: 3 segmented dashes, current = ink, complete = ink/40, future = ink/15.
  - EndTestButton: P-Button-Primary with ink fill.
  - MinaAvatarPanel video container: `rounded-3xl bg-ink overflow-hidden aspect-video stitched-card border-2 border-ink/10`.
  - PhotoPanel: P-Card.
  - TranscriptViewer: keep collapsed-by-default, restyle the toggle as a pill-tag.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check (test full speaking flow including Mina avatar render).
- [ ] **Step 6: Commit**: `feat(ui): restyle speaking runner + 6 sub-components`

### Task 6.5: Vocab spell runner

**Files:** Modify `apps/web/src/components/vocab/VocabSpellRunner.tsx`

**Mockup:** `#vocab-spell`. Real layout: single centered word card with audio play button + text input + submit.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section locked-height`.
  - Header strip → site-header pattern with progress chip "第 N / M".
  - Centered card (max-w-2xl mx-auto): P-Card big.
  - Audio play button: `grid h-20 w-20 place-items-center rounded-full bg-lavender-soft border-2 border-ink/15 hover:bg-lavender transition`.
  - Text input: P-Input with `text-2xl font-extrabold text-center`.
  - Submit button: P-Button-Primary.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle vocab spell runner`

### Task 6.6: Vocab listen runner

**Files:** Modify `apps/web/src/components/vocab/VocabListenRunner.tsx`

**Mockup:** `#vocab-listen`. Real layout: similar to vocab-spell but with masked word + reveal button instead of input.

Same patterns as 6.5. Commit: `feat(ui): restyle vocab listen runner`.

### Task 6.7: Grammar quiz runner

**Files:** Modify `apps/web/src/components/grammar/GrammarQuizRunner.tsx` and any sibling components (MCQOption.tsx if separate).

**Mockup:** `#grammar-quiz`. Real layout: single MCQ per screen, max-w-3xl card centered.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section locked-height`.
  - Header strip → site-header pattern with progress chip.
  - Centered card: P-Card big.
  - Topic chip: P-Pill-Tag with `tile-cream`.
  - Question text: `text-2xl font-bold` (no marker).
  - 4 MCQ options: same option-button pattern as reader (rounded-xl, letter chip, hover:border-ink, active=bg-butter-tint border-ink).
  - Prev/Next buttons: P-Button-Secondary / P-Button-Primary respectively.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle grammar quiz runner`

---

## Phase 7 — Result pages (5 tasks)

### Task 7.1: Reading result

**Files:** Modify `apps/web/src/components/reading/ResultView.tsx`

**Mockup:** `#reading-result`. Real layout: 3 stat cards (得分 / 正确题数 / 错题数) + per-question breakdown + 薄弱点分析 panel.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section`.
  - Header → site-header pattern with back link.
  - h1 → P-Headline (marker on the punchline word from the existing h1 — e.g. "成绩").
  - 3 stat cards row: each `stat-card` with rotating pastel (lavender/sky/butter).
  - 薄弱点分析 panel: P-Card with mint-tint background.
  - Per-question breakdown list: each item is a P-Card with `bg-mint-tint` if correct or `bg-peach-tint` if wrong; option highlighting.
  - exam_point/difficulty_point chips: P-Pill-Tag with ink/5 background.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle reading result page`

### Task 7.2: Listening result

**Files:** Modify `apps/web/src/app/ket/listening/result/[attemptId]/page.tsx` (verify against PET twin too).

**Mockup:** `#listening-result`. Same 3-stat-card structure as reading. Includes audio player + tapescript + per-question correctness.

Same patterns as 7.1. Commit: `feat(ui): restyle listening result page`.

### Task 7.3: Writing result

**Files:** Modify `apps/web/src/components/writing/ResultView.tsx`

**Mockup:** `#writing-result`. Real layout: total band score + 4 RubricBars + student response + AI feedback.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Header → site-header pattern.
  - Hero score card: P-Card with butter-tint and big "14/20" `text-6xl font-extrabold`.
  - 4 RubricBar rows: each one styled with progress-bar `bg-mist border-2 border-ink/10` outer + `bg-ink` inner fill, label uses canonical Cambridge English criterion names (Content / Communicative / Organisation / Language).
  - Student response card: P-Card with `bg-mist/30 italic`.
  - AI feedback card: P-Card with `tile-butter`.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle writing result page`

### Task 7.4: Speaking result

**Files:**
- Modify: `apps/web/src/components/speaking/SpeakingResult.tsx`
- Modify: `apps/web/src/components/speaking/RubricBar.tsx`
- Confirm: TranscriptViewer.tsx already restyled in Task 6.4.

**Mockup:** `#speaking-result`. Real Cambridge KET/PET speaking rubric: 4 ENGLISH criteria (Grammar & Vocabulary, Discourse Management, Pronunciation, Interactive Communication). Use these exact labels.

Same pattern structure as writing result; criteria names are different. Commit: `feat(ui): restyle speaking result + rubric bar`.

### Task 7.5: Grammar mistakes

**Files:** Modify `apps/web/src/components/grammar/GrammarMistakes.tsx`

**Mockup:** `#grammar-mistakes`. Real layout: 4 status tabs (全部/待复习/已复习/已掌握) + scrollable list of mistake cards.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section`.
  - Header → site-header pattern.
  - h1 → P-Headline (marker on "错题本").
  - Tabs row: each tab as `pill-tag` with bg-ink text-white when active, P-Button-Secondary style when inactive.
  - Mistake cards: P-Card with rotating pastel `tile-{color}`. Inside: real labels (`你答错: …` with rose-700, `正确答案: …` with mint highlight).
  - Action buttons (标记已复习 / 标记已掌握 / 重新练习此题 / 重新学习): P-Button-Secondary smaller.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle grammar mistakes page`

---

## Phase 8 — Subject overviews (Vocab + Grammar hubs)

### Task 8.1: Vocab overview

**Files:** Modify `apps/web/src/components/vocab/VocabHub.tsx`

**Mockup:** `#vocab-overview`. Real layout: header + 总体掌握度 card + 4 mode CTAs + 3 tier cards + filter pills + word table with pagination.

- [ ] **Step 1: Read mockup + source.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section`.
  - Header → site-header pattern.
  - h1 → P-Headline (marker on "词汇" or "Vocabulary").
  - 总体掌握度 card: P-Card with mint-tint, big number.
  - 4 mode CTAs: each as P-Card / `skill-tile` with rotating pastel — sky for 听写, butter for 拼写; CORE vs mixed differentiation via badge.
  - 3 tier cards (必修核心 ★★★ / 推荐 ★★ / 拓展 ★): stat-card style with pastel rotation.
  - Filter pills row: P-Pill-Tag with active = bg-ink text-white.
  - Search input: P-Input.
  - Table headers/rows: keep table structure, add `rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card` to the wrapping container; rows get `border-b border-ink/5` between them.
  - Pagination: prev/next buttons P-Button-Secondary.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle vocab overview hub`

### Task 8.2: Grammar overview

**Files:**
- Modify: `apps/web/src/components/grammar/GrammarHub.tsx`
- Modify: `apps/web/src/components/grammar/CategoryCard.tsx`
- Modify: `apps/web/src/components/grammar/TopicChip.tsx`

**Mockup:** `#grammar-overview`. Real layout: 11 category-grouped CategoryCards with chip-style topic links + ⚠ 薄弱点专练 / 🎲 随机混合 / 📓 错题复习 CTAs + 3 stat cards.

- [ ] **Step 1: Read mockup + 3 source files.**
- [ ] **Step 2: Apply patterns to each.**
  - GrammarHub outer → `page-section`.
  - Header + h1 → P-Headline.
  - 3 stat cards: stat-card style.
  - 3 main CTAs (薄弱点专练 / 随机混合 / 错题复习): P-Card with pastel.
  - CategoryCards (one per category): each is a P-Card with rotating pastel based on category index. Inside, TopicChip components render as P-Pill-Tag with hover:bg-ink/5.
  - TopicChip: `pill-tag bg-white border-2 border-ink/10 hover:border-ink`.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle grammar hub + category card + topic chip`

---

## Phase 9 — Diagnose extras (5 tasks)

### Task 9.1: Diagnose report

**Files:**
- Modify: `apps/web/src/components/diagnose/DiagnoseReport.tsx`
- Modify: `apps/web/src/components/diagnose/KnowledgePointCluster.tsx`
- Confirm: `apps/web/src/components/diagnose/ScoreRing.tsx` (verify whether it exists or is inline; either way, restyle as part of this task).

**Mockup:** `#diag-report`. Real layout: hero with overall score ring + 6 per-section score cards + 4-field summary + N knowledge-point clusters (count is dynamic).

- [ ] **Step 1: Read mockup + 2-3 source files.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section`.
  - Header banner: P-Card with lavender→sky gradient + AI badge + KET/PET pill + P-Headline.
  - ScoreRing: keep the SVG ring; recolor strokes to `var(--color-ink)` and `var(--color-mist)`. Add a label "综合得分" below.
  - 6 per-section score cards: stat-card with `tile-{color}` per skill (P-Skill-Color mapping), score in `text-3xl font-extrabold`.
  - 4-field summary card: P-Card containing 4 sub-cards in 2x2 grid; each sub-card is `tile-mint` (优势) / `tile-peach` (薄弱点) / `tile-butter` (重点练习方向) / `tile-lavender` (综合评语), with the LABEL using the real wording from i18n.
  - KnowledgePointCluster: each a P-Card with severity pill (`bg-rose-600 text-white` for 严重, `bg-amber-600 text-white` for 中等, `bg-mint border-ink/15` for 轻微), category chip (`pill-tag bg-{tile-color}-tint` with mapping by category), knowledge_point name in `text-xl font-extrabold`. Mini-lesson, rule (italic), example list (real, dynamic), collapsible per-question expansion.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle diagnose report + knowledge point cluster + score ring`

### Task 9.2: Diagnose history

**Files:**
- Modify: `apps/web/src/app/diagnose/history/page.tsx`
- Modify: `apps/web/src/components/diagnose/HistoryList.tsx`

**Mockup:** `#diag-history`. Real layout: page title + 12-week list of weekly entries.

- [ ] **Step 1: Read mockup + 2 source files.**
- [ ] **Step 2: Apply patterns.**
  - Outer → `page-section`.
  - Header → site-header.
  - h1 → P-Headline (marker on "历史").
  - HistoryList rows: each row is `rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card flex items-center justify-between gap-4`. Inside: examType pill, week range chip, status pill (P-Status-Pill), score chip, view link.
  - Empty state: keep existing copy but restyle container.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle diagnose history list`

### Task 9.3: Diagnose history detail

**Files:** Modify `apps/web/src/app/diagnose/history/[testId]/page.tsx`

**Mockup:** `#diag-history-detail`. Real layout: reuses DiagnoseReport in read-only mode.

Restyle the wrapper page (banner saying "历史报告") + verify DiagnoseReport from Task 9.1 renders correctly. Commit: `feat(ui): restyle diagnose history detail`.

### Task 9.4: Diagnose replay

**Files:** Modify `apps/web/src/app/diagnose/replay/[testId]/[section]/page.tsx`

**Mockup:** `#diag-replay`. Real layout: amber pill "重做练习 · 不计分" banner + wrapped Replay*Section in readOnly mode.

Restyle the banner + ensure inner runner uses locked-height patterns from Phase 6. Commit: `feat(ui): restyle diagnose replay`.

### Task 9.5: Diagnose section runner

**Files:** Modify `apps/web/src/app/diagnose/runner/[section]/page.tsx`

**Mockup:** `#diag-section-runner`. Real layout: small banner "本周诊断 · 阅读" + wrapped DiagnoseRunner*Section.

Restyle the banner. The inner runner is the same component used in non-diagnose flows (which gets restyled in Phase 6). Verify the banner does not interfere with locked-height. Commit: `feat(ui): restyle diagnose section runner banner`.

---

## Phase 10 — Library (3 tasks)

### Task 10.1: History

**Files:**
- Modify: `apps/web/src/app/history/page.tsx`
- Modify: `apps/web/src/app/history/FiltersBar.tsx`

**Mockup:** `#history`. Real layout: 4 native `<select>` dropdowns + attempt rows.

- [ ] **Step 1–2:** Apply patterns. Restyle `<select>` to look pill-shaped: `rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold cursor-pointer focus:border-ink outline-none transition`. Wrap in a flex row with proper gap. Attempt rows: P-Card.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle history page + filter bar`

### Task 10.2: History mistakes

**Files:** Modify `apps/web/src/app/history/mistakes/page.tsx`

**Mockup:** `#history-mistakes`. Real layout: chip filters (全部 / 新错题 / 已复习 / 已掌握) + kind chips (全部题型 / 阅读 / 写作 / 听力) + mistake cards.

Restyle pills + cards. Commit: `feat(ui): restyle history mistakes page`.

### Task 10.3: Classes (student)

**Files:**
- Modify: `apps/web/src/app/classes/page.tsx`
- Modify: `apps/web/src/components/classes/JoinForm.tsx`

**Mockup:** `#classes`. Real layout: page title + 3 quick-jump chips + JoinForm + class membership list.

Apply patterns. JoinForm input: P-Input. Submit: P-Button-Primary. Commit: `feat(ui): restyle classes page + join form`.

---

## Phase 11 — Teacher pages (7 tasks)

### Task 11.1: Teacher classes index

**Files:** Modify `apps/web/src/app/teacher/classes/page.tsx`

**Mockup:** `#teacher-classes`. Real label is "+ 创建班级" (NOT 新建).

- [ ] **Step 1–2:** Apply patterns. Class cards as P-Card with rotating pastel. "+ 创建班级" button: P-Button-Primary.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle teacher classes index`

### Task 11.2: Teacher class new

**Files:**
- Modify: `apps/web/src/app/teacher/classes/new/page.tsx`
- Modify: `apps/web/src/components/teacher/NewClassForm.tsx` (verify component path)

**Mockup:** `#teacher-class-new`. Form with 班级名称 / 考试重点 select.

Apply patterns: centered narrow card, P-Input, P-Button-Primary. Commit: `feat(ui): restyle teacher class new form`.

### Task 11.3: Teacher class detail

**Files:** Modify `apps/web/src/app/teacher/classes/[classId]/page.tsx` (this file is large — has 4 stat cards + 词汇练习概况 + 语法练习概况 + 作业 + 学生名单 + 最近活动 sections).

**Mockup:** `#teacher-class-detail`. All sections preserved.

- [ ] **Step 1–2:** Apply patterns to each section. 4 stat cards → stat-card with rotating pastel. 词汇/语法 概况 panels → P-Card with bars (`bg-mist` outer, `bg-ink` fill). 作业 list → P-Card. 学生名单 → P-Card with student rows.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle teacher class detail (large page, multiple panels)`

### Task 11.4: Teacher assignment new

**Files:**
- Modify: `apps/web/src/app/teacher/classes/[classId]/assignments/new/page.tsx`
- Modify: `apps/web/src/components/teacher/NewAssignmentForm.tsx`

**Mockup:** `#teacher-assignment-new`. Form with 标题 / 说明 / 科目 (KET/PET) / 题型 (skill chips) / Part / 最低及格分 / 截止时间.

Apply patterns. Skill chips as `skill-tile` mini variant with the canonical color mapping. Commit: `feat(ui): restyle teacher assignment new form`.

### Task 11.5: Teacher student detail

**Files:**
- Modify: `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/page.tsx`
- Modify: `apps/web/src/components/teacher/AnalysisPanel.tsx`
- Modify: `apps/web/src/components/teacher/ScoreTrend.tsx`
- Modify: `apps/web/src/components/teacher/CommentPanel.tsx`

**Mockup:** `#teacher-student-detail`. ALL 11 panels preserved (AnalysisPanel, 4 stat cards, ScoreTrend, 按科目×题型分布, 写作四项, 口语分项, 听力分项, 词汇练习, 语法练习, 高频错误考点, 错题状态, 留言记录, 答卷记录).

This is the largest single page. Plan ~15-30 min.

- [ ] **Step 1–2:** Apply patterns to each panel. Use rotating pastels for distinction. Sparklines in 词汇/语法 panels: keep SVG, recolor strokes to `var(--color-mint)` and `var(--color-sky)`. CommentPanel form: P-Input + P-Button-Primary.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle teacher student detail (11 panels)`

### Task 11.6: Teacher attempt detail

**Files:** Modify `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]/page.tsx`

**Mockup:** `#teacher-attempt-detail`. Real layout includes branches per skill kind; SPEAKING branch has 4 RubricBars + 易错点 + TranscriptViewer.

- [ ] **Step 1–2:** Apply patterns. Header banner with student-context. Each per-skill branch reuses ResultView-style cards.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check (test with each skill type).
- [ ] **Step 6: Commit**: `feat(ui): restyle teacher attempt detail`

### Task 11.7: Teacher diagnose status

**Files:** Modify `apps/web/src/app/teacher/classes/[classId]/diagnose-status/page.tsx`

**Mockup:** `#teacher-diagnose-status`. Real layout: 6 STATUS_PILL roll-up cards + section legend + wide table with 6 colored circles per student.

- [ ] **Step 1–2:** Apply patterns. Roll-up cards as stat-card with status-mapped pastel. Legend uses pill-tag. Per-student-row circles: keep SECTION_PILL letters (—/中/提/自/评), color-mapped via P-Status-Pill.
- [ ] **Step 3–5:** verify + tsc + eslint + visual check.
- [ ] **Step 6: Commit**: `feat(ui): restyle teacher diagnose status`

---

## Phase 12 — Final QA + PR

### Task 12.1: Run full type-check + lint + Vitest

- [ ] **Step 1: TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: ESLint on all modified files**

```bash
git diff --name-only main...HEAD -- 'apps/web/src/**/*.{ts,tsx}' | xargs -r pnpm exec eslint
```

Expected: exit 0.

- [ ] **Step 3: Vitest**

```bash
pnpm exec vitest run
```

Expected: all tests pass. Compare to baseline pass count from Task 0.1 step 4.

### Task 12.2: Visual smoke test on 8 anchor pages

- [ ] **Step 1: Boot dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Visit each anchor page and confirm visuals match mockup**

| URL | Mockup section to compare |
|---|---|
| http://localhost:3000/login | `#login` |
| http://localhost:3000/ | `#home-out` (logged-out) and `#home-in` (after login) |
| http://localhost:3000/ket | `#kethub` |
| http://localhost:3000/diagnose | `#diaghub` |
| (any reading attempt) | `#reader` — VERIFY column scroll works |
| (any writing attempt) | `#writing-runner` |
| http://localhost:3000/diagnose/report/<id> | `#diag-report` |
| http://localhost:3000/teacher/classes/<id> | `#teacher-class-detail` |

For each: page renders, fonts load, marker highlights present, hover states work, status pills correctly colored, runners DON'T page-scroll.

- [ ] **Step 3: Stop dev server.**

### Task 12.3: Mobile responsive check

- [ ] **Step 1: Open DevTools mobile emulation.** Test 390×844 (iPhone 12 viewport).

Visit the 8 anchor pages above. Confirm:
- Tile grids collapse to 1-col or 2-col gracefully.
- Site header wraps without overflow.
- Runners use full viewport height.
- Hit targets remain ≥44px.

### Task 12.4: 100dvh quirks on iOS Safari

- [ ] **Step 1: Verify Safari iOS handling**

Open DevTools mobile emulation → iOS Safari user-agent. Visit `/ket/reading/runner/<id>`. Confirm runner doesn't have a phantom blank strip below the fold (this happens with `100vh` because Safari doesn't subtract browser chrome).

If you see a blank strip, the `.page-section.locked-height` rule in globals.css may need a tweak (it already uses `100dvh`).

### Task 12.5: Manrope self-host verification

- [ ] **Step 1: Verify Manrope is served from origin, not Google Fonts CDN**

```bash
pnpm dev
# In a fresh browser, open DevTools Network tab, visit /ket
# Filter by "manrope" or "font"
```

Expected: Manrope font requests go to `localhost:3000/_next/static/media/...` (self-hosted), NOT `fonts.googleapis.com`. This confirms `next/font/google` did its self-hosting transform.

### Task 12.6: Push branch + open PR

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin design/ui-redesign-pastel
```

- [ ] **Step 2: Open PR**

Use `gh` to create:

```bash
gh pr create --title "feat(ui): Variant A pastel/highlighter redesign — 40 routes ported" --body "$(cat <<'EOF'
## Summary

Port the approved Variant A pastel/yellow-highlighter design language from `design-preview/preview.html` into apps/web. Visual restyle only — no JSX structural changes, no new features.

- Foundation: Manrope (self-hosted via next/font/google) + design tokens + custom CSS classes in globals.css
- 40 routes restyled across 12 phases (auth, hubs, skill picker, runners, results, vocab/grammar, diagnose, library, teacher)
- Spec: docs/superpowers/specs/2026-04-27-ui-redesign-design.md
- Mockups: design-preview/preview.html (canonical visual contract)
- Audits: 2026-04-27-mockup-codebase-audit-full.md (drove the rebuild)

## Test plan

- [x] `pnpm exec tsc --noEmit` exits 0
- [x] `pnpm exec eslint <changed-files>` exits 0
- [x] `pnpm exec vitest run` all green (baseline preserved)
- [x] 8 anchor pages visually match the mockup
- [x] Runner column-scroll behavior verified
- [x] Mobile responsive (390×844) checked
- [x] iOS Safari 100dvh quirks checked
- [x] Manrope self-hosted (no Google Fonts CDN dependency)
- [x] No JSX structural changes (verified by `git diff` — only className + import + font lines)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Capture PR URL** for the user.

---

## Self-Review

### Spec coverage
- §3.1 Color palette ✓ Task 1.2 declares all CSS variables
- §3.2 Typography ✓ Task 1.1 (Manrope) + globals.css `html { font-size: 17px }`
- §3.3 Components ✓ Task 1.2 declares all custom classes
- §3.4 Skill ↔ color mapping ✓ Pattern Library P-Skill-Color, applied in tasks 3.2/3.3/all runners
- §4 Layout rules ✓ Pattern Library P-Locked-Height + section/grid CSS in 1.2; runner-by-runner verification in Phase 6
- §5 41 page archetypes ✓ Phases 2–11 cover them
- §6 Implementation approach ✓ Phase 0 worktree + Phase 1 foundation + per-route phases
- §7 Out of scope ✓ Verification step in every task confirms diff is className-only
- §8 Risks ✓ Risk #2 (Manrope CDN) → Task 1.1; Risk #3 (100dvh) → Task 12.4 + globals.css uses dvh; Risk #6 (devs sneaking in JSX) → diff verification in every task
- §9 Acceptance criteria ✓ Tasks 12.1–12.6

### Placeholder scan
- No "TBD"/"TODO"/"implement later" in any step.
- No "similar to Task N" — each task spells out file paths + patterns.
- Patterns are defined ONCE in the Pattern Library and referenced by short name (P-Card, P-Input, etc.). Each pattern has a complete diff example.
- File paths are exact in every task.
- Verification commands are concrete with expected output.

### Type consistency
- Pattern names (P-Card, P-Headline, P-Button-Primary, P-Button-Secondary, P-Input, P-Pill-Tag, P-Status-Pill, P-Site-Header, P-Skill-Color, P-Subtitle, P-Locked-Height) are referenced consistently across all tasks.
- CSS class names (`.skill-tile`, `.tile-{color}`, `.pill-tag`, `.stitched-card`, etc.) match between Task 1.2 (where they're defined) and the per-route tasks (where they're used).
- File paths match between adjacent tasks (e.g., the speaking sub-components in Task 6.4 are the same file paths used implicitly when restyling Task 5.4 speaking-new).

### Issues found and fixed
- Initial draft used `100vh` in the locked-height pattern; updated to `100dvh` in globals.css per spec §8 risk #3 + Task 12.4 mentions verification.
- Initial draft did not specify exact diff for the SiteHeader logo block addition (the K square logo is new — but it matches the mockup which is the visual contract). Updated Task 2.1 step 2 with explicit Edit blocks.
- Phase 6 runner tasks initially didn't all reference P-Locked-Height; added it to all 7 task descriptions.

---

*Plan complete. Save as the spec → plan handoff document. Implementation begins with Phase 0 Task 0.1.*
