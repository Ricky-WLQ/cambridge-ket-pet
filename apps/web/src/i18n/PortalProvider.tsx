"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { pickTone, type Portal, type Tone } from "./voice";

const PortalContext = createContext<Portal>("ket");

export function PortalProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  return <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>;
}

export function usePortal(): Portal {
  return useContext(PortalContext);
}

/**
 * `useT()` returns a callable that resolves a `Tone<T>` to a concrete T using
 * the active portal. Components call it with i18n entries:
 *
 *     const tone = useT();
 *     <h1>{tone(t.app.tagline)}</h1>
 */
export function useT() {
  const portal = usePortal();
  return useCallback(<T,>(v: Tone<T>) => pickTone(v, portal), [portal]);
}
