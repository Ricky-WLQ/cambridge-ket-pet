/**
 * Top-of-page banner shown on /history (and other gated pages) when the
 * student must complete this week's diagnose before regaining access to
 * regular practice features.
 *
 * Server-renderable — caller decides whether to render based on
 * `session.user.requiredDiagnoseId !== null`. The banner intentionally lacks
 * a dismiss button: the gate is enforced by middleware, so dismissing it
 * client-side wouldn't help the user reach blocked routes.
 */
import Link from "next/link";

import { t } from "@/i18n/zh-CN";

interface Props {
  /**
   * The required WeeklyDiagnose id from the session — non-null when the user
   * is gated. Currently informational only (the link always points at
   * `/diagnose`), but kept on the prop surface so a future change to deep-link
   * to a specific week's hub is a 1-line change.
   */
  requiredDiagnoseId: string;
}

export default function GateBanner({ requiredDiagnoseId }: Props) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-butter-tint stitched-card p-4"
      role="alert"
      data-required-diagnose-id={requiredDiagnoseId}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          ⚠
        </span>
        <span className="text-sm font-extrabold text-ink">
          {t.diagnose.bannerGated}
        </span>
      </div>
      <Link
        href="/diagnose"
        className="rounded-full bg-ink px-4 py-1.5 text-xs font-extrabold text-white transition hover:bg-ink/90"
      >
        {t.diagnose.bannerCta}
      </Link>
    </div>
  );
}
