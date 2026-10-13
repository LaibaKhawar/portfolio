"use client";

import { useLenis } from "lenis/react";
import { useEffect } from "react";

const SETTLE_MS = 2500;

/**
 * Lands on the project named in the URL hash. Diagrams and demos mount as they
 * come into view and images load, which moves content, so the target is kept
 * aligned until the page settles or the visitor starts scrolling.
 */
export function HashScroll() {
  const lenis = useLenis();
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let start = performance.now();
    const stop = () => {
      stopped = true;
    };
    const align = () => {
      if (stopped) return;
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el) {
        // land where the section's scroll-margin says, clear of the floating nav
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const top = el.getBoundingClientRect().top;
        if (Math.abs(top - margin) > 4) {
          if (lenis) lenis.scrollTo(el, { immediate: true, force: true });
          else window.scrollTo({ top: window.scrollY + top - margin, behavior: "instant" as ScrollBehavior });
        }
      }
      if (performance.now() - start < SETTLE_MS) timer = window.setTimeout(align, 120);
    };
    const restart = () => {
      stopped = false;
      start = performance.now();
      window.clearTimeout(timer);
      align();
    };
    const opts = { passive: true } as const;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("keydown", stop);
    window.addEventListener("hashchange", restart);
    timer = window.setTimeout(align, 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("hashchange", restart);
    };
  }, [lenis]);
  return null;
}
