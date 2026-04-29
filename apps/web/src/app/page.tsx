import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <div className="page-section">
      <SiteHeader />

      <main className="grow-fill flex flex-col items-center justify-center gap-8 px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight">
            <span className="marker-yellow-thick">{t.app.title}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg font-medium text-ink/70 leading-relaxed max-w-lg mx-auto">
            {/* Landing page is portal-agnostic — default to kid voice (Section 5.2 fallback). */}
            {pickTone(t.app.tagline, "ket")}
          </p>
        </div>

        {loggedIn ? (
          <div className="grid gap-5 sm:grid-cols-2 w-full max-w-xl">
            <Link
              href="/ket"
              className="skill-tile tile-lavender stitched-card group"
            >
              <div className="flex items-start justify-between">
                <span className="pill-tag bg-white/70 border-2 border-ink/10">A2</span>
                <span className="arrow-chip">→</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold leading-tight">{t.portal.ket.label}</div>
                <div className="mt-1.5 text-sm font-medium text-ink/70">{t.portal.ket.sub}</div>
              </div>
            </Link>
            <Link
              href="/pet"
              className="skill-tile tile-sky stitched-card group"
            >
              <div className="flex items-start justify-between">
                <span className="pill-tag bg-white/70 border-2 border-ink/10">B1</span>
                <span className="arrow-chip">→</span>
              </div>
              <div>
                <div className="text-3xl font-extrabold leading-tight">{t.portal.pet.label}</div>
                <div className="mt-1.5 text-sm font-medium text-ink/70">{t.portal.pet.sub}</div>
              </div>
            </Link>
          </div>
        ) : (
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-white text-base font-extrabold px-7 py-3.5 hover:bg-ink/90 transition"
          >
            {t.portal.getStarted} <span aria-hidden>→</span>
          </Link>
        )}
      </main>
    </div>
  );
}
