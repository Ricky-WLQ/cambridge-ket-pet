import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Mascot } from "@/components/Mascot";
import { PortalMap, type ModeChip } from "@/components/PortalMap";
import AssignmentList from "@/components/student/AssignmentList";
import { auth } from "@/lib/auth";
import { getStudentAssignments } from "@/lib/assignments";
import {
  findCurrentWeekDiagnose,
  requireUngated,
} from "@/lib/diagnose/eligibility";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import type { WeeklyDiagnose } from "@prisma/client";
import { t } from "@/i18n/zh-CN";

const SECTION_DONE = new Set(["SUBMITTED", "AUTO_SUBMITTED", "GRADED"]);

/** Read the per-section status off a WeeklyDiagnose row. Mirrors the helper
 *  in apps/web/src/app/diagnose/page.tsx (sectionStateFor) — kept inline
 *  here rather than importing because that helper is private to that page. */
function sectionStatusFor(wd: WeeklyDiagnose, kind: DiagnoseSectionKind): string {
  switch (kind) {
    case "READING":
      return wd.readingStatus;
    case "LISTENING":
      return wd.listeningStatus;
    case "WRITING":
      return wd.writingStatus;
    case "SPEAKING":
      return wd.speakingStatus;
    case "VOCAB":
      return wd.vocabStatus;
    case "GRAMMAR":
      return wd.grammarStatus;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return "NOT_STARTED";
    }
  }
}

export default async function KetPortalPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  // Debug mode for refining polygon hit areas against the rendered map.
  // Toggle with /ket?debug=1. Never enabled in production by default.
  const params = props.searchParams ? await props.searchParams : {};
  const debug = params.debug === "1";

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // Belt-and-suspenders against stale JWT cache: the middleware should have
  // already redirected gated STUDENTs to /diagnose, but the JWT cache may
  // be stale.
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "STUDENT") {
    await requireUngated(userId);
  }

  const [assignments, wd] = await Promise.all([
    getStudentAssignments(userId, { examType: "KET" }),
    findCurrentWeekDiagnose(userId),
  ]);

  // Real diagnose progress: count sections in a "done" state out of 6.
  // If the user has no row for this week (wd === null) we show 0/6.
  const completedSections = wd
    ? DIAGNOSE_SECTION_KINDS.filter((k) =>
        SECTION_DONE.has(sectionStatusFor(wd, k)),
      ).length
    : 0;
  const totalSections = DIAGNOSE_SECTION_KINDS.length; // 6

  const portal = "ket" as const;

  // PRODUCTION-grade KET 岛: the unified user-approved illustration is
  // vectorized into /maps/ket-island.svg with per-building <g> groups
  // wrapped in <a href> for pixel-perfect HTML-native click targets.
  // PortalMap renders the SVG via <object>; chips below overlay the
  // ordinal badge ① → ⑥ above each building's location on the map.
  //
  // tagPosition is the chip name-tag center (in viewBox % coords),
  // hand-positioned over each building on the unified map. Accuracy
  // fields are intentionally omitted — spec §2.1.1 (no fabricated data).
  const chips: ModeChip[] = [
    {
      mode: "vocab",
      order: 1,
      label: t.ketPortal.modes.vocab,
      href: "/ket/vocab",
      tagPosition: { x: 78, y: 75 },
    },
    {
      mode: "grammar",
      order: 2,
      label: t.ketPortal.modes.grammar,
      href: "/ket/grammar",
      tagPosition: { x: 90, y: 38 },
    },
    {
      mode: "listening",
      order: 3,
      label: t.ketPortal.modes.listening,
      href: "/ket/listening/new",
      tagPosition: { x: 66, y: 22 },
    },
    {
      mode: "speaking",
      order: 4,
      label: t.ketPortal.modes.speaking,
      href: "/ket/speaking/new",
      tagPosition: { x: 50, y: 42 },
    },
    {
      mode: "reading",
      order: 5,
      label: t.ketPortal.modes.reading,
      href: "/ket/reading/new",
      tagPosition: { x: 18, y: 60 },
    },
    {
      mode: "writing",
      order: 6,
      label: t.ketPortal.modes.writing,
      href: "/ket/writing/new",
      tagPosition: { x: 38, y: 22 },
    },
  ];

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5 px-4">
        {/* Hero strip: Leo + greeting + week pill (real diagnose progress) */}
        <div className="flex items-center gap-3 px-2">
          <Mascot
            pose="greeting"
            portal={portal}
            width={64}
            height={64}
            className="rounded-xl"
          />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">
              {t.ketPortal.greeting}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-ink/60">
              {t.ketPortal.greetingSub}
            </p>
          </div>
          <Link
            href="/diagnose"
            className="rounded-full bg-gradient-to-br from-butter to-peach px-3 py-1.5 text-xs font-extrabold text-ink/90 hover:opacity-90 transition"
          >
            {t.ketPortal.weekPillProgress(completedSections, totalSections)}
          </Link>
        </div>

        <AssignmentList examType="KET" assignments={assignments} />

        <PortalMap portal={portal} chips={chips} debug={debug} />
      </main>
    </div>
  );
}
