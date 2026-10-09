"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * prefers-reduced-motion without hydration mismatches: the server and the hydration
 * pass both see `false`, then React re-renders with the real preference.
 * (motion's useReducedMotion returns null on the server and the real value on the
 * client's first render, which changes server-rendered markup.)
 */
export function useReducedMotionSafe() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
