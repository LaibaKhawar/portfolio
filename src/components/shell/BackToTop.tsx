"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { useLenis } from "lenis/react";
import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import { cx } from "@/components/ui/primitives";

/** Up-arrow button that appears once the intro has scrolled away and returns to the top. */
export function BackToTop({ watchId = "intro" }: { watchId?: string }) {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotionSafe();
  const lenis = useLenis();

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: "0px 0px -60% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  const toTop = () => {
    if (lenis) lenis.scrollTo(0, { immediate: reduce, duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Scroll back to the top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={cx(
        "glass fixed right-4 bottom-5 z-40 grid size-12 place-items-center rounded-full text-ink transition-[opacity,transform] duration-300 sm:right-6 sm:bottom-6 sm:size-14",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <ArrowUp size={22} weight="bold" aria-hidden />
    </button>
  );
}
