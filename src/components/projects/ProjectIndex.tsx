"use client";

import { useLenis } from "lenis/react";
import { useEffect, useState, type MouseEvent } from "react";
import { cx } from "@/components/ui/primitives";

type Item = { slug: string; title: string };

/** Sticky list of projects that highlights the one being read. */
export function ProjectIndex({ items }: { items: Item[] }) {
  const [active, setActive] = useState(items[0]?.slug);
  const lenis = useLenis();
  // Scroll to the section's own scroll-margin, the same spot a shared link lands on.
  const go = (e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    const el = document.getElementById(slug);
    if (!el || !lenis) return;
    e.preventDefault();
    e.stopPropagation();
    history.replaceState(null, "", `#${slug}`);
    // diagrams mount during the scroll and move the target; settle on it at the end
    lenis.scrollTo(el, { duration: 1.1, onComplete: () => lenis.scrollTo(el, { immediate: true, force: true }) });
  };
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.slug)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <ol className="grid gap-0.5" data-lenis-prevent>
      {items.map((i, n) => (
        <li key={i.slug}>
          <a
            href={`#${i.slug}`}
            onClick={(e) => go(e, i.slug)}
            aria-current={active === i.slug ? "location" : undefined}
            className={cx(
              "flex gap-3 rounded-input px-2 py-1.5 text-sm transition-colors",
              active === i.slug ? "bg-fg/[0.06] text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <span className="w-5 shrink-0 font-mono text-[11px] leading-5 text-fg-faint">{String(n + 1).padStart(2, "0")}</span>
            <span className="leading-5">{i.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
