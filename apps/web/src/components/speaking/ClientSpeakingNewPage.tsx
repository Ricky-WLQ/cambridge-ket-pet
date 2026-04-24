"use client";

import dynamic from "next/dynamic";

// ConnectionTest imports trtc-sdk-v5, which accesses `location` at module
// load and crashes under SSR. Loading the page via next/dynamic with
// ssr:false defers everything to the browser.
const SpeakingNewPage = dynamic(
  () =>
    import("./SpeakingNewPage").then((m) => ({ default: m.SpeakingNewPage })),
  { ssr: false, loading: () => <NewPageLoading /> },
);

function NewPageLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-3 p-6 text-neutral-400">
      <div className="h-6 w-40 animate-pulse rounded bg-neutral-800" />
      <div className="h-4 w-72 animate-pulse rounded bg-neutral-900" />
    </div>
  );
}

interface Props {
  level: "KET" | "PET";
}

export function ClientSpeakingNewPage(props: Props) {
  return <SpeakingNewPage {...props} />;
}
