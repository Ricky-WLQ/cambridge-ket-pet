"use client";

/**
 * Thin wrapper around the existing writing `Runner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular writing flow and the diagnose flow.
 */
import type { ComponentProps } from "react";
import WritingRunner from "@/components/writing/Runner";

export default function DiagnoseRunnerWriting(
  props: Omit<ComponentProps<typeof WritingRunner>, "submitUrl">,
) {
  return (
    <WritingRunner
      {...props}
      submitUrl="/api/diagnose/me/section/WRITING/submit"
    />
  );
}
