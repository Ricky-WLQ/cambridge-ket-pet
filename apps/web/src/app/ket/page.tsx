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

export default async function KetPortalPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // Belt-and-suspenders against stale JWT cache: the middleware should have
  // already redirected gated STUDENTs to /diagnose, but the JWT cache may
  // be stale (e.g., a teacher tool reset the user's diagnose mid-session,
  // or this is the first request after generate before update() ran).
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "STUDENT") {
    await requireUngated(userId);
  }

  const assignments = await getStudentAssignments(userId, { examType: "KET" });
  const portal = "ket" as const;

  // Mode chips overlay the buildings on the KET 岛 map. Positions are
  // hand-tuned percentages against the generated Qwen-Image map asset
  // (apps/web/public/maps/ket-island.png). Active chip = today's
  // recommendation (listening Part 1 for now; replaced by real
  // per-student logic in Phase H).
  const chips: ModeChip[] = [
    {
      mode: "reading",
      label: t.ketPortal.modes.reading,
      accuracy: "84%",
      href: "/ket/reading/new",
      position: { top: "28%", left: "7%" },
    },
    {
      mode: "writing",
      label: t.ketPortal.modes.writing,
      accuracy: "76%",
      href: "/ket/writing/new",
      position: { top: "18%", left: "36%" },
    },
    {
      mode: "listening",
      label: t.ketPortal.modes.listening,
      accuracy: "→",
      href: "/ket/listening/new",
      position: { top: "22%", left: "67%" },
      active: true,
    },
    {
      mode: "speaking",
      label: t.ketPortal.modes.speaking,
      accuracy: "88%",
      href: "/ket/speaking/new",
      position: { top: "52%", left: "38%" },
    },
    {
      mode: "vocab",
      label: t.ketPortal.modes.vocab,
      accuracy: "312/1599",
      href: "/ket/vocab",
      position: { top: "70%", left: "12%" },
    },
    {
      mode: "grammar",
      label: t.ketPortal.modes.grammar,
      accuracy: "9/19",
      href: "/ket/grammar",
      position: { top: "72%", left: "60%" },
    },
  ];

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5 px-4">
        {/* Hero strip: Leo + greeting + week pill */}
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
          <div className="rounded-full bg-gradient-to-br from-butter to-peach px-3 py-1.5 text-xs font-extrabold text-ink/90">
            {t.ketPortal.weekPillProgress(4, 6)}
          </div>
        </div>

        <AssignmentList examType="KET" assignments={assignments} />

        <PortalMap portal={portal} chips={chips} />

        {/* Temp scaffolding: title/hint move to t.ketPortal.* in Phase H once
            the per-student recommender lands. ESLint will warn on these
            hardcoded strings — accepted per plan. */}
        <TodayCard
          portal={portal}
          label={t.ketPortal.todayLabel}
          title="来 5 道听力题"
          hint="Leo 给你挑了 Part 1 · 8 分钟"
          href="/ket/listening/new"
          ctaLabel="开始 →"
          mascotPose="listening"
        />

        <div className="flex justify-between px-2 text-xs font-bold text-ink/55">
          <span>{t.ketPortal.streakLabel(7)}</span>
          {/* Temp: real stats wired in Phase H. */}
          <span>已练 84 词 · 92% 正确</span>
        </div>
      </main>
    </div>
  );
}
