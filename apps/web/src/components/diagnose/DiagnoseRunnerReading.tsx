"use client";

/**
 * Thin wrapper around the existing reading `Runner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular reading flow and the diagnose flow.
 *
 * I3: also overrides the post-submit redirect to `/diagnose` so a student
 * lands back on the hub after submitting a section, not on the regular
 * reading result page.
 */
import type { ComponentProps } from "react";
import ReadingRunner from "@/components/reading/Runner";

export default function DiagnoseRunnerReading(
  props: Omit<
    ComponentProps<typeof ReadingRunner>,
    "submitUrl" | "redirectAfterSubmit"
  >,
) {
  return (
    <ReadingRunner
      {...props}
      submitUrl="/api/diagnose/me/section/READING/submit"
      redirectAfterSubmit="/diagnose"
    />
  );
}
