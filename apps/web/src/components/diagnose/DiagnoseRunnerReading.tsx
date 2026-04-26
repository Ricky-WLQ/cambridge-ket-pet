"use client";

/**
 * Thin wrapper around the existing reading `Runner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular reading flow and the diagnose flow.
 */
import type { ComponentProps } from "react";
import ReadingRunner from "@/components/reading/Runner";

export default function DiagnoseRunnerReading(
  props: Omit<ComponentProps<typeof ReadingRunner>, "submitUrl">,
) {
  return (
    <ReadingRunner
      {...props}
      submitUrl="/api/diagnose/me/section/READING/submit"
    />
  );
}
