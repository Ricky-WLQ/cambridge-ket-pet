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

export default async function PetPortalPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "STUDENT") {
    await requireUngated(userId);
  }

  const [assignments, wd] = await Promise.all([
    getStudentAssignments(userId, { examType: "PET" }),
    findCurrentWeekDiagnose(userId),
  ]);

  const completedSections = wd
    ? DIAGNOSE_SECTION_KINDS.filter((k) =>
        SECTION_DONE.has(sectionStatusFor(wd, k)),
      ).length
    : 0;
  const totalSections = DIAGNOSE_SECTION_KINDS.length;

  const portal = "pet" as const;

  const chips: ModeChip[] = [
    {
      mode: "vocab",
      order: 1,
      label: t.petPortal.modes.vocab,
      href: "/pet/vocab",
      mascotPose: "flashcards",
      palette: "lavender",
      subtitle: "Vocabulary",
    },
    {
      mode: "grammar",
      order: 2,
      label: t.petPortal.modes.grammar,
      href: "/pet/grammar",
      mascotPose: "chart",
      palette: "cream",
      subtitle: "Grammar",
    },
    {
      mode: "listening",
      order: 3,
      label: t.petPortal.modes.listening,
      href: "/pet/listening/new",
      mascotPose: "listening",
      palette: "sky",
      subtitle: "Listening",
    },
    {
      mode: "speaking",
      order: 4,
      label: t.petPortal.modes.speaking,
      href: "/pet/speaking/new",
      mascotPose: "microphone",
      palette: "peach",
      subtitle: "Speaking",
    },
    {
      mode: "reading",
      order: 5,
      label: t.petPortal.modes.reading,
      href: "/pet/reading/new",
      mascotPose: "reading",
      palette: "mint",
      subtitle: "Reading",
    },
    {
      mode: "writing",
      order: 6,
      label: t.petPortal.modes.writing,
      href: "/pet/writing/new",
      mascotPose: "writing",
      palette: "butter",
      subtitle: "Writing",
    },
  ];

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
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
              {t.petPortal.greeting}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-ink/60">
              {t.petPortal.greetingSub}
            </p>
          </div>
          <Link
            href="/diagnose"
            className="rounded-full bg-gradient-to-br from-lavender to-sky px-3 py-1.5 text-xs font-extrabold text-ink/90 hover:opacity-90 transition"
          >
            {t.petPortal.weekPillProgress(completedSections, totalSections)}
          </Link>
        </div>

        <AssignmentList examType="PET" assignments={assignments} />

        <PortalMap portal={portal} chips={chips} />
      </main>
    </div>
  );
}
