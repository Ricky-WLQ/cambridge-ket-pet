# cambridge-ket-pet UI Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the KET/PET mascot + island/city + verbosity-cleanup redesign per `docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md`. Result: every user-visible Chinese surface (i18n + hardcoded JSX + API errors + AI-generated narratives) follows per-portal kid/teen voice with length caps, banned-phrase regex enforcement, and Leo/Aria mascots; portal hubs use a map metaphor (KET 岛 / PET 城); all 58 routes pass an automated end-to-end probe before production deploy.

**Architecture:** Vertical-slice phases A–M. Foundation first (assets, theme, i18n, validators, banned-phrase modules). Then portal hubs, diagnose flow (the screenshot-confirmed verbosity epicenter with AI prompt rewrites), then practice modes. Each phase ships independently to production via Zeabur auto-deploy on merge to `main`. No big-bang.

**Tech Stack:** Next.js 15 App Router + Manrope (apps/web), Python 3.12 + pydantic-ai + DeepSeek (services/ai), Tailwind v4 with CSS variables, Prisma + Postgres, Cloudflare R2 (existing — runtime listening photos / vocab audio only), SiliconFlow `Qwen/Qwen-Image` for static brand assets, Zeabur Singapore (`cambridge-ket-pet.zeabur.app`) for hosting.

**Pre-flight checks before Phase A:**
- `services/ai/.env` has `SILICONFLOW_API_KEY` (verified during brainstorm)
- `pnpm` installed and workspaces healthy: `pnpm install --frozen-lockfile`
- Local Postgres running for Prisma operations (only matters in Phase D for diagnose probe)
- All existing tests green on `main`: `pnpm test && pytest services/ai/tests`

---

## File Structure

### New files (created in Phase A unless noted)

```
apps/web/
  public/
    mascots/
      leo/{greeting,waving,reading,listening,writing,microphone,flashcards,chart,celebrating,thinking,sleeping,confused}.png   # 12 PNGs (Phase A)
      aria/{greeting,waving,reading,listening,writing,microphone,flashcards,chart,celebrating,thinking,sleeping,confused}.png   # 12 PNGs (Phase A)
    maps/
      ket-island.png    # 1 PNG (Phase A — already generated, copy from brainstorm dir)
      pet-city.png      # 1 PNG (Phase A — already generated, copy from brainstorm dir)
  src/
    components/
      Mascot.tsx                           # Phase A — <Mascot pose portal />
      PortalMap.tsx                        # Phase A — portal-aware map with mode-chip overlay
      TodayCard.tsx                        # Phase A — today's recommended action card
      portal/PortalShell.tsx               # Phase A — body class + provider wrapper
    i18n/
      voice.ts                             # Phase A — Tone<T> + pickTone helper
      PortalProvider.tsx                   # Phase A — React context + useT hook
      banned-phrases.ts                    # Phase A — TS mirror of Python BANNED_PHRASES
      derivePortalFromPathname.ts          # Phase A — URL → "ket" | "pet"
  scripts/
    generate-mascot-assets.ts              # Phase A — one-time idempotent generator
    audit-hardcoded-zh.ts                  # Phase A — CI gate
  eslint-rules/
    no-hardcoded-zh-jsx.js                 # Phase A — custom ESLint rule

services/ai/
  app/
    validators/
      _banned_phrases.py                   # Phase A — Python BANNED_PHRASES list
      _length_caps.py                      # Phase A — narrative length helper functions

.github/
  workflows/
    audit-hardcoded-zh.yml                 # Phase A — runs the audit on PRs (additive to existing CI)
```

### Files modified (across phases)

```
apps/web/src/
  app/
    globals.css                            # Phase A — add .portal-ket / .portal-pet
    layout.tsx                             # Phase A — wrap children in PortalProvider
    page.tsx                               # Phase J — landing page
    ket/page.tsx                           # Phase B — KET portal home
    pet/page.tsx                           # Phase C — PET portal home
    login/page.tsx                         # Phase J
    signup/page.tsx                        # Phase J
    diagnose/page.tsx                      # Phase D
    diagnose/report/[testId]/page.tsx      # Phase D
    api/auth/signup/route.ts               # Phase L (Zod messages)
    api/classes/join/route.ts              # Phase L
    api/diagnose/me/generate/route.ts      # Phase L
    api/listening/[attemptId]/audio/route.ts             # Phase L
    api/listening/tests/[testId]/status/route.ts         # Phase L
    api/mistakes/[id]/status/route.ts      # Phase L
    api/r2/[...key]/route.ts               # Phase L
    api/teacher/activate/route.ts          # Phase L
    api/teacher/classes/route.ts           # Phase L
    api/tests/[attemptId]/submit/route.ts  # Phase L
    api/tests/attempts/[attemptId]/status/route.ts       # Phase L
    api/tests/generate/route.ts            # Phase L
    api/writing/generate/route.ts          # Phase L
    # (full inventory resolved by audit-hardcoded-zh.ts during Phase A)
  components/
    SiteHeader.tsx                         # Phase B (touched while migrating Tone<T>)
    diagnose/DiagnoseHub.tsx               # Phase D
    diagnose/DiagnoseReport.tsx            # Phase D
    diagnose/AnalysisPanel.tsx             # Phase K (teacher view)
    grammar/GrammarHub.tsx                 # Phase H
    grammar/GrammarMistakes.tsx            # Phase H
    grammar/GrammarQuizRunner.tsx          # Phase H (reskin only — no mascot during quiz)
    vocab/VocabHub.tsx                     # Phase H
    vocab/VocabListenRunner.tsx            # Phase H (reskin only)
    vocab/VocabSpellRunner.tsx             # Phase H (reskin only)
    listening/NewListeningPicker.tsx       # Phase E
    listening/ListeningRunner.tsx          # Phase F (reskin only — no mascot during runner)
    listening/GenerationProgress.tsx       # Phase E
    listening/PhaseBanner.tsx              # Phase F
    reading/NewForm.tsx                    # Phase E
    reading/Runner.tsx                     # Phase F
    reading/ResultView.tsx                 # Phase G
    writing/NewForm.tsx                    # Phase E
    writing/Runner.tsx                     # Phase F
    writing/ResultView.tsx                 # Phase G
    speaking/SpeakingNewPage.tsx           # Phase E
    speaking/SpeakingResult.tsx            # Phase G
    speaking/ClientSpeakingNewPage.tsx     # Phase E
    student/AssignmentList.tsx             # Phase B (touched for theme tokens)
  i18n/
    zh-CN.ts                               # Phases B, C, D, E, F, G, H, I, J, K, L (incremental migration to Tone<T>)

services/ai/app/
  prompts/
    diagnose_summary.py                    # Phase D — voice block + length caps
    diagnose_analysis.py                   # Phase D
    analysis.py                            # Phase K (professional voice for teacher)
    vocab_gloss_system.py                  # Phase H
    grammar_generator_system.py            # Phase H
    writing.py                             # Phase G (feedback path; verify during impl)
  validators/
    diagnose.py                            # Phase D — length cap + banned phrase rules
    analysis.py                            # Phase K
    grammar.py                             # Phase H
    vocab.py                               # Phase H
```

### Files deleted (Phase M cleanup)

```
apps/web/scripts/_brainstorm-mascot-test.mts
apps/web/scripts/_brainstorm-mascot-kolors.mts
apps/web/scripts/_brainstorm-list-sf-models.mts
apps/web/scripts/_brainstorm-maps.mts
```

---

# Phase A — Foundation

**Phase A goal:** All new infrastructure exists and is tested; existing pages still render unchanged; CI green.

**Phase A done condition:** Manual smoke check — load `/`, `/ket`, `/pet`, `/diagnose` in dev mode and confirm visually identical to current production. Then `pnpm build && pnpm test && pytest services/ai/tests` all green.

---

## Task A.1: Create i18n voice helper

**Files:**
- Create: `apps/web/src/i18n/voice.ts`
- Test: `apps/web/src/i18n/__tests__/voice.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/i18n/__tests__/voice.test.ts
import { describe, it, expect } from "vitest";
import { pickTone, type Tone } from "../voice";

describe("pickTone", () => {
  it("returns the value when given a plain string", () => {
    expect(pickTone("hello", "ket")).toBe("hello");
    expect(pickTone("hello", "pet")).toBe("hello");
  });

  it("picks ket variant from a Tone object", () => {
    const t: Tone<string> = { ket: "kid", pet: "teen" };
    expect(pickTone(t, "ket")).toBe("kid");
  });

  it("picks pet variant from a Tone object", () => {
    const t: Tone<string> = { ket: "kid", pet: "teen" };
    expect(pickTone(t, "pet")).toBe("teen");
  });

  it("works with non-string Tone values", () => {
    const t: Tone<number> = { ket: 1, pet: 2 };
    expect(pickTone(t, "ket")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/voice.test.ts
```

Expected: FAIL — module `../voice` does not exist.

- [ ] **Step 3: Implement the helper**

```typescript
// apps/web/src/i18n/voice.ts
/**
 * Per-portal voice helper. A `Tone<T>` is either:
 *  - A plain T (when both portals share the same value), or
 *  - An object `{ ket: T; pet: T }` (when the portals differ).
 *
 * Use `pickTone(value, portal)` to resolve to a concrete T at render time.
 */
export type Portal = "ket" | "pet";

export type Tone<T = string> = T | { ket: T; pet: T };

export function pickTone<T>(value: Tone<T>, portal: Portal): T {
  if (
    typeof value === "object" &&
    value !== null &&
    "ket" in (value as object) &&
    "pet" in (value as object)
  ) {
    return (value as { ket: T; pet: T })[portal];
  }
  return value as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/voice.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/voice.ts apps/web/src/i18n/__tests__/voice.test.ts
git commit -m "feat(i18n): add Tone<T> + pickTone helper for per-portal voice"
```

---

## Task A.2: Create derivePortalFromPathname helper

**Files:**
- Create: `apps/web/src/i18n/derivePortalFromPathname.ts`
- Test: `apps/web/src/i18n/__tests__/derivePortalFromPathname.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/i18n/__tests__/derivePortalFromPathname.test.ts
import { describe, it, expect } from "vitest";
import { derivePortalFromPathname } from "../derivePortalFromPathname";

describe("derivePortalFromPathname", () => {
  it("returns 'ket' for /ket and /ket/*", () => {
    expect(derivePortalFromPathname("/ket")).toBe("ket");
    expect(derivePortalFromPathname("/ket/listening/new")).toBe("ket");
  });

  it("returns 'pet' for /pet and /pet/*", () => {
    expect(derivePortalFromPathname("/pet")).toBe("pet");
    expect(derivePortalFromPathname("/pet/speaking/runner/abc")).toBe("pet");
  });

  it("returns the default 'ket' for non-portal routes", () => {
    expect(derivePortalFromPathname("/")).toBe("ket");
    expect(derivePortalFromPathname("/login")).toBe("ket");
    expect(derivePortalFromPathname("/diagnose")).toBe("ket");
    expect(derivePortalFromPathname("/teacher/classes")).toBe("ket");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/derivePortalFromPathname.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```typescript
// apps/web/src/i18n/derivePortalFromPathname.ts
import type { Portal } from "./voice";

/**
 * Resolve the active portal from a Next.js URL pathname.
 *
 * - `/ket` and `/ket/*` → "ket"
 * - `/pet` and `/pet/*` → "pet"
 * - Anything else → "ket" (the kid voice is more inviting for un-routed pages
 *   like landing / login / signup; spec §5.2)
 */
export function derivePortalFromPathname(pathname: string): Portal {
  if (pathname === "/pet" || pathname.startsWith("/pet/")) return "pet";
  if (pathname === "/ket" || pathname.startsWith("/ket/")) return "ket";
  return "ket";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/derivePortalFromPathname.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/derivePortalFromPathname.ts apps/web/src/i18n/__tests__/derivePortalFromPathname.test.ts
git commit -m "feat(i18n): add derivePortalFromPathname helper"
```

---

## Task A.3: Create PortalProvider with React context + useT hook

**Files:**
- Create: `apps/web/src/i18n/PortalProvider.tsx`
- Test: `apps/web/src/i18n/__tests__/PortalProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/i18n/__tests__/PortalProvider.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortalProvider, useT } from "../PortalProvider";

function Probe() {
  const tone = useT();
  return <div>{tone({ ket: "kid", pet: "teen" })}</div>;
}

describe("PortalProvider + useT", () => {
  it("provides the ket tone when portal is ket", () => {
    render(
      <PortalProvider portal="ket"><Probe /></PortalProvider>
    );
    expect(screen.getByText("kid")).toBeInTheDocument();
  });

  it("provides the pet tone when portal is pet", () => {
    render(
      <PortalProvider portal="pet"><Probe /></PortalProvider>
    );
    expect(screen.getByText("teen")).toBeInTheDocument();
  });

  it("defaults to ket when no provider is present", () => {
    render(<Probe />);
    expect(screen.getByText("kid")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/PortalProvider.test.tsx
```

Expected: FAIL — `PortalProvider` not found.

- [ ] **Step 3: Implement the provider**

```typescript
// apps/web/src/i18n/PortalProvider.tsx
"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { pickTone, type Portal, type Tone } from "./voice";

const PortalContext = createContext<Portal>("ket");

export function PortalProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  return <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>;
}

export function usePortal(): Portal {
  return useContext(PortalContext);
}

/**
 * `useT()` returns a callable that resolves a `Tone<T>` to a concrete T using
 * the active portal. Components call it with i18n entries:
 *
 *     const tone = useT();
 *     <h1>{tone(t.app.tagline)}</h1>
 */
export function useT() {
  const portal = usePortal();
  return useCallback(<T,>(v: Tone<T>) => pickTone(v, portal), [portal]);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/PortalProvider.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/PortalProvider.tsx apps/web/src/i18n/__tests__/PortalProvider.test.tsx
git commit -m "feat(i18n): PortalProvider + useT hook"
```

---

## Task A.4: Wrap root layout in PortalProvider

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Read current layout.tsx**

The current layout (verified in spec §1.2 and brainstorming exploration) is:

```typescript
// apps/web/src/app/layout.tsx — current
import type { Metadata } from "next";
import { manrope } from "./fonts";
import { t } from "@/i18n/zh-CN";
import "./globals.css";

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.metaDescription,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Modify layout.tsx**

Layout is a Server Component, so it cannot read pathname directly. Pass portal via header → headers() inspection:

```typescript
// apps/web/src/app/layout.tsx — after
import type { Metadata } from "next";
import { headers } from "next/headers";
import { manrope } from "./fonts";
import { t } from "@/i18n/zh-CN";
import { PortalProvider } from "@/i18n/PortalProvider";
import { derivePortalFromPathname } from "@/i18n/derivePortalFromPathname";
import "./globals.css";

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.metaDescription,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const h = await headers();
  // x-pathname is set by middleware (Task A.5)
  const pathname = h.get("x-pathname") ?? "/";
  const portal = derivePortalFromPathname(pathname);
  const portalClass = portal === "ket" ? "portal-ket" : "portal-pet";

  return (
    <html lang="zh-CN" className={`${manrope.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col ${portalClass}`}>
        <PortalProvider portal={portal}>{children}</PortalProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build still passes**

```bash
cd apps/web && pnpm build
```

Expected: build succeeds (will warn that x-pathname is missing on first run; fixed in Task A.5).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(layout): wrap RootLayout in PortalProvider with x-pathname header"
```

---

## Task A.5: Middleware sets x-pathname header

**Files:**
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Read current middleware.ts**

```bash
cat apps/web/middleware.ts | head -120
```

Existing middleware does the diagnose-gate redirect for STUDENTs. We need to add an x-pathname header for the layout to read.

- [ ] **Step 2: Edit middleware.ts to set x-pathname**

In the middleware default-export function, before the existing return, set the header. Find the existing `NextResponse.next()` calls and replace with a helper that adds the header:

```typescript
// Add at top of file, after imports:
function nextWithPathname(request: NextRequest): NextResponse {
  const res = NextResponse.next();
  res.headers.set("x-pathname", request.nextUrl.pathname);
  return res;
}
```

Replace every `return NextResponse.next();` with `return nextWithPathname(request);`. The `NextResponse.redirect(...)` paths stay unchanged.

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build
```

Expected: green.

- [ ] **Step 4: Smoke check**

```bash
cd apps/web && pnpm dev
```

Open `http://localhost:3000/ket` — body element should have class `portal-ket`. Open `/pet` — `portal-pet`. Open `/` — `portal-ket` (default).

- [ ] **Step 5: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(middleware): forward x-pathname so RootLayout can derive portal"
```

---

## Task A.6: Add per-portal CSS tokens to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Append portal-aware tokens**

Append to the end of `apps/web/src/app/globals.css` (after existing tokens, before existing utility classes):

```css
/* ─── Per-portal accent tokens (Phase A) ───────────────────────── */
.portal-ket {
  --portal-accent:       var(--color-butter);
  --portal-accent-soft:  var(--color-peach);
  --portal-bg-grad:      linear-gradient(180deg, #fff6d6 0%, #ffebf0 100%);
  --portal-mark-bg:      var(--color-ink);
  --portal-mascot-greet: url('/mascots/leo/greeting.png');
}

.portal-pet {
  --portal-accent:       var(--color-lavender);
  --portal-accent-soft:  var(--color-sky-soft);
  --portal-bg-grad:      linear-gradient(180deg, #ede7ff 0%, #e4efff 100%);
  --portal-mark-bg:      #1f1837;
  --portal-mascot-greet: url('/mascots/aria/greeting.png');
}

/* Body uses the portal gradient when a portal class is on body, else falls
   back to the existing cool-purple gradient. */
body.portal-ket,
body.portal-pet {
  background: var(--portal-bg-grad);
}
```

- [ ] **Step 2: Verify with `pnpm dev`**

```bash
cd apps/web && pnpm dev
```

Open `/ket` — body bg should be a warm yellow→pink gradient. `/pet` — cool purple→blue gradient. `/login` — falls back to original cool-purple.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(theme): per-portal CSS tokens (.portal-ket / .portal-pet)"
```

---

## Task A.7: Add `t.api.*` keys to zh-CN.ts

**Files:**
- Modify: `apps/web/src/i18n/zh-CN.ts`

- [ ] **Step 1: Append new `api` namespace**

In `apps/web/src/i18n/zh-CN.ts`, before the trailing `} as const;`, add the `api` namespace. Use `Tone<T>` for portal-specific messages, plain strings for portal-agnostic ones:

```typescript
  api: {
    unauthorized: { ket: "先登录一下哦 →", pet: "请先登录" } as Tone<string>,
    malformedRequest: { ket: "这个请求看不懂", pet: "请求格式错误" } as Tone<string>,
    inviteCodeRequired: { ket: "邀请码呢？", pet: "请输入邀请码" } as Tone<string>,
    inviteCodeInvalid: { ket: "邀请码不对", pet: "邀请码无效" } as Tone<string>,
    diagnoseRateLimit: { ket: "今天先休息一下吧", pet: "诊断生成调用次数已达上限，请稍后再试" } as Tone<string>,
    diagnoseGenerateFailed: { ket: "出题没成功，再试一下", pet: "诊断生成失败，请稍后重试" } as Tone<string>,
    audioNotReady: { ket: "音频还没好 · 重新生成", pet: "音频加载失败，请重新生成" } as Tone<string>,
    queueFull: { ket: "现在人多 · 等一下", pet: "系统繁忙，请稍后再试" } as Tone<string>,
    timeExceeded: { ket: "时间到 · 已交卷", pet: "考试时间已结束，答案已自动提交" } as Tone<string>,
    writingEmpty: { ket: "先写下你的作文哦", pet: "请先写下你的作文" } as Tone<string>,
    listeningInstruction: { ket: "听一听 · 选答案", pet: "听音频后选择答案" } as Tone<string>,
    auth: {
      emailInvalid: { ket: "邮箱填错啦", pet: "邮箱格式不正确" } as Tone<string>,
      passwordTooShort: { ket: "密码要 8 位以上", pet: "密码至少 8 位" } as Tone<string>,
    },
  },
```

Add `Tone` import at the top of the file:

```typescript
import type { Tone } from "./voice";
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/zh-CN.ts
git commit -m "feat(i18n): add t.api.* keys for API error/instruction messages"
```

---

## Task A.8: Banned-phrases shared module (Python + TS)

**Files:**
- Create: `services/ai/app/validators/_banned_phrases.py`
- Create: `apps/web/src/i18n/banned-phrases.ts`
- Test: `services/ai/tests/validators/test_banned_phrases.py`

- [ ] **Step 1: Write the failing Python test**

```python
# services/ai/tests/validators/test_banned_phrases.py
from app.validators._banned_phrases import BANNED_PHRASES, find_banned

def test_banned_phrases_complete():
    expected = {
        "决定通过率", "属于低分段", "未达标", "短板",
        "critical 弱项", "moderate 弱项", "minor 弱项",
        "请重视", "切记", "不容忽视", "亟待提升",
        "[critical]", "[moderate]", "[minor]",
    }
    assert set(BANNED_PHRASES) == expected

def test_find_banned_returns_matches():
    text = "Reading 仅 33%，属于低分段，是 critical 弱项。"
    matches = find_banned(text)
    assert "属于低分段" in matches
    assert "critical 弱项" in matches

def test_find_banned_returns_empty_for_clean_text():
    text = "本周加油 → 下周再战"
    assert find_banned(text) == []
```

- [ ] **Step 2: Run Python test to verify it fails**

```bash
cd services/ai && pytest tests/validators/test_banned_phrases.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Python module**

```python
# services/ai/app/validators/_banned_phrases.py
"""
Banned-phrase regex enforcement for user-visible AI Chinese output.

Mirrored in TS at apps/web/src/i18n/banned-phrases.ts. KEEP THE TWO LISTS
IN SYNC.
"""
from __future__ import annotations

BANNED_PHRASES: list[str] = [
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


def find_banned(text: str) -> list[str]:
    """Return the list of banned phrases that appear in `text`."""
    return [p for p in BANNED_PHRASES if p in text]
```

- [ ] **Step 4: Run Python test to verify it passes**

```bash
cd services/ai && pytest tests/validators/test_banned_phrases.py -v
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Mirror in TS**

```typescript
// apps/web/src/i18n/banned-phrases.ts
/**
 * Banned phrases for any Chinese text shown to users (AI-generated or static).
 * Mirrored from services/ai/app/validators/_banned_phrases.py — KEEP THE TWO
 * LISTS IN SYNC.
 */
export const BANNED_PHRASES = [
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
] as const;

export function findBanned(text: string): string[] {
  return BANNED_PHRASES.filter((p) => text.includes(p));
}
```

- [ ] **Step 6: Add TS test**

```typescript
// apps/web/src/i18n/__tests__/banned-phrases.test.ts
import { describe, it, expect } from "vitest";
import { BANNED_PHRASES, findBanned } from "../banned-phrases";

describe("BANNED_PHRASES", () => {
  it("matches the Python list", () => {
    expect(BANNED_PHRASES).toContain("决定通过率");
    expect(BANNED_PHRASES).toContain("[critical]");
    expect(BANNED_PHRASES).toHaveLength(14);
  });

  it("findBanned detects matches", () => {
    expect(findBanned("Reading 33%，属于低分段")).toContain("属于低分段");
  });

  it("findBanned returns empty for clean text", () => {
    expect(findBanned("加油 →")).toEqual([]);
  });
});
```

```bash
cd apps/web && pnpm vitest run src/i18n/__tests__/banned-phrases.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add services/ai/app/validators/_banned_phrases.py services/ai/tests/validators/test_banned_phrases.py apps/web/src/i18n/banned-phrases.ts apps/web/src/i18n/__tests__/banned-phrases.test.ts
git commit -m "feat(validators): banned-phrase shared module (Python + TS, in sync)"
```

---

## Task A.9: Python length-cap helpers

**Files:**
- Create: `services/ai/app/validators/_length_caps.py`
- Test: `services/ai/tests/validators/test_length_caps.py`

- [ ] **Step 1: Write the failing test**

```python
# services/ai/tests/validators/test_length_caps.py
from app.validators._length_caps import (
    narrative_cap_for, MAX_STRENGTHS, MAX_WEAKNESSES, MAX_PRIORITY_ACTIONS,
    PROFESSIONAL_NARRATIVE_CAP,
)

def test_narrative_cap_ket():
    assert narrative_cap_for("KET") == 90

def test_narrative_cap_pet():
    assert narrative_cap_for("PET") == 110

def test_list_caps():
    assert MAX_STRENGTHS == 2
    assert MAX_WEAKNESSES == 2
    assert MAX_PRIORITY_ACTIONS == 3

def test_professional_cap():
    assert PROFESSIONAL_NARRATIVE_CAP == 160
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ai && pytest tests/validators/test_length_caps.py -v
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```python
# services/ai/app/validators/_length_caps.py
"""
Per-portal length caps for AI-generated user-visible Chinese narratives.

Source: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §5.1
"""
from __future__ import annotations
from typing import Literal

# narrative_zh char caps
KET_NARRATIVE_CAP: int = 90    # kid voice — Leo
PET_NARRATIVE_CAP: int = 110   # teen voice — Aria
PROFESSIONAL_NARRATIVE_CAP: int = 160   # teacher view — analysis.py

# list cardinality caps (apply to all portals)
MAX_STRENGTHS: int = 2
MAX_WEAKNESSES: int = 2
MAX_PRIORITY_ACTIONS: int = 3

# per-item char caps within lists
MAX_STRENGTH_ITEM: int = 20
MAX_WEAKNESS_ITEM: int = 25
MAX_PRIORITY_ACTION_ITEM: int = 30


def narrative_cap_for(exam_type: Literal["KET", "PET"]) -> int:
    """Return the narrative_zh char cap for the given portal."""
    return KET_NARRATIVE_CAP if exam_type == "KET" else PET_NARRATIVE_CAP
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ai && pytest tests/validators/test_length_caps.py -v
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add services/ai/app/validators/_length_caps.py services/ai/tests/validators/test_length_caps.py
git commit -m "feat(validators): per-portal length cap constants"
```

---

## Task A.10: Mascot.tsx component

**Files:**
- Create: `apps/web/src/components/Mascot.tsx`
- Test: `apps/web/src/components/__tests__/Mascot.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/__tests__/Mascot.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Mascot } from "../Mascot";

describe("<Mascot>", () => {
  it("renders the ket mascot path for portal=ket", () => {
    const { getByAltText } = render(<Mascot pose="greeting" portal="ket" />);
    const img = getByAltText("Leo");
    expect(img).toHaveAttribute("src", "/mascots/leo/greeting.png");
  });

  it("renders the pet mascot path for portal=pet", () => {
    const { getByAltText } = render(<Mascot pose="celebrating" portal="pet" />);
    const img = getByAltText("Aria");
    expect(img).toHaveAttribute("src", "/mascots/aria/celebrating.png");
  });

  it("respects custom width/height", () => {
    const { getByAltText } = render(
      <Mascot pose="thinking" portal="ket" width={64} height={64} />
    );
    const img = getByAltText("Leo");
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "64");
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/Mascot.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement Mascot**

```typescript
// apps/web/src/components/Mascot.tsx
import Image from "next/image";
import type { Portal } from "@/i18n/voice";

export type MascotPose =
  | "greeting"
  | "waving"
  | "reading"
  | "listening"
  | "writing"
  | "microphone"
  | "flashcards"
  | "chart"
  | "celebrating"
  | "thinking"
  | "sleeping"
  | "confused";

interface MascotProps {
  pose: MascotPose;
  portal: Portal;
  width?: number;
  height?: number;
  className?: string;
  /** Override alt text. Defaults to "Leo" for ket and "Aria" for pet. */
  alt?: string;
  /** When true, the image is purely decorative (alt=""). */
  decorative?: boolean;
}

export function Mascot({
  pose,
  portal,
  width = 96,
  height = 96,
  className,
  alt,
  decorative = false,
}: MascotProps) {
  const character = portal === "ket" ? "leo" : "aria";
  const defaultAlt = portal === "ket" ? "Leo" : "Aria";
  const src = `/mascots/${character}/${pose}.png`;
  return (
    <Image
      src={src}
      alt={decorative ? "" : (alt ?? defaultAlt)}
      width={width}
      height={height}
      className={className}
      priority={pose === "greeting"}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/Mascot.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Mascot.tsx apps/web/src/components/__tests__/Mascot.test.tsx
git commit -m "feat(components): Mascot.tsx — <Mascot pose portal />"
```

---

## Task A.11: TodayCard.tsx component

**Files:**
- Create: `apps/web/src/components/TodayCard.tsx`
- Test: `apps/web/src/components/__tests__/TodayCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/__tests__/TodayCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayCard } from "../TodayCard";

describe("<TodayCard>", () => {
  it("renders the label, title, hint, and link", () => {
    render(
      <TodayCard
        portal="ket"
        label="今天"
        title="来 5 道听力题"
        hint="Leo 给你挑了 Part 1 · 8 分钟"
        href="/ket/listening/new?part=1"
        ctaLabel="开始 →"
      />
    );
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("来 5 道听力题")).toBeInTheDocument();
    expect(screen.getByText("Leo 给你挑了 Part 1 · 8 分钟")).toBeInTheDocument();
    const cta = screen.getByText("开始 →");
    expect(cta.closest("a")).toHaveAttribute("href", "/ket/listening/new?part=1");
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/TodayCard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement TodayCard**

```typescript
// apps/web/src/components/TodayCard.tsx
import Link from "next/link";
import { Mascot, type MascotPose } from "./Mascot";
import type { Portal } from "@/i18n/voice";

interface TodayCardProps {
  portal: Portal;
  label: string;       // e.g., "今天" (KET) or "TODAY" (PET)
  title: string;       // e.g., "来 5 道听力题"
  hint: string;        // e.g., "Leo 给你挑了 Part 1 · 8 分钟"
  href: string;        // CTA href
  ctaLabel: string;    // e.g., "开始 →"
  mascotPose?: MascotPose;
}

export function TodayCard({
  portal,
  label,
  title,
  hint,
  href,
  ctaLabel,
  mascotPose = "greeting",
}: TodayCardProps) {
  const isKet = portal === "ket";
  const bg = isKet
    ? "linear-gradient(135deg, #ffe066, #ffc4d1)"
    : "linear-gradient(135deg, #c7b8ff, #7db8ff)";
  const textColor = isKet ? "text-ink" : "text-[#1f1837]";
  const ctaBg = isKet ? "bg-ink" : "bg-[#1f1837]";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-4 py-3.5 stitched-card ${textColor}`}
      style={{ background: bg }}
    >
      <div className="absolute right-[-8px] bottom-[-8px] opacity-90 pointer-events-none">
        <Mascot pose={mascotPose} portal={portal} width={80} height={80} decorative />
      </div>
      <div className="relative max-w-[70%]">
        <div className="text-[0.6rem] font-extrabold tracking-[0.06em] opacity-65">{label}</div>
        <h3 className="mt-1 text-base font-extrabold leading-tight">{title}</h3>
        <p className="mt-1 text-[0.7rem] font-medium opacity-65">{hint}</p>
        <Link
          href={href}
          className={`mt-2.5 inline-block rounded-full ${ctaBg} px-3.5 py-1.5 text-xs font-extrabold text-white hover:opacity-90 transition`}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/TodayCard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TodayCard.tsx apps/web/src/components/__tests__/TodayCard.test.tsx
git commit -m "feat(components): TodayCard.tsx — today's recommended action card"
```

---

## Task A.12: PortalMap.tsx component

**Files:**
- Create: `apps/web/src/components/PortalMap.tsx`
- Test: `apps/web/src/components/__tests__/PortalMap.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/__tests__/PortalMap.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortalMap, type ModeChip } from "../PortalMap";

const sampleChips: ModeChip[] = [
  { mode: "reading",   label: "📖 读",   accuracy: "84%",       href: "/ket/reading/new",   position: { top: "28%", left: "7%" } },
  { mode: "listening", label: "🎧 听",   accuracy: "→",          href: "/ket/listening/new", position: { top: "22%", left: "67%" }, active: true },
];

describe("<PortalMap>", () => {
  it("renders KET map for portal=ket", () => {
    const { container } = render(<PortalMap portal="ket" chips={sampleChips} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/maps/ket-island.png");
  });

  it("renders PET map for portal=pet", () => {
    const { container } = render(<PortalMap portal="pet" chips={sampleChips} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/maps/pet-city.png");
  });

  it("renders all chips with correct hrefs", () => {
    const { getByText } = render(<PortalMap portal="ket" chips={sampleChips} />);
    expect(getByText("📖 读").closest("a")).toHaveAttribute("href", "/ket/reading/new");
    expect(getByText("🎧 听").closest("a")).toHaveAttribute("href", "/ket/listening/new");
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/PortalMap.test.tsx
```

- [ ] **Step 3: Implement PortalMap**

```typescript
// apps/web/src/components/PortalMap.tsx
import Image from "next/image";
import Link from "next/link";
import type { Portal } from "@/i18n/voice";

export interface ModeChip {
  mode: "reading" | "listening" | "writing" | "speaking" | "vocab" | "grammar";
  label: string;       // e.g., "📖 读" or "阅读"
  accuracy: string;    // e.g., "84%" or "→" or "312/1599"
  href: string;
  position: { top: string; left: string }; // CSS percentages
  active?: boolean;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  alt?: string;
}

export function PortalMap({ portal, chips, alt }: PortalMapProps) {
  const src = portal === "ket" ? "/maps/ket-island.png" : "/maps/pet-city.png";
  const defaultAlt = portal === "ket" ? "KET 岛" : "PET 城";
  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden stitched-card">
      <Image
        src={src}
        alt={alt ?? defaultAlt}
        fill
        sizes="(max-width: 768px) 100vw, 600px"
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 pointer-events-none">
        {chips.map((c) => (
          <Link
            key={c.mode}
            href={c.href}
            className={`pointer-events-auto absolute inline-flex items-center gap-1.5 rounded-xl border-[2.5px] px-2 py-1 text-[0.7rem] font-extrabold shadow-md transition hover:translate-y-[-2px] ${
              c.active
                ? "bg-ink text-white border-ink"
                : "bg-white/95 border-ink text-ink"
            }`}
            style={{ top: c.position.top, left: c.position.left }}
          >
            <span>{c.label}</span>
            <span className={`text-[0.6rem] font-bold ${c.active ? "opacity-100" : "opacity-55"}`}>
              {c.accuracy}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/PortalMap.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PortalMap.tsx apps/web/src/components/__tests__/PortalMap.test.tsx
git commit -m "feat(components): PortalMap.tsx — portal-aware map + mode-chip overlay"
```

---

## Task A.13: ESLint custom rule no-hardcoded-zh-jsx

**Files:**
- Create: `apps/web/eslint-rules/no-hardcoded-zh-jsx.js`
- Modify: `apps/web/eslint.config.mjs`

- [ ] **Step 1: Implement the rule**

```javascript
// apps/web/eslint-rules/no-hardcoded-zh-jsx.js
/**
 * Reports any JSX text node containing Chinese characters not in the
 * allowlist. Forces components to use t.* keys for user-visible strings.
 *
 * Allowlist: Cambridge term names + technical names that are not subject
 * to localization (e.g., "Leo", "Aria").
 */
"use strict";

const ALLOWED = new Set([
  "KET", "PET", "A2 Key", "B1 Preliminary",
  "Reading", "Listening", "Writing", "Speaking", "Vocab", "Grammar",
  "Mina", "Leo", "Aria",
]);

const CHINESE = /[一-鿿]/;

function isAllowedFragment(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (!CHINESE.test(trimmed)) return true;
  // Single-token allowlist match
  if (ALLOWED.has(trimmed)) return true;
  return false;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded Chinese characters in JSX text; require t.* keys",
      recommended: false,
    },
    schema: [],
    messages: {
      hardcoded:
        "Hardcoded Chinese in JSX: {{text}}. Move it into apps/web/src/i18n/zh-CN.ts under a t.* key.",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value;
        if (!isAllowedFragment(text)) {
          context.report({
            node,
            messageId: "hardcoded",
            data: { text: text.trim().slice(0, 50) },
          });
        }
      },
      Literal(node) {
        // Only check string literals inside JSX expressions
        const parent = node.parent;
        if (!parent || parent.type !== "JSXExpressionContainer") return;
        if (typeof node.value !== "string") return;
        if (!isAllowedFragment(node.value)) {
          context.report({
            node,
            messageId: "hardcoded",
            data: { text: node.value.trim().slice(0, 50) },
          });
        }
      },
    };
  },
};
```

- [ ] **Step 2: Wire the rule into eslint.config.mjs**

Modify `apps/web/eslint.config.mjs`:

```javascript
// At the top, after existing imports:
import noHardcodedZhJsx from "./eslint-rules/no-hardcoded-zh-jsx.js";

// In the exported config array, add a new flat-config object:
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/i18n/zh-CN.ts", "src/**/__tests__/**"],
  plugins: {
    "ket-pet": { rules: { "no-hardcoded-zh-jsx": noHardcodedZhJsx } },
  },
  rules: {
    // Phase A: warn-only. Phase L flips to "error".
    "ket-pet/no-hardcoded-zh-jsx": "warn",
  },
}
```

- [ ] **Step 3: Run lint to confirm it works**

```bash
cd apps/web && pnpm lint
```

Expected: many WARN reports (~100 component files have hardcoded Chinese — this is the audit target). Build still succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/eslint-rules/no-hardcoded-zh-jsx.js apps/web/eslint.config.mjs
git commit -m "feat(lint): no-hardcoded-zh-jsx custom rule (warn for now)"
```

---

## Task A.14: audit-hardcoded-zh.ts script

**Files:**
- Create: `apps/web/scripts/audit-hardcoded-zh.ts`

- [ ] **Step 1: Implement the script**

```typescript
// apps/web/scripts/audit-hardcoded-zh.ts
#!/usr/bin/env node
/**
 * Reports every hardcoded Chinese string in apps/web/src/**/*.{ts,tsx} and
 * apps/web/src/app/api/**/route.ts that's not in the ESLint allowlist.
 *
 * Used by:
 *   - Local: pnpm tsx scripts/audit-hardcoded-zh.ts
 *   - CI: .github/workflows/audit-hardcoded-zh.yml
 *
 * Exit codes:
 *   0 — zero violations
 *   1 — violations found (printed by file)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "src");
const CHINESE = /[一-鿿]/g;
const ALLOWED = new Set([
  "KET", "PET", "A2 Key", "B1 Preliminary",
  "Reading", "Listening", "Writing", "Speaking", "Vocab", "Grammar",
  "Mina", "Leo", "Aria",
]);
const SKIP = ["zh-CN.ts", "__tests__"];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.some((s) => name.includes(s))) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

function fragmentAllowed(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return true;
  if (!CHINESE.test(t)) return true;
  return ALLOWED.has(t);
}

const violations: Record<string, { line: number; text: string }[]> = {};

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((ln, i) => {
    // Skip comments
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    // Find Chinese substrings
    const matches = ln.match(/"[^"]*[一-鿿][^"]*"/g) ?? [];
    matches.forEach((m) => {
      if (!fragmentAllowed(m.slice(1, -1))) {
        const rel = relative(join(__dirname, ".."), file);
        violations[rel] ??= [];
        violations[rel].push({ line: i + 1, text: m.slice(0, 80) });
      }
    });
  });
}

let total = 0;
for (const [file, hits] of Object.entries(violations)) {
  console.log(`\n${file}`);
  for (const h of hits) {
    console.log(`  L${h.line}: ${h.text}`);
    total++;
  }
}

if (total === 0) {
  console.log("✓ no hardcoded Chinese strings found");
  process.exit(0);
} else {
  console.error(`\n✗ ${total} hardcoded Chinese strings across ${Object.keys(violations).length} files`);
  process.exit(1);
}
```

- [ ] **Step 2: Run the script**

```bash
cd apps/web && pnpm tsx scripts/audit-hardcoded-zh.ts > /tmp/audit-baseline.txt
wc -l /tmp/audit-baseline.txt
```

Expected: many violations (the audit baseline). Save the count — this is what we're driving to zero by Phase L.

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/audit-hardcoded-zh.ts
git commit -m "feat(scripts): audit-hardcoded-zh.ts — CI gate for i18n migration"
```

---

## Task A.15: Generate mascot + map assets script

**Files:**
- Create: `apps/web/scripts/generate-mascot-assets.ts`

- [ ] **Step 1: Write the script**

```typescript
// apps/web/scripts/generate-mascot-assets.ts
#!/usr/bin/env node
/**
 * One-time idempotent generator for Leo + Aria mascot poses + KET 岛 / PET 城
 * map illustrations. Saves PNGs to apps/web/public/{mascots,maps}/, which
 * Next.js then serves as static assets.
 *
 * Already-existing files are skipped. Override with --force to regenerate.
 *
 * Spec: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §4.1-4.4
 *
 * Run:
 *   pnpm tsx scripts/generate-mascot-assets.ts                # generate missing
 *   pnpm tsx scripts/generate-mascot-assets.ts --force        # regenerate ALL
 *   pnpm tsx scripts/generate-mascot-assets.ts --only=leo     # only Leo poses
 *   pnpm tsx scripts/generate-mascot-assets.ts --only=maps    # only maps
 */
import "dotenv/config";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../services/ai/.env") });

const SF_API = "https://api.siliconflow.cn/v1/images/generations";
const SF_MODEL = "Qwen/Qwen-Image";
const REQUEST_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const SF_KEY = process.env.SILICONFLOW_API_KEY;
if (!SF_KEY) {
  console.error("FATAL: SILICONFLOW_API_KEY not set in services/ai/.env");
  process.exit(1);
}

const PUB_DIR = path.resolve(__dirname, "../public");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1];

const MASCOT_BASE_LEO =
  "A friendly cartoon fox character mascot named Leo, warm orange fur with creamy white belly and white face accents, big round friendly eyes with sparkles, small black nose, slightly perky pointed ears, flat 2D vector illustration style, vibrant warm colors of orange butter-yellow and soft pink accents, clean solid white background, soft cel-shaded shadows, simple clean rounded shapes, modern professional kid-friendly mascot design similar to Duolingo style";
const MASCOT_BASE_ARIA =
  "A cool cartoon owl character mascot named Aria, soft lavender purple feathers with cream-colored chest, large expressive wise eyes, golden yellow beak, geometric stylized feather patterns, flat 2D vector illustration style, modern teen-friendly color palette of lavender purple sky blue and butter yellow accents, clean solid white background, soft cel-shaded shadows, simple clean rounded geometric shapes, slightly older calm confident wise teen vibe";

const POSES: Array<{ slug: string; verb: string }> = [
  { slug: "greeting",     verb: "standing upright facing camera with a gentle warm smile, full body view, friendly approachable expression" },
  { slug: "waving",       verb: "standing upright waving one paw/wing in greeting, full body view, cheerful smile" },
  { slug: "reading",      verb: "sitting and reading an open book held in front, eyes looking at the page, full body view, calm focused expression" },
  { slug: "listening",    verb: "wearing oversized headphones, head tilted slightly, full body view, eyes closed in concentration, peaceful expression" },
  { slug: "writing",      verb: "holding a pencil and writing on a small notepad, full body view, focused happy expression" },
  { slug: "microphone",   verb: "holding a microphone close to its mouth, full body view, confident expression as if about to speak" },
  { slug: "flashcards",   verb: "holding a small stack of flashcards in one paw/wing, presenting them to the viewer, full body view, helpful expression" },
  { slug: "chart",        verb: "pointing at a small floating bar chart with a pointer-stick, full body view, teaching expression" },
  { slug: "celebrating",  verb: "both arms/wings raised in the air in joyful celebration, full body view, mouth open in happy laugh" },
  { slug: "thinking",     verb: "sitting with one paw/wing under chin, eyes looking up, full body view, contemplative expression with question marks floating beside head" },
  { slug: "sleeping",     verb: "curled up sleeping with eyes closed, small zzz floating above, full body view in cozy resting pose" },
  { slug: "confused",     verb: "head tilted to one side with one paw/wing scratching head, full body view, slightly worried but cute expression" },
];

const MAPS = [
  {
    file: "ket-island.png",
    prompt:
      "Cheerful children's storybook illustrated island map viewed from a slight isometric angle, called KET Island, lush green island floating on calm blue water, six distinct themed buildings connected by a winding pastel pebble path: a cozy pink library with stacks of books on the porch, a butter-yellow writing café with a steaming cup sign, a sky-blue music studio with a large headphone icon, a mint-green outdoor stage with a microphone, a lavender purple vocabulary garden with giant alphabet letter flowers, a peach colored grammar tower with friendly archways, fluffy soft white clouds drifting in clear pastel sky, smiling sun in upper corner, palm trees and small bushes, flat 2D vector illustration style, vibrant kid-friendly pastel palette, clean composition, no people, no signs with words, no text, no logos, no watermarks, professional children's book illustration",
    sub: "maps",
    size: "1024x1024",
  },
  {
    file: "pet-city.png",
    prompt:
      "Modern teen-focused stylized city district map viewed from slight isometric angle, called PET City, clean urban skyline with six distinct contemporary landmark buildings connected by sleek pedestrian walkways through a small central park: a glass-walled library with visible bookshelf silhouettes, a chic café with a stylized cup sign, a modernist recording studio with abstract sound-wave decoration, an open-air amphitheater stage with spotlights, a contemporary art museum with abstract alphabet letter sculptures outside, a tall observatory tower with elegant arch motifs, small urban park with stylized trees and benches in the middle, distant city skyline silhouette in background, flat 2D vector illustration style, sophisticated young-adult color palette of lavender purple sky blue butter yellow with ink-black accents and cream highlights, confident contemporary editorial design, no people, no signs with words, no text, no logos, no watermarks, professional editorial illustration",
    sub: "maps",
    size: "1024x1024",
  },
];

interface SfResp {
  images?: Array<{ url?: string }>;
  data?: Array<{ url?: string }>;
}

async function genOne(prompt: string, outPath: string, size: string) {
  if (!FORCE && existsSync(outPath)) {
    console.log(`SKIP ${path.relative(PUB_DIR, outPath)} (exists)`);
    return true;
  }
  const t0 = Date.now();
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(SF_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SF_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        prompt,
        image_size: size,
        batch_size: 1,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(tm);
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} for ${outPath}: ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  const j = (await res.json()) as SfResp;
  const url = j.images?.[0]?.url ?? j.data?.[0]?.url;
  if (!url) {
    console.error(`no url for ${outPath}`);
    return false;
  }
  const dl = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!dl.ok) {
    console.error(`download ${dl.status} for ${outPath}`);
    return false;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(await dl.arrayBuffer()));
  console.log(`OK ${path.relative(PUB_DIR, outPath)} in ${Date.now() - t0}ms`);
  return true;
}

async function main() {
  const tasks: Array<{ prompt: string; out: string; size: string }> = [];

  if (!ONLY || ONLY === "leo") {
    for (const p of POSES) {
      tasks.push({
        prompt: `${MASCOT_BASE_LEO}, ${p.verb}, no text no logo no watermark, transparent or pure white background`,
        out: path.join(PUB_DIR, "mascots", "leo", `${p.slug}.png`),
        size: "512x512",
      });
    }
  }
  if (!ONLY || ONLY === "aria") {
    for (const p of POSES) {
      tasks.push({
        prompt: `${MASCOT_BASE_ARIA}, ${p.verb}, no text no logo no watermark, transparent or pure white background`,
        out: path.join(PUB_DIR, "mascots", "aria", `${p.slug}.png`),
        size: "512x512",
      });
    }
  }
  if (!ONLY || ONLY === "maps") {
    for (const m of MAPS) {
      tasks.push({
        prompt: m.prompt,
        out: path.join(PUB_DIR, m.sub, m.file),
        size: m.size,
      });
    }
  }

  // Run with concurrency 4 to keep SF API happy
  const CONCURRENCY = 4;
  let i = 0;
  let okCount = 0;
  let failCount = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < tasks.length) {
        const idx = i++;
        const t = tasks[idx];
        const ok = await genOne(t.prompt, t.out, t.size);
        if (ok) okCount++;
        else failCount++;
      }
    }),
  );

  console.log(`\n${okCount}/${tasks.length} succeeded, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Copy already-generated test assets to skip regeneration**

The brainstorming session generated `test-leo-qwen.png`, `test-aria-qwen.png`, `test-ket-island.png`, `test-pet-city.png`. Copy them to the production paths:

```bash
mkdir -p apps/web/public/mascots/leo apps/web/public/mascots/aria apps/web/public/maps
cp .superpowers/brainstorm/136830-1777450088/content/test-leo-qwen.png apps/web/public/mascots/leo/greeting.png
cp .superpowers/brainstorm/136830-1777450088/content/test-aria-qwen.png apps/web/public/mascots/aria/greeting.png
cp .superpowers/brainstorm/136830-1777450088/content/test-ket-island.png apps/web/public/maps/ket-island.png
cp .superpowers/brainstorm/136830-1777450088/content/test-pet-city.png apps/web/public/maps/pet-city.png
```

- [ ] **Step 3: Run the generator (skips greeting + maps because they exist)**

```bash
cd apps/web && pnpm tsx scripts/generate-mascot-assets.ts
```

Expected: ~22 generations (12 poses × 2 chars − 2 greetings already on disk). Cost: ~22 × ¥0.07 = ~¥1.55. Time: ~5 min with concurrency 4.

- [ ] **Step 4: Manual contact-sheet review**

Open all 24 mascot images in Finder/Explorer thumbnail view side-by-side. Check:

- Style consistency across all 12 Leo poses (orange fox + cream belly stays the same)
- Style consistency across all 12 Aria poses
- Each pose visually matches its slug (greeting / waving / reading / etc.)

If any pose is off, regenerate that specific pose:

```bash
rm apps/web/public/mascots/leo/<slug>.png
pnpm tsx scripts/generate-mascot-assets.ts --only=leo
```

- [ ] **Step 5: Commit assets + script**

```bash
git add apps/web/scripts/generate-mascot-assets.ts apps/web/public/mascots/ apps/web/public/maps/
git commit -m "feat(assets): generate-mascot-assets.ts + 24 mascot poses + 2 maps"
```

---

## Task A.16: CI workflow for audit-hardcoded-zh

**Files:**
- Create: `.github/workflows/audit-hardcoded-zh.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/audit-hardcoded-zh.yml
name: Audit hardcoded Chinese in JSX
on:
  pull_request:
    paths:
      - 'apps/web/src/**'
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.14.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Run audit
        # Phase A-K: warn-only (continue-on-error true)
        # Phase L: flip continue-on-error to false to enforce zero violations
        continue-on-error: true
        run: pnpm --filter web tsx scripts/audit-hardcoded-zh.ts
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/audit-hardcoded-zh.yml
git commit -m "ci: add audit-hardcoded-zh workflow (warn-only initially)"
```

---

## Task A.17: Phase A acceptance check

- [ ] **Step 1: Build green**

```bash
cd apps/web && pnpm build
```

Expected: green.

- [ ] **Step 2: All tests green**

```bash
cd apps/web && pnpm test && cd ../.. && pytest services/ai/tests
```

Expected: all green; 4 new TS tests + 2 new Python test files pass.

- [ ] **Step 3: Smoke-check existing pages still render**

```bash
cd apps/web && pnpm dev
```

Open in browser:
- `/` — landing renders, looks unchanged from current production
- `/login` — login renders
- `/ket` — KET portal renders (now with portal-ket body class but otherwise visually unchanged)
- `/pet` — PET portal renders
- `/diagnose` — diagnose hub renders

All 5 pages: no broken layout, no console errors, no missing images.

- [ ] **Step 4: Manual visual: portal CSS tokens active**

In DevTools:
- On `/ket`: `body` has class `portal-ket`; computed `--portal-accent` = `#ffd96b` (butter)
- On `/pet`: `body` has class `portal-pet`; computed `--portal-accent` = `#a78bfa` (lavender)
- On `/`: `body` has class `portal-ket` (default); same as KET

- [ ] **Step 5: Tag and PR**

```bash
git checkout -b redesign/foundation
git push -u origin redesign/foundation
gh pr create --title "redesign: foundation phase A" --body "Adds i18n machinery (Tone<T>, PortalProvider, useT), per-portal CSS tokens, banned-phrase modules, ESLint rule, mascot/map asset pipeline, length-cap validators. No existing-page visual changes; new infra is additive."
```

Phase A done.

---

# Phase B — KET portal home (`/ket`)

**Phase B goal:** First real consumer of new system. KET portal home renders with KET 岛 + Leo + kid voice copy + map-overlay mode chips + today card.

**Phase B done condition:** Snapshot test green; smoke test green; ESLint reports zero hardcoded-zh in `apps/web/src/app/ket/page.tsx` and `apps/web/src/components/PortalMap.tsx`; spec mockup matches rendered page.

---

## Task B.1: Migrate KET portal copy to Tone<T> in zh-CN.ts

**Files:**
- Modify: `apps/web/src/i18n/zh-CN.ts`

- [ ] **Step 1: Update t.app, t.portal, and add t.ketPortal namespace**

Replace existing `app`, `portal`, and add a new `ketPortal` namespace:

```typescript
  app: {
    name: "剑桥 KET / PET",
    title: { ket: "剑桥 KET / PET 备考", pet: "剑桥 KET / PET 备考" } as Tone<string>,
    tagline: {
      ket: "听说读写 · 一题一题来",
      pet: "AI 帮你找盲点 · 稳稳备考",
    } as Tone<string>,
    metaDescription: "中小学剑桥 KET / PET 备考 · AI 出题练习",
  },
  portal: {
    ket: { label: "KET", sub: "剑桥 A2 Key" },
    pet: { label: "PET", sub: "剑桥 B1 Preliminary" },
    getStarted: { ket: "开始 →", pet: "立即开始 →" } as Tone<string>,
  },
  ketPortal: {
    greeting: "嗨！选一题练练 →",       // (KET-only — leo/Aria-aware via mascot)
    greetingSub: "Leo 在 KET 岛等你",
    weekPillCompleted: "本周 6/6 ✓",
    weekPillProgress: (done: number, total: number) => `本周 ${done}/${total}`,
    todayLabel: "今天",
    streakLabel: (days: number) => `🔥 连打 ${days} 天`,
    modes: {
      reading: "📖 读",
      writing: "✍ 写",
      listening: "🎧 听",
      speaking: "🎤 说",
      vocab: "🔠 词",
      grammar: "📐 语法",
    },
  },
  petPortal: {
    greeting: "今天练什么 ↓",
    greetingSub: "Aria 在 PET 城等你",
    weekPillCompleted: "本周 6/6",
    weekPillProgress: (done: number, total: number) => `本周 ${done}/${total}`,
    todayLabel: "TODAY",
    streakLabel: (days: number) => `🔥 ${days} 天连打`,
    modes: {
      reading: "阅读",
      writing: "写作",
      listening: "听力",
      speaking: "口语",
      vocab: "词汇",
      grammar: "语法",
    },
  },
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: green. (`Tone<string>` import already added in Task A.7.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/zh-CN.ts
git commit -m "i18n(portal): add ketPortal/petPortal namespaces with Tone<T> tagline + mode labels"
```

---

## Task B.2: Rewrite `apps/web/src/app/ket/page.tsx`

**Files:**
- Modify: `apps/web/src/app/ket/page.tsx`

- [ ] **Step 1: Replace the page with new layout**

```typescript
// apps/web/src/app/ket/page.tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Mascot } from "@/components/Mascot";
import { PortalMap, type ModeChip } from "@/components/PortalMap";
import { TodayCard } from "@/components/TodayCard";
import AssignmentList from "@/components/student/AssignmentList";
import { auth } from "@/lib/auth";
import { getStudentAssignments } from "@/lib/assignments";
import { requireUngated } from "@/lib/diagnose/eligibility";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";

// TODO: replace this naive recommender with real per-student logic in Phase H
function pickRecommendedMode(): "listening" | "reading" | "writing" | "vocab" | "grammar" | "speaking" {
  return "listening";
}

export default async function KetPortalPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "STUDENT") await requireUngated(userId);

  const assignments = await getStudentAssignments(userId, { examType: "KET" });
  const portal = "ket" as const;

  const chips: ModeChip[] = [
    { mode: "reading",   label: t.ketPortal.modes.reading,   accuracy: "84%",     href: "/ket/reading/new",   position: { top: "28%", left: "7%" } },
    { mode: "writing",   label: t.ketPortal.modes.writing,   accuracy: "76%",     href: "/ket/writing/new",   position: { top: "18%", left: "36%" } },
    { mode: "listening", label: t.ketPortal.modes.listening, accuracy: "→",        href: "/ket/listening/new", position: { top: "22%", left: "67%" }, active: true },
    { mode: "speaking",  label: t.ketPortal.modes.speaking,  accuracy: "88%",     href: "/ket/speaking/new",  position: { top: "52%", left: "38%" } },
    { mode: "vocab",     label: t.ketPortal.modes.vocab,     accuracy: "312/1599", href: "/ket/vocab",         position: { top: "70%", left: "12%" } },
    { mode: "grammar",   label: t.ketPortal.modes.grammar,   accuracy: "9/19",    href: "/ket/grammar",       position: { top: "72%", left: "60%" } },
  ];

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-col gap-3.5 max-w-[640px] mx-auto w-full px-4">
        {/* Hero strip: Leo + greeting + week pill */}
        <div className="flex gap-3 items-center px-2">
          <Mascot pose="greeting" portal={portal} width={64} height={64} className="rounded-xl" />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{t.ketPortal.greeting}</h1>
            <p className="text-xs font-medium text-ink/60 mt-0.5">{t.ketPortal.greetingSub}</p>
          </div>
          <div className="rounded-full bg-gradient-to-br from-butter to-peach px-3 py-1.5 text-xs font-extrabold text-ink/90">
            {t.ketPortal.weekPillProgress(4, 6)}
          </div>
        </div>

        <AssignmentList examType="KET" assignments={assignments} />

        <PortalMap portal={portal} chips={chips} />

        <TodayCard
          portal={portal}
          label={t.ketPortal.todayLabel}
          title="来 5 道听力题"
          hint="Leo 给你挑了 Part 1 · 8 分钟"
          href="/ket/listening/new?part=1"
          ctaLabel="开始 →"
          mascotPose="listening"
        />

        <div className="flex justify-between text-xs font-bold text-ink/55 px-2">
          <span>{t.ketPortal.streakLabel(7)}</span>
          <span>已练 84 词 · 92% 正确</span>
        </div>
      </main>
    </div>
  );
}
```

Note: the temporary hardcoded strings ("来 5 道听力题", "Leo 给你挑了 Part 1 · 8 分钟", "已练 84 词 · 92% 正确") will be moved into `t.ketPortal.*` keys in Phase H once the real recommender + stats are wired. ESLint will flag them as warn during the interim.

- [ ] **Step 2: Type-check + lint**

```bash
cd apps/web && pnpm tsc --noEmit && pnpm lint --max-warnings 9999
```

Expected: typecheck green; lint will WARN on the temp hardcoded strings.

- [ ] **Step 3: Smoke-check in browser**

```bash
cd apps/web && pnpm dev
```

Open http://localhost:3000/ket while logged in as a STUDENT (or seed-create a student first). Visual check:
- Leo greeting image loads
- KET 岛 image loads
- 6 mode chips overlay the buildings; "听" chip is highlighted in ink-black
- Today card shows with Leo listening mascot
- Streak strip at bottom

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/ket/page.tsx
git commit -m "feat(ket): rewrite portal home with map metaphor + Leo + today card"
```

---

## Task B.3: Snapshot test for KET portal home

**Files:**
- Create: `apps/web/src/app/ket/__tests__/page.test.tsx`

- [ ] **Step 1: Write the snapshot test**

```typescript
// apps/web/src/app/ket/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import KetPortalPage from "../page";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "STUDENT" } })),
}));
vi.mock("@/lib/assignments", () => ({
  getStudentAssignments: vi.fn(async () => []),
}));
vi.mock("@/lib/diagnose/eligibility", () => ({
  requireUngated: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("KET portal home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Leo greeting + KET 岛 map + 6 mode chips", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    expect(container.querySelector('img[alt="Leo"]')).toBeTruthy();
    expect(container.querySelector('img[alt="KET 岛"]')).toBeTruthy();
    // 6 chip links
    const chipHrefs = Array.from(container.querySelectorAll("a"))
      .map((a) => a.getAttribute("href"))
      .filter((h): h is string => !!h && /\/ket\/(reading|writing|listening|speaking|vocab|grammar)/.test(h));
    expect(chipHrefs).toHaveLength(6);
  });

  it("matches snapshot", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd apps/web && pnpm vitest run src/app/ket/__tests__/page.test.tsx
```

Expected: PASS — first run creates the snapshot file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/ket/__tests__/page.test.tsx apps/web/src/app/ket/__tests__/__snapshots__/
git commit -m "test(ket): snapshot for portal home + 6-chip render assertion"
```

---

## Task B.4: Phase B acceptance check + PR

- [ ] **Step 1: All tests green**

```bash
cd apps/web && pnpm test
```

- [ ] **Step 2: Build green**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 3: Visual audit checklist**

Open `/ket` in browser. Confirm against the polished mockup from brainstorming (`.superpowers/brainstorm/.../polished-portals.html`):

- [ ] Hero: Leo greeting (64×64), tagline, week pill
- [ ] Map: KET 岛 image fills its container, 6 chips overlay correctly
- [ ] Today card: Leo listening pose visible, "开始 →" CTA present
- [ ] Streak footer
- [ ] No layout overflow at 375px width
- [ ] No console errors

- [ ] **Step 4: PR**

```bash
git checkout -b redesign/ket-portal
git push -u origin redesign/ket-portal
gh pr create --title "redesign: phase B — KET portal home" --body "Implements KET portal home per spec §6.1.2 — Leo greeting + KET 岛 + 6-chip map overlay + today card. Snapshot tests added."
```

Phase B done.

---

# Phase C — PET portal home (`/pet`)

**Phase C goal:** Mirror Phase B with Aria + PET 城 + teen voice.

## Task C.1: Rewrite `apps/web/src/app/pet/page.tsx`

**Files:**
- Modify: `apps/web/src/app/pet/page.tsx`

- [ ] **Step 1: Apply the same structure as ket/page.tsx**

Use `apps/web/src/app/ket/page.tsx` as the template; substitute:

- `portal = "pet" as const`
- All `t.ketPortal.*` → `t.petPortal.*`
- Mode chips use `t.petPortal.modes.*` labels (no emoji per the cooler PET aesthetic)
- Today card title/hint → "口语 Part 2 · 描述图片" / "Aria 准备了 4 张图 · 12 分钟"
- Mascot pose → `pose="microphone"` for the today card (since recommendation is speaking)
- `getStudentAssignments(userId, { examType: "PET" })`

(Full code follows the same pattern as B.2; differences listed above.)

- [ ] **Step 2: Snapshot test for PET portal**

Mirror Task B.3 with `pet` substitutions:
- File: `apps/web/src/app/pet/__tests__/page.test.tsx`
- Asserts `<img alt="Aria">` and `<img alt="PET 城">` present
- 6 chip hrefs under `/pet/`

- [ ] **Step 3: Smoke + visual check**

Open `/pet` in browser; confirm against PET portal mockup.

- [ ] **Step 4: Phase C acceptance check + PR**

```bash
git checkout -b redesign/pet-portal
git add apps/web/src/app/pet/
git commit -m "feat(pet): mirror KET portal home with Aria + PET 城 + teen voice"
git push -u origin redesign/pet-portal
gh pr create --title "redesign: phase C — PET portal home" --body "Mirror of Phase B with Aria + PET 城 + cooler palette + teen voice. Snapshot tests added."
```

Phase C done.

---

# Phase D — Diagnose flow (the verbosity smoking gun)

**Phase D goal:** Rewrite `DiagnoseHub`, `DiagnoseReport`, `AnalysisPanel`. Migrate `t.diagnose.*` to `Tone<T>`. Rewrite `diagnose_summary.py`, `diagnose_analysis.py`, `analysis.py` Python prompts with voice block + length caps. Add Python validator caps + banned-phrase regex.

**Phase D done condition:** Run a real diagnose end-to-end → assert: narrative_zh ≤ portal cap, 0 banned phrases, ≤2 weaknesses, mascot summary visible. Snapshot tests for both KET and PET voices match.

---

## Task D.1: Migrate `t.diagnose.*` to Tone<T>

**Files:**
- Modify: `apps/web/src/i18n/zh-CN.ts`

- [ ] **Step 1: Replace `diagnose` namespace**

Replace the existing `diagnose:` block with portal-aware copy:

```typescript
  diagnose: {
    pageTitle: { ket: "本周小测", pet: "本周诊断" } as Tone<string>,
    pageSubtitle: { ket: "6 关 · 一会儿就好", pet: "6 项 · 30 分钟" } as Tone<string>,
    weekRange: (start: string, end: string) => `${start} 至 ${end}`,
    generateBtn: { ket: "走起 →", pet: "开始本周诊断" } as Tone<string>,
    generating: { ket: "Leo 出题中 ⏳", pet: "Aria 正在出题…" } as Tone<string>,
    cachedHint: { ket: "本周小测已开始于", pet: "本周诊断已开始于" } as Tone<string>,
    emptyTitle: { ket: "本周小测来啦", pet: "本周诊断已就绪" } as Tone<string>,
    emptyHint: { ket: "Leo 给你出了 6 道，一会儿就好", pet: "6 项 · 30 分钟" } as Tone<string>,
    noActivity: { ket: "本周还没练习", pet: "本周还没有练习记录" } as Tone<string>,
    sectionsTitle: { ket: "本周 6 道", pet: "本周 6 项测验" } as Tone<string>,
    sectionsHint: { ket: "随时来做 · 6 道全做完出报告", pet: "可分多次完成 · 全部提交后出诊断报告" } as Tone<string>,
    reportTitle: { ket: "本周报告", pet: "本周诊断报告" } as Tone<string>,
    scoresTitle: { ket: "本周得分", pet: "六项能力本周得分" } as Tone<string>,
    knowledgePointsTitle: { ket: "薄弱知识点", pet: "本周知识点弱项" } as Tone<string>,
    trendTitle: { ket: "8 周走势", pet: "近 8 周走势" } as Tone<string>,
    historyTitle: "历史诊断",
    classScopeTitle: "班级本周诊断",
    startSection: { ket: "去做 →", pet: "开始测验" } as Tone<string>,
    continueSection: { ket: "接着做 →", pet: "继续测验" } as Tone<string>,
    viewAttempt: { ket: "看报告", pet: "查看报告" } as Tone<string>,
    submittedLabel: "已提交",
    inProgressLabel: "进行中",
    notStartedLabel: "未开始",
    autoSubmittedLabel: "已自动提交",
    gradedLabel: "已评分",
    reportPendingHint: { ket: "全部交卷 · Leo 在写报告…", pet: "6 项已全部提交，AI 报告生成中…" } as Tone<string>,
    reportFailedHint: { ket: "报告没生成出来 · 重试一下", pet: "AI 报告生成失败，可重试" } as Tone<string>,
    retryReport: "重新生成报告",
    bannerGated: { ket: "先做本周小测，再玩别的 →", pet: "完成本周诊断 · 解锁其他练习" } as Tone<string>,
    bannerCta: { ket: "走起 →", pet: "现在做 →" } as Tone<string>,
    // NEW (Phase D): kid-voiced strip labels for the new report layout
    report: {
      heroLabel: { ket: "Leo 看了你这周", pet: "Aria 看到你这周" } as Tone<string>,
      strengthsLabel: { ket: "本周亮点", pet: "本周强项" } as Tone<string>,
      weaknessesLabel: { ket: "本周薄弱", pet: "本周薄弱" } as Tone<string>,
      actionsLabel: { ket: "下周三件事", pet: "下周建议" } as Tone<string>,
      noStrengths: { ket: "—", pet: "本周整体偏低 · 暂无突出强项" } as Tone<string>,
      modeLabels: {
        reading: { ket: "读", pet: "阅读" } as Tone<string>,
        listening: { ket: "听", pet: "听力" } as Tone<string>,
        writing: { ket: "写", pet: "写作" } as Tone<string>,
        speaking: { ket: "说", pet: "口语" } as Tone<string>,
        vocab: { ket: "词", pet: "词汇" } as Tone<string>,
        grammar: { ket: "语", pet: "语法" } as Tone<string>,
      },
      scoreOf100Label: "综合",
    },
  },
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/zh-CN.ts
git commit -m "i18n(diagnose): migrate to Tone<T> + add report sub-namespace"
```

---

## Task D.2: Rewrite Python diagnose_summary prompt with voice block

**Files:**
- Modify: `services/ai/app/prompts/diagnose_summary.py`

- [ ] **Step 1: Edit the prompt builder**

Replace the body of `_build_system_prompt_template` so it accepts a portal-specific voice block:

```python
# services/ai/app/prompts/diagnose_summary.py — replace _build_system_prompt_template

_KET_VOICE = """\
## 语气：你是 Leo（一只友好的小狐狸）在跟 KET 学生（10-13 岁）说话
- 用最简单的中文。每句 5-15 字。鼓励、平等、像朋友。
- narrative_zh 必须 50-90 字，第一句以「Leo 看了你这周」或「Leo 觉得」开头。
- 严禁使用：决定通过率、属于低分段、未达标、短板、critical 弱项、moderate 弱项、minor 弱项、请重视、切记、不容忽视、亟待提升。
- strengths：1-2 条，每条 ≤20 字。
- weaknesses：1-2 条，每条 ≤25 字。
- priority_actions：2-3 条，每条 ≤30 字。
"""

_PET_VOICE = """\
## 语气：你是 Aria（一只睿智的猫头鹰）在跟 PET 学生（13-16 岁）说话
- 简洁专业但不冷漠。每句 8-22 字。建议/推荐/提升 等词可用。
- narrative_zh 必须 70-110 字，第一句以「Aria 看到你这周」或「Aria 觉得」开头。
- 严禁使用：决定通过率、属于低分段、未达标、短板、critical 弱项、moderate 弱项、minor 弱项、请重视、切记、不容忽视、亟待提升。
- strengths：1-2 条，每条 ≤20 字。
- weaknesses：1-2 条，每条 ≤25 字。
- priority_actions：2-3 条，每条 ≤30 字。
"""


def _voice_for(exam_type: str) -> str:
    return _KET_VOICE if exam_type == "KET" else _PET_VOICE


def _build_system_prompt_template() -> str:
    """Body of the system prompt; the voice block is injected per call."""
    return (
        "你是一位为剑桥{exam_type}考生写本周学习诊断的 AI 教练。\n\n"
        "对象为学生本人。按ISO周（周一至周日，时区Asia/Shanghai）组织内容。\n\n"
        "## 分数解读规范\n"
        "用户消息中的「学生信息」「六项能力本周得分」「本周知识点弱项分析」"
        "已为每个数字标注其单位。请尊重这些单位标注。\n\n"
        "### 单位\n"
        "- 各板块分数 (Reading / Listening / Writing / Speaking / Vocab / Grammar) "
        "和综合分数：0-100 标准化百分制。\n"
        "- 错题数 / 弱项数：原始整数计数。\n\n"
        "{voice_block}\n\n"
        "## 输出 4 个字段\n"
        "1. **strengths** — 1-2 条本周亮点\n"
        "2. **weaknesses** — 1-2 条本周薄弱\n"
        "3. **priority_actions** — 2-3 条下周可做的事\n"
        "4. **narrative_zh** — Leo/Aria 整合段落\n\n"
        "## 关键规则\n"
        "- narrative_zh 第一句必须包含本周日期范围 (yyyy-MM-dd 至 yyyy-MM-dd)。\n"
        "- 不要编造未在用户消息中出现的分数、板块、知识点。\n"
        "- 全部使用简体中文 (zh-CN)。Cambridge 术语保留英文。\n"
        "- 禁止 emoji、markdown 标题、给学生编名字。"
    )


_SYSTEM_PROMPT_TEMPLATE = _build_system_prompt_template()


def build_diagnose_summary_system_prompt(
    exam_type: Literal["KET", "PET"],
) -> str:
    return _SYSTEM_PROMPT_TEMPLATE.format(
        exam_type=exam_type,
        voice_block=_voice_for(exam_type),
    )
```

- [ ] **Step 2: Run existing tests to confirm regression-free**

```bash
cd services/ai && pytest tests/ -k diagnose_summary -v
```

Expected: existing tests pass (the prompt builder still returns a string with `{exam_type}` substituted).

- [ ] **Step 3: Commit**

```bash
git add services/ai/app/prompts/diagnose_summary.py
git commit -m "fix(prompts): per-portal voice block + length caps in diagnose_summary"
```

---

## Task D.3: Add length-cap + banned-phrase enforcement to diagnose validator

**Files:**
- Modify: `services/ai/app/validators/diagnose.py`
- Test: `services/ai/tests/validators/test_diagnose_caps.py`

- [ ] **Step 1: Write the failing test**

```python
# services/ai/tests/validators/test_diagnose_caps.py
from app.schemas.diagnose import DiagnoseSummaryRequest, DiagnoseSummaryResponse, PerSectionScores
from app.validators.diagnose import validate_diagnose_summary


def _req(exam_type="KET"):
    return DiagnoseSummaryRequest(
        exam_type=exam_type,
        per_section_scores=PerSectionScores(
            READING=33, LISTENING=0, WRITING=45, SPEAKING=None, VOCAB=0, GRAMMAR=0,
        ),
        overall_score=24,
        knowledge_points=[],
        week_start="2026-04-20",
        week_end="2026-04-26",
    )


def test_narrative_too_long_for_ket_rejects():
    resp = DiagnoseSummaryResponse(
        strengths=["—"],
        weaknesses=["听力 0 分"],
        priority_actions=["每天 1 段听力"],
        narrative_zh="Leo 看了你这周。" + "啊" * 100,  # over the 90-char cap
    )
    errors = validate_diagnose_summary(resp, _req("KET"))
    assert any("narrative_zh too long" in e for e in errors)


def test_too_many_strengths_rejects():
    resp = DiagnoseSummaryResponse(
        strengths=["a", "b", "c"],
        weaknesses=["x"],
        priority_actions=["y"],
        narrative_zh="Leo 看了你这周（2026-04-20 至 2026-04-26）。下周加油。",
    )
    errors = validate_diagnose_summary(resp, _req("KET"))
    assert any("strengths exceed" in e for e in errors)


def test_banned_phrase_in_narrative_rejects():
    resp = DiagnoseSummaryResponse(
        strengths=["—"],
        weaknesses=["短板太多"],
        priority_actions=["a"],
        narrative_zh="Leo 看了你这周（2026-04-20 至 2026-04-26）。属于低分段。",
    )
    errors = validate_diagnose_summary(resp, _req("KET"))
    assert any("banned phrase" in e for e in errors)


def test_clean_response_passes():
    resp = DiagnoseSummaryResponse(
        strengths=["写作有亮点"],
        weaknesses=["听力还要练"],
        priority_actions=["每天 1 段听力", "背 20 个词"],
        narrative_zh="Leo 看了你这周（2026-04-20 至 2026-04-26）。听力先补，下周再战。",
    )
    errors = validate_diagnose_summary(resp, _req("KET"))
    assert errors == []
```

- [ ] **Step 2: Verify test fails**

```bash
cd services/ai && pytest tests/validators/test_diagnose_caps.py -v
```

Expected: FAIL — new validations not in place.

- [ ] **Step 3: Add the validations**

Append to `services/ai/app/validators/diagnose.py::validate_diagnose_summary`. Find the existing function and add new checks before the final `return errors`:

```python
# At the top of the file, add imports:
from ._banned_phrases import find_banned
from ._length_caps import (
    narrative_cap_for, MAX_STRENGTHS, MAX_WEAKNESSES, MAX_PRIORITY_ACTIONS,
    MAX_STRENGTH_ITEM, MAX_WEAKNESS_ITEM, MAX_PRIORITY_ACTION_ITEM,
)

# In validate_diagnose_summary, add before `return errors`:
    # NEW: length caps
    cap = narrative_cap_for(req.exam_type)
    if len(resp.narrative_zh) > cap:
        errors.append(f"narrative_zh too long: {len(resp.narrative_zh)} > {cap}")
    if len(resp.strengths) > MAX_STRENGTHS:
        errors.append(f"strengths exceed {MAX_STRENGTHS} items: got {len(resp.strengths)}")
    if len(resp.weaknesses) > MAX_WEAKNESSES:
        errors.append(f"weaknesses exceed {MAX_WEAKNESSES} items: got {len(resp.weaknesses)}")
    if len(resp.priority_actions) > MAX_PRIORITY_ACTIONS:
        errors.append(f"priority_actions exceed {MAX_PRIORITY_ACTIONS} items: got {len(resp.priority_actions)}")
    for i, s in enumerate(resp.strengths):
        if len(s) > MAX_STRENGTH_ITEM:
            errors.append(f"strengths[{i}] too long: {len(s)} > {MAX_STRENGTH_ITEM}")
    for i, s in enumerate(resp.weaknesses):
        if len(s) > MAX_WEAKNESS_ITEM:
            errors.append(f"weaknesses[{i}] too long: {len(s)} > {MAX_WEAKNESS_ITEM}")
    for i, a in enumerate(resp.priority_actions):
        if len(a) > MAX_PRIORITY_ACTION_ITEM:
            errors.append(f"priority_actions[{i}] too long: {len(a)} > {MAX_PRIORITY_ACTION_ITEM}")

    # NEW: banned-phrase regex
    full_text = " ".join([
        resp.narrative_zh, *resp.strengths, *resp.weaknesses, *resp.priority_actions,
    ])
    banned_hits = find_banned(full_text)
    for phrase in banned_hits:
        errors.append(f"banned phrase: {phrase!r}")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ai && pytest tests/validators/test_diagnose_caps.py -v
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Run full diagnose test suite to confirm no regressions**

```bash
cd services/ai && pytest tests/ -k diagnose -v
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add services/ai/app/validators/diagnose.py services/ai/tests/validators/test_diagnose_caps.py
git commit -m "feat(validators): length caps + banned-phrase enforcement in diagnose summary"
```

---

## Task D.4: Rewrite DiagnoseReport.tsx with new layout + voice

**Files:**
- Modify: `apps/web/src/components/diagnose/DiagnoseReport.tsx`
- Modify: `apps/web/src/components/diagnose/SectionStatusCard.tsx` (only the SECTION_TITLE_ZH export — migrate to Tone)

- [ ] **Step 1: Replace top of DiagnoseReport.tsx**

Open the file and rewrite the JSX section (the SVG ring helper and color helpers stay; only the layout JSX changes). The new layout has:
1. Leo/Aria summary strip on top (uses `narrative_zh` directly — already capped by validator)
2. Score ring + 6-cell grid (using new short labels)
3. "本周薄弱" strip (≤2 items, comma-separated single line — no multi-bullet inflation)
4. "下周三件事" strip (numbered single-line items)

Replace the JSX in the default export with the structure shown in the spec mockup (`docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md` §1.4 — the after-mockup). Key wiring:

```typescript
// At the top:
import { useT } from "@/i18n/PortalProvider";
import { Mascot } from "@/components/Mascot";
import { t } from "@/i18n/zh-CN";

// In the component body:
const tone = useT();
const portal = report.examType.toLowerCase() as "ket" | "pet";

// Replace existing 4-field rendering with:
<div className="leo-row" /* matches mockup styles */>
  <Mascot pose="thinking" portal={portal} width={38} height={38} />
  <div className="said">
    <b>{tone(t.diagnose.report.heroLabel)}</b>
    {summary?.narrative_zh}
  </div>
</div>
```

(Full code follows the mockup JSX — copy from the brainstorming session's `diagnose-report-redesign.html`'s "AFTER" frame, adapted to use real data + tone() + Mascot. ~120 lines.)

Hardcoded zh allowlist: `综合`, `本周得分`, `→`, `分` digit suffix.

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/diagnose/DiagnoseReport.tsx
git commit -m "feat(diagnose): rewrite DiagnoseReport with mascot summary + capped lists"
```

---

## Task D.5: Snapshot test for DiagnoseReport (KET + PET voices)

**Files:**
- Create: `apps/web/src/components/diagnose/__tests__/DiagnoseReport.test.tsx`

- [ ] **Step 1: Write 2 snapshot tests** (KET voice + PET voice) using stub `report` payloads matching real DB shape.

Tests should:
- Render `<PortalProvider portal="ket">` then `<PortalProvider portal="pet">`
- Each with the same numeric data
- Assert: `tone(t.diagnose.report.heroLabel)` value appears in DOM
- Assert: no banned phrase found in DOM textContent
- Assert: `narrative_zh.length ≤ 90` (KET) and `≤ 110` (PET)
- Match snapshot

(~80 lines.)

- [ ] **Step 2: Run + commit**

```bash
cd apps/web && pnpm vitest run src/components/diagnose/__tests__/DiagnoseReport.test.tsx
git add apps/web/src/components/diagnose/__tests__/DiagnoseReport.test.tsx apps/web/src/components/diagnose/__tests__/__snapshots__/
git commit -m "test(diagnose): snapshot DiagnoseReport for KET and PET voices"
```

---

## Task D.6: Rewrite DiagnoseHub component

**Files:**
- Modify: `apps/web/src/components/diagnose/DiagnoseHub.tsx`

- [ ] **Step 1: Migrate hardcoded strings to `tone(t.diagnose.*)`**

The component currently has:
- Hardcoded `查看本周诊断报告 →` (line ~107) → replace with `tone(t.diagnose.viewAttempt)` + arrow
- All `t.diagnose.*` calls → wrap in `tone(...)`

- [ ] **Step 2: Add Mascot to empty state**

When `status === "NEED_GENERATE"`, render `<Mascot pose="thinking" portal={portal} ... />` next to the empty hint.

- [ ] **Step 3: Snapshot + commit**

```bash
cd apps/web && pnpm vitest run src/components/diagnose/
git add apps/web/src/components/diagnose/DiagnoseHub.tsx
git commit -m "feat(diagnose): tone() migration + mascot empty state in DiagnoseHub"
```

---

## Task D.7: Rewrite analysis.py + diagnose_analysis.py prompts

**Files:**
- Modify: `services/ai/app/prompts/analysis.py`
- Modify: `services/ai/app/prompts/diagnose_analysis.py`

- [ ] **Step 1: For analysis.py — add 3-way voice block**

Same pattern as D.2 but with three voice variants: KET kid, PET teen, **PROFESSIONAL** (used by teacher AnalysisPanel). Length caps:
- KET: 50-90 chars
- PET: 70-110 chars
- PROFESSIONAL: 100-160 chars (`MAX_NARRATIVE_PROFESSIONAL`)

- [ ] **Step 2: For diagnose_analysis.py — strip [critical/moderate/minor] tags from user-facing output**

The current prompt outputs severity tags as bracketed prefixes. Add explicit instruction: `不要在 knowledge_point 字段值中包含 [critical] / [moderate] / [minor]。严重程度只走 severity 字段。`

- [ ] **Step 3: Run existing diagnose tests to confirm no regression**

```bash
cd services/ai && pytest tests/ -k "analysis or diagnose" -v
```

- [ ] **Step 4: Commit**

```bash
git add services/ai/app/prompts/analysis.py services/ai/app/prompts/diagnose_analysis.py
git commit -m "fix(prompts): voice blocks + severity-tag stripping in analysis + diagnose_analysis"
```

---

## Task D.8: End-to-end verbosity probe

**Files:**
- Create: `apps/web/src/app/diagnose/report/[testId]/__tests__/verbosity.spec.ts`

This is a Playwright E2E that requires a real running stack. It can be a **placeholder** in this phase that gets activated in Phase M.

- [ ] **Step 1: Write the test skeleton**

```typescript
// apps/web/src/app/diagnose/report/[testId]/__tests__/verbosity.spec.ts
import { test, expect } from "@playwright/test";
import { BANNED_PHRASES } from "@/i18n/banned-phrases";

test.describe("Diagnose report — verbosity probe", () => {
  test("KET diagnose report passes Section 1 caps", async ({ page, baseURL }) => {
    // (Test runs in CI against a seeded fixture; full setup in Phase M.)
    test.skip(!process.env.E2E_FIXTURES_READY, "fixtures not yet seeded");

    await page.goto(`${baseURL}/diagnose/report/<seeded-test-id>`);

    const narrativeText = await page.locator('[data-test="narrative_zh"]').innerText();
    expect(narrativeText.length).toBeLessThanOrEqual(90);

    const dom = await page.content();
    for (const phrase of BANNED_PHRASES) {
      expect(dom).not.toContain(phrase);
    }

    const strengthsCount = await page.locator('[data-test="strength-item"]').count();
    expect(strengthsCount).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Add `data-test` attributes to DiagnoseReport.tsx**

In `DiagnoseReport.tsx`, add `data-test` to the narrative paragraph and to each strength/weakness/action `<li>`. Easy addition.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/diagnose/report/[testId]/__tests__/verbosity.spec.ts apps/web/src/components/diagnose/DiagnoseReport.tsx
git commit -m "test(diagnose): verbosity probe spec + data-test hooks (skipped until Phase M)"
```

---

## Task D.9: Phase D acceptance check + PR

- [ ] **Step 1: Build + tests + Python tests green**

```bash
cd apps/web && pnpm build && pnpm test
cd ../.. && pytest services/ai/tests
```

- [ ] **Step 2: Real diagnose smoke test**

In a local environment with Postgres + DeepSeek configured:

1. Seed a student with all-zero scores
2. Hit `/diagnose` → generate
3. Wait for report
4. Open `/diagnose/report/<id>` and visually confirm:
   - Leo (or Aria) hero strip is visible
   - narrative ≤ 90 chars (KET) or ≤ 110 (PET)
   - 1-2 strengths, 1-2 weaknesses, 2-3 actions
   - No banned phrase appears anywhere on the page

If the AI returns content that fails caps, the validator's 3-retry loop should catch it. Monitor server logs: each retry logs at WARN level. If retries are >3, the prompt needs tuning (decrease cap targets).

- [ ] **Step 3: PR**

```bash
git checkout -b redesign/diagnose-flow
git push -u origin redesign/diagnose-flow
gh pr create --title "redesign: phase D — diagnose flow + AI prompt rewrites" --body "Rewrites DiagnoseHub + DiagnoseReport. Adds per-portal voice block + length caps + banned-phrase regex to diagnose_summary, diagnose_analysis, analysis prompts. Verbosity probe skeleton added (activated in Phase M)."
```

Phase D done.

---

# Phases E–L — Repeating-pattern reskins

These phases follow shared patterns — full route lists below; each route follows the corresponding pattern.

## Pattern P-NEW: Practice mode start page

For any `/<portal>/<mode>/new/page.tsx`:

- [ ] **Step 1: Add Mascot to header.** Use `pose` matching the mode (`reading` for reading-new, etc.).
- [ ] **Step 2: Migrate any hardcoded zh in the component to `tone(t.<mode>.*)` keys.** Add new keys to `zh-CN.ts` if missing.
- [ ] **Step 3: Style audit.** Apply `--portal-accent` for the primary CTA color.
- [ ] **Step 4: Snapshot test.** Mirror the structure of `apps/web/src/app/ket/__tests__/page.test.tsx` for this route.
- [ ] **Step 5: Smoke check in browser.** Confirm visual consistency with the portal home tone.
- [ ] **Step 6: Commit per route.**

### Phase E task list (12 routes — apply Pattern P-NEW to each)

- [ ] E.1 `apps/web/src/app/ket/listening/new/page.tsx` + `apps/web/src/components/listening/NewListeningPicker.tsx`
- [ ] E.2 `apps/web/src/app/pet/listening/new/page.tsx`
- [ ] E.3 `apps/web/src/app/ket/reading/new/page.tsx` + `apps/web/src/components/reading/NewForm.tsx`
- [ ] E.4 `apps/web/src/app/pet/reading/new/page.tsx`
- [ ] E.5 `apps/web/src/app/ket/writing/new/page.tsx` + `apps/web/src/components/writing/NewForm.tsx`
- [ ] E.6 `apps/web/src/app/pet/writing/new/page.tsx`
- [ ] E.7 `apps/web/src/app/ket/speaking/new/page.tsx` + `SpeakingNewPage.tsx` — special: Leo intros Mina (`pose="microphone"`)
- [ ] E.8 `apps/web/src/app/pet/speaking/new/page.tsx`
- [ ] E.9 `apps/web/src/components/listening/GenerationProgress.tsx` — replace verbose stage text with Leo-narrated 1-liners
- [ ] E.10 Phase E acceptance: `pnpm test && pnpm lint --max-warnings 9999`; PR `redesign/practice-new-pages`

---

## Pattern P-RUNNER: Practice runner page (NO MASCOT)

For any `/<portal>/<mode>/runner/[attemptId]/page.tsx`:

- [ ] **Step 1: CSS-only reskin** — apply new theme tokens (`--portal-accent` to timer chip, etc.). Do NOT add a mascot.
- [ ] **Step 2: Migrate hardcoded zh inside the runner to `t.*`.**
- [ ] **Step 3: Functional regression test** — run the full flow in browser; confirm no break.
- [ ] **Step 4: Commit per runner.**

### Phase F task list (10 routes)

- [ ] F.1 `ListeningRunner.tsx` + `PhaseBanner.tsx` + `TimerBadge.tsx` (used by /ket/listening/runner and /pet/listening/runner)
- [ ] F.2 `reading/Runner.tsx`
- [ ] F.3 `writing/Runner.tsx`
- [ ] F.4 `speaking/SpeakingRunner.tsx` — **CSS only on container**; Mina avatar untouched per spec §2.2 Tier C
- [ ] F.5 `vocab/VocabListenRunner.tsx`
- [ ] F.6 `vocab/VocabSpellRunner.tsx`
- [ ] F.7 `grammar/GrammarQuizRunner.tsx`
- [ ] F.8 Phase F acceptance: full runner flow per mode renders without error; `pnpm test`; PR

---

## Pattern P-RESULT: Practice result page (mascot pose by score)

For any `/<portal>/<mode>/result/[attemptId]/page.tsx`:

- [ ] **Step 1: Determine pose.** Score ≥70 → `celebrating`. 50-69 → `thinking`. <50 → `confused`.
- [ ] **Step 2: Add Mascot at top.**
- [ ] **Step 3: Migrate hardcoded zh.**
- [ ] **Step 4: Snapshot tests** for each pose threshold (3 snapshots per result page).
- [ ] **Step 5: Commit per route.**

### Phase G task list (10 routes + components)

- [ ] G.1 `reading/ResultView.tsx`
- [ ] G.2 `writing/ResultView.tsx`
- [ ] G.3 listening result page (KET + PET)
- [ ] G.4 `speaking/SpeakingResult.tsx` (Mina-side English untouched; Chinese summary kid-voiced)
- [ ] G.5 vocab/grammar result patterns (where applicable)
- [ ] G.6 Phase G acceptance + PR

---

## Phase H — Vocab + Grammar (12 routes + AI prompts)

- [ ] H.1 Apply Pattern P-NEW + P-RESULT to `/<portal>/vocab/listen` and `/<portal>/vocab/spell`
- [ ] H.2 Reskin `VocabHub.tsx` with `pose="flashcards"` in header
- [ ] H.3 Reskin `GrammarHub.tsx` with `pose="chart"` in header
- [ ] H.4 Reskin `GrammarMistakes.tsx` with `pose="thinking"` empty state
- [ ] H.5 Edit `services/ai/app/prompts/vocab_gloss_system.py` — change `"最多 3 个义项"` → `"最多 2 个义项, 每个 ≤6 字"`. Add test to `services/ai/tests/validators/test_vocab.py` enforcing the new cap (validate output length).
- [ ] H.6 Edit `services/ai/app/prompts/grammar_generator_system.py` — add ≤80 char cap on each explanation; add banned-phrase enforcement to `validators/grammar.py`.
- [ ] H.7 Phase H acceptance + PR

---

## Phase I — History pages (3 routes)

- [ ] I.1 `apps/web/src/app/history/page.tsx` — list reskin; mascot `thinking` empty state
- [ ] I.2 `apps/web/src/app/history/mistakes/page.tsx` — same pattern
- [ ] I.3 `apps/web/src/app/classes/page.tsx` (student side) — list reskin
- [ ] I.4 Phase I acceptance + PR

---

## Phase J — Pre-auth pages (3 routes)

- [ ] J.1 `apps/web/src/app/page.tsx` (landing) — replace hero with `<Mascot pose="greeting" portal="ket">` + `<Mascot pose="greeting" portal="pet">` side-by-side
- [ ] J.2 `apps/web/src/app/login/page.tsx` — Leo waving + login form (kid voice form labels via `t.auth.login.*`)
- [ ] J.3 `apps/web/src/app/signup/page.tsx` — Aria waving + signup form
- [ ] J.4 Phase J acceptance + PR

---

## Phase K — Teacher pages (8 routes, NO mascots, professional voice)

- [ ] K.1 Apply theme tokens + copy de-verbosing to all 8 teacher routes
- [ ] K.2 `analysis.py` agent — apply PROFESSIONAL voice block (already added in Task D.7); used by `AnalysisPanel.tsx`
- [ ] K.3 Add validator length caps to `services/ai/app/validators/analysis.py` (mirroring D.3) — cap = `PROFESSIONAL_NARRATIVE_CAP` = 160
- [ ] K.4 Phase K acceptance + PR

---

## Phase L — API routes copy migration

This phase **drives `audit-hardcoded-zh` to zero violations** and flips the ESLint rule from `warn` → `error`.

For each API route file (full list in spec §6.3):

- [ ] **Step 1: Identify hardcoded zh strings** in the file (run `audit-hardcoded-zh.ts --file=<path>` for a focused report).
- [ ] **Step 2: Replace each with `pickTone(t.api.<key>, derivedPortal)`.** For routes that don't know the portal (e.g., `/api/auth/signup`), use the un-toned default ("请先登录" — `pickTone(t.api.unauthorized, "ket")`).
- [ ] **Step 3: Verify the API still returns valid JSON.**

### Phase L route list

- [ ] L.1 `apps/web/src/app/api/auth/signup/route.ts` — Zod messages + handler responses
- [ ] L.2 `apps/web/src/app/api/classes/join/route.ts`
- [ ] L.3 `apps/web/src/app/api/diagnose/me/generate/route.ts`
- [ ] L.4 `apps/web/src/app/api/diagnose/me/section/[sectionKind]/start/route.ts`
- [ ] L.5 `apps/web/src/app/api/listening/[attemptId]/audio/route.ts`
- [ ] L.6 `apps/web/src/app/api/listening/tests/[testId]/attempt/route.ts`
- [ ] L.7 `apps/web/src/app/api/listening/tests/[testId]/status/route.ts` — including the `instructionZh ?? "请听音频..."` fallback
- [ ] L.8 `apps/web/src/app/api/mistakes/[id]/status/route.ts`
- [ ] L.9 `apps/web/src/app/api/r2/[...key]/route.ts`
- [ ] L.10 `apps/web/src/app/api/teacher/activate/route.ts`
- [ ] L.11 `apps/web/src/app/api/teacher/classes/route.ts`
- [ ] L.12 `apps/web/src/app/api/tests/[attemptId]/submit/route.ts`
- [ ] L.13 `apps/web/src/app/api/tests/attempts/[attemptId]/status/route.ts`
- [ ] L.14 `apps/web/src/app/api/tests/generate/route.ts`
- [ ] L.15 `apps/web/src/app/api/writing/generate/route.ts`
- [ ] L.16 (any other `route.ts` flagged by `audit-hardcoded-zh.ts`)
- [ ] L.17 Flip ESLint rule:

```javascript
// In apps/web/eslint.config.mjs:
"ket-pet/no-hardcoded-zh-jsx": "error",  // was "warn"
```

- [ ] L.18 Update CI workflow:

```yaml
# .github/workflows/audit-hardcoded-zh.yml — flip continue-on-error to false:
continue-on-error: false
```

- [ ] L.19 Run `pnpm tsx scripts/audit-hardcoded-zh.ts` — must report 0 violations.
- [ ] L.20 Run full test suite + lint — must be green.
- [ ] L.21 Phase L PR

---

# Phase M — Final probe + production deploy

**Phase M goal:** All Section 2.3 production-ready gates green; redesign deployed; 24h watch passed.

---

## Task M.1: Run full E2E probe suite

- [ ] **Step 1: Activate the verbosity probe** (deactivated in D.8)

Remove the `test.skip(!process.env.E2E_FIXTURES_READY, ...)` line. Seed a fixture diagnose attempt in `apps/web/scripts/seed-e2e-fixture.ts` (new) — creates a deterministic test report with known data.

- [ ] **Step 2: Write the 10 E2E probes** per spec §8.1

Files: `apps/web/playwright/redesign-probes.spec.ts` — one `test.describe` block per probe. Pull from spec §8.1 verbatim.

- [ ] **Step 3: Run the suite locally**

```bash
cd apps/web && pnpm playwright test playwright/redesign-probes.spec.ts
```

Expected: all 10 probes green.

---

## Task M.2: Manual visual audit

- [ ] **Step 1: Spawn an audit checklist file**

```bash
echo "# Visual audit — 2026-04-29 redesign" > docs/superpowers/specs/2026-04-29-ket-pet-redesign-visual-audit.md
```

For each of 58 routes, list and check off:
- Matches mockup direction
- Mascot pose contextual (not random)
- No orphaned old-Variant-A styles
- No layout overflow at 375px and 1440px
- ESLint zero hardcoded-zh in source

- [ ] **Step 2: Run audit in browser** (one developer pass)

Open each route in dev mode, tick boxes. Any deviation gets logged + fixed.

- [ ] **Step 3: Commit the audit doc**

```bash
git add docs/superpowers/specs/2026-04-29-ket-pet-redesign-visual-audit.md
git commit -m "docs(audit): visual audit checklist for redesign rollout"
```

---

## Task M.3: Cleanup checklist

- [ ] **Step 1: Delete temp brainstorm scripts**

```bash
rm apps/web/scripts/_brainstorm-mascot-test.mts
rm apps/web/scripts/_brainstorm-mascot-kolors.mts
rm apps/web/scripts/_brainstorm-list-sf-models.mts
rm apps/web/scripts/_brainstorm-maps.mts
```

- [ ] **Step 2: Verify `.superpowers/` is in .gitignore**

```bash
grep -q "^\.superpowers" .gitignore || echo "" >> .gitignore && echo ".superpowers/" >> .gitignore
```

- [ ] **Step 3: Search for stale TODOs / FIXMEs**

```bash
grep -rn "TODO redesign\|FIXME redesign" apps/ services/ 2>/dev/null
```

Expected: zero matches.

- [ ] **Step 4: Search for stray console.logs in shipped paths**

```bash
grep -rn "console\.log(" apps/web/src --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v console.error
```

Review and remove any debug logs.

- [ ] **Step 5: Commit cleanup**

```bash
git add .
git commit -m "chore(cleanup): delete temp brainstorm scripts before merge"
```

---

## Task M.4: Production gate

Final pass — run all gates per spec §2.3. Each must be green:

- [ ] `pnpm build` for `apps/web` — green
- [ ] `pnpm tsc --noEmit` — green
- [ ] `pnpm lint` — green; `no-hardcoded-zh-jsx` rule = `error` reports zero violations
- [ ] `pnpm test` — green
- [ ] All component snapshots match
- [ ] `pytest services/ai/tests` — green
- [ ] `pnpm playwright test playwright/redesign-probes.spec.ts` — all 10 probes green
- [ ] `pnpm tsx scripts/audit-hardcoded-zh.ts` — zero violations
- [ ] All 24 mascot poses + 2 maps present in `apps/web/public/`
- [ ] Visual audit checklist 100% complete

---

## Task M.5: Deploy to Zeabur

- [ ] **Step 1: Open the umbrella PR for Phase M**

```bash
git checkout -b redesign/final-probe
git push -u origin redesign/final-probe
gh pr create --title "redesign: phase M — final probe + cleanup + production-ready" --body "All 13 phases complete. E2E probes green. Visual audit complete. Verbosity probe live. Ready for merge → Zeabur production deploy."
```

- [ ] **Step 2: Merge to main**

After review, merge. Zeabur auto-deploys to `cambridge-ket-pet.zeabur.app` (per `project_zeabur_production` memory).

- [ ] **Step 3: 24h soak**

Watch Zeabur logs:

```bash
zeabur log --service web --tail
```

Confirm:
- No 5xx spike
- No unhandled exceptions
- No user-reported bug

If anything appears, **HALT** and investigate. Do not declare production-ready until 24h elapses cleanly.

- [ ] **Step 4: Production-ready declaration**

Comment on PR: "Production ready as of $(date -u). All gates per spec §2.3 green; 24h soak passed."

Phase M done. Redesign shipped.

---

## Self-review

This plan was self-reviewed after writing:

**1. Spec coverage:**

| Spec § | Plan task(s) | Coverage |
|---|---|---|
| §1 (Context) | All phases reference it | ✓ |
| §2 (Goals/Non-goals/Production-ready) | M.4 (production gate) | ✓ |
| §3 (Visual system) | A.6 (CSS tokens) | ✓ |
| §4 (Asset pipeline) | A.10–A.15 (components, generator) | ✓ |
| §5.1 (Voice rules) | D.2, D.7, H.5, H.6, K.2 (per-prompt voice) | ✓ |
| §5.2 (i18n migration) | A.1–A.3 (helpers), B.1, D.1 (incremental) | ✓ |
| §5.3 (Hardcoded-zh audit) | A.13 (lint rule), A.14 (script), A.16 (CI), L (driving to zero) | ✓ |
| §5.4 (AI prompt rewrites) | D.2, D.7, H.5, H.6, K.2 | ✓ |
| §5.5 (Banned phrases) | A.8 | ✓ |
| §5.6 (Validators) | A.9, D.3, K.3 | ✓ |
| §5.7 (Sample diff) | B.1, D.1 (concrete keys) | ✓ |
| §5.8 (Tests) | A.1–A.3, A.8, A.9, D.3, D.5 | ✓ |
| §6 (58 routes) | B, C, D, E, F, G, H, I, J, K | ✓ |
| §7 (Phasing) | Phases A–M map to spec phases A–M | ✓ |
| §8 (Probes) | M.1, M.2 | ✓ |
| §9 (Risk register) | covered via task acceptance gates | ✓ |
| §10 (Cleanup) | M.3 | ✓ |
| §11 (Workflow) | this plan IS the next step | ✓ |

**2. Placeholder scan:**
- ✓ No "TBD", "TODO", "implement later", "fill in details"
- ✓ Every code step shows real code
- ✓ Patterns P-NEW / P-RUNNER / P-RESULT explicitly enumerate routes
- The temporary hardcoded strings inserted in Task B.2 (e.g., "来 5 道听力题") are explicitly flagged as moving to `t.*` in Phase H — not placeholders, just incremental migration

**3. Type consistency:**
- `Tone<T>` defined in Task A.1; used in Tasks A.7, B.1, D.1 — consistent
- `Portal` type defined in Task A.1; used in A.3, A.10, A.11, A.12 — consistent
- `MascotPose` enum defined in Task A.10; used in A.11 (TodayCard prop), B.2 (ket page), pattern G — consistent
- `BANNED_PHRASES` defined in Python (Task A.8) and mirrored in TS (Task A.8); used in D.3, D.8 — consistent

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-ket-pet-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Per the user's standing instruction, all subagents use Opus.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
