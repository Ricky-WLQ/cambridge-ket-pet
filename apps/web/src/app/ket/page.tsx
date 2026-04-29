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

  // Each chip's `region` is a bounding box on the KET 岛 map; the
  // `clipPath` polygon (relative to that box) cuts the click area down
  // to the building's actual silhouette. So clicking grass / sky / path
  // does nothing; clicking the *house* navigates. Per ui-ux-pro-max
  // Immersive/Interactive pattern with Claymorphism soft-press hover.
  //
  // Polygons were traced from apps/web/public/maps/ket-island.png; any
  // misses can be fine-tuned with the visual tool later. Accuracy fields
  // are intentionally omitted — spec §2.1.1 (no fabricated UI data).
  const chips: ModeChip[] = [
    {
      mode: "reading",
      label: t.ketPortal.modes.reading,
      href: "/ket/reading/new",
      region: { top: "38%", left: "3%", width: "29%", height: "32%" },
      // House pentagon + extension to the lower-left for the stack of books.
      clipPath:
        "polygon(45% 0, 80% 25%, 100% 25%, 100% 100%, 0 100%, 0 50%, 18% 50%, 28% 30%)",
      labelAnchor: "top-left",
    },
    {
      mode: "writing",
      label: t.ketPortal.modes.writing,
      href: "/ket/writing/new",
      region: { top: "14%", left: "24%", width: "26%", height: "32%" },
      // House pentagon (yellow café — steam plume above the chimney is
      // intentionally outside the polygon since clicking the steam isn't
      // an obvious affordance).
      clipPath:
        "polygon(50% 5%, 90% 30%, 100% 100%, 0 100%, 10% 30%)",
      labelAnchor: "top-left",
    },
    {
      mode: "listening",
      label: t.ketPortal.modes.listening,
      href: "/ket/listening/new",
      region: { top: "12%", left: "52%", width: "25%", height: "30%" },
      // Cube with the headphones notch on top — keep the headphones in
      // the click region (kids may aim for them).
      clipPath:
        "polygon(20% 0, 80% 0, 80% 25%, 100% 25%, 100% 100%, 0 100%, 0 25%, 20% 25%)",
      labelAnchor: "top-right",
    },
    {
      mode: "speaking",
      label: t.ketPortal.modes.speaking,
      href: "/ket/speaking/new",
      region: { top: "32%", left: "36%", width: "24%", height: "26%" },
      // Pavilion: triangular roof + open base. Polygon: peaked roof at
      // top, full-width body below.
      clipPath: "polygon(20% 0, 80% 0, 100% 35%, 100% 100%, 0 100%, 0 35%)",
      labelAnchor: "top-left",
    },
    {
      mode: "vocab",
      label: t.ketPortal.modes.vocab,
      href: "/ket/vocab",
      region: { top: "60%", left: "60%", width: "32%", height: "23%" },
      // Vocab garden = scattered alphabet letters + flowers; no clear
      // silhouette. Use the full bounding rectangle (still smaller than
      // a textbook button so clicks feel intentional).
      clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      labelAnchor: "top-left",
    },
    {
      mode: "grammar",
      label: t.ketPortal.modes.grammar,
      href: "/ket/grammar",
      region: { top: "16%", left: "78%", width: "20%", height: "48%" },
      // Tower with crenellated battlements at top — small notch profile
      // and tall body.
      clipPath:
        "polygon(20% 5%, 35% 5%, 35% 0, 50% 0, 50% 5%, 65% 5%, 65% 0, 80% 0, 80% 5%, 100% 15%, 100% 100%, 0 100%, 0 15%)",
      labelAnchor: "top-right",
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
