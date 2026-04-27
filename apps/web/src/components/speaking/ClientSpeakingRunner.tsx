"use client";

import dynamic from "next/dynamic";

// trtc-sdk-v5 (transitively imported by SpeakingRunner → trtc-client) accesses
// `location` at module-load time, which throws ReferenceError under Node SSR.
// Loading the runner via next/dynamic with ssr:false defers all of its module
// graph to the browser.
const SpeakingRunner = dynamic(
  () =>
    import("./SpeakingRunner").then((m) => ({ default: m.SpeakingRunner })),
  { ssr: false, loading: () => <RunnerLoading /> },
);

function RunnerLoading() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-neutral-400">
      <div className="h-2 w-32 animate-pulse rounded bg-neutral-800" />
      <p className="text-sm">正在加载口语测试…</p>
    </div>
  );
}

interface Props {
  attemptId: string;
  level: "KET" | "PET";
  /**
   * Forwarded to SpeakingRunner — diagnose page passes "/diagnose" so the
   * post-submit redirect lands on the diagnose hub instead of the regular
   * practice result page (which 404s on kind=DIAGNOSE attempts).
   */
  redirectAfterSubmit?: string;
}

export function ClientSpeakingRunner(props: Props) {
  return <SpeakingRunner {...props} />;
}
