"use client";

/**
 * Thin wrapper around the existing `ListeningRunner` that overrides the submit
 * endpoint to the diagnose-section route. Reusing the runner avoids drift
 * between the regular listening flow and the diagnose flow.
 */
import type { ComponentProps } from "react";
import { ListeningRunner } from "@/components/listening/ListeningRunner";

export default function DiagnoseRunnerListening(
  props: Omit<ComponentProps<typeof ListeningRunner>, "submitUrl">,
) {
  return (
    <ListeningRunner
      {...props}
      submitUrl="/api/diagnose/me/section/LISTENING/submit"
    />
  );
}
