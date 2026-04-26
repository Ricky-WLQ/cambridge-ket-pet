"use client";

/**
 * Thin wrapper around the existing `ListeningRunner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular listening flow and the diagnose flow.
 *
 * I3: also overrides the post-submit redirect to `/diagnose` so a student
 * lands back on the hub after submitting a section.
 */
import type { ComponentProps } from "react";
import { ListeningRunner } from "@/components/listening/ListeningRunner";

export default function DiagnoseRunnerListening(
  props: Omit<
    ComponentProps<typeof ListeningRunner>,
    "submitUrl" | "redirectAfterSubmit"
  >,
) {
  return (
    <ListeningRunner
      {...props}
      submitUrl="/api/diagnose/me/section/LISTENING/submit"
      redirectAfterSubmit="/diagnose"
    />
  );
}
