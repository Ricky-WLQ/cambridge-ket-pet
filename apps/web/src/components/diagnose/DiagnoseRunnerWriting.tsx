"use client";

/**
 * Thin wrapper around the existing writing `Runner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular writing flow and the diagnose flow.
 *
 * I3: also overrides the post-submit redirect to `/diagnose` so a student
 * lands back on the hub after submitting a section.
 */
import type { ComponentProps } from "react";
import WritingRunner from "@/components/writing/Runner";

export default function DiagnoseRunnerWriting(
  props: Omit<
    ComponentProps<typeof WritingRunner>,
    "submitUrl" | "redirectAfterSubmit"
  >,
) {
  return (
    <WritingRunner
      {...props}
      submitUrl="/api/diagnose/me/section/WRITING/submit"
      redirectAfterSubmit="/diagnose"
    />
  );
}
