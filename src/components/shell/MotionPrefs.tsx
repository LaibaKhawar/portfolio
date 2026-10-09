"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Motion honours prefers-reduced-motion everywhere: transform animations are skipped. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
