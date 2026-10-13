"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useFlow } from "@/components/flow/FlowTransition";
import { FlowLink } from "@/components/flow/FlowLink";
import { LiquidGlass, setGlassSource } from "@/components/glass/LiquidGlass";
import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import type { PageProject } from "./pages";
import { Corridor, type CorridorOptions } from "./scene";

export type CorridorProject = PageProject & { href: string };

let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement("canvas");
      webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

function optionsFor(width: number): CorridorOptions {
  const narrow = width < 640;
  const pageWidthPx = Math.round(narrow ? width * 1.25 : Math.max(260, Math.min(560, width * 0.4)));
  return {
    pageWidthPx,
    pageHeightPx: Math.round(pageWidthPx / 1.2),
    spacing: narrow ? 2 : 5,
    tilt: 0,
    turn: narrow ? 14 : 0, // on phones, turn the corridor slightly so pages face the viewer
    zoom: 5,
    speed: 6,
    drift: 1.2,
    smoothing: 5,
    wave: 4,
    wheel: 5,
  };
}

/** Projects as a corridor of magazine pages. Click a page to open its case study. */
export function MagazineCorridor({ projects }: { projects: CorridorProject[] }) {
  const reduce = useReducedMotionSafe();
  const webgl = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const host = useRef<HTMLDivElement>(null);
  const corridor = useRef<Corridor | null>(null);
  const [ready, setReady] = useState(false);
  const { navigate } = useFlow();
  const navRef = useRef(navigate);
  useEffect(() => {
    navRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const el = host.current;
    if (!el || !webgl) return;
    let c: Corridor;
    try {
      c = new Corridor(el, projects, optionsFor(el.clientWidth), reduce);
    } catch {
      return;
    }
    corridor.current = c;
    c.onReady = () => setReady(true);
    c.onOpen = (i) => {
      const r = el.getBoundingClientRect();
      const size = Math.min(r.width, r.height) * 0.5;
      navRef.current(projects[i].href, { x: r.left + r.width / 2 - size / 2, y: r.top + r.height / 2 - size / 2, w: size, h: size });
    };
    c.setSize(el.clientWidth, el.clientHeight);
    c.start();
    setGlassSource(c.canvas);

    const ro = new ResizeObserver(() => {
      c.updateOptions(optionsFor(el.clientWidth));
      c.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => c.setVisible(e.isIntersecting));
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
      setGlassSource(null);
      c.dispose();
      corridor.current = null;
    };
  }, [projects, reduce, webgl]);

  const step = (n: number) => corridor.current?.stepPages(n);

  if (!webgl) {
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.slug}>
            <FlowLink href={p.href} className="block rounded-card border border-line bg-bg-raised p-5 hover:border-red/60">
              <span className="font-display block text-2xl text-fg">{p.title}</span>
              <span className="mt-2 block text-sm text-fg-muted">{p.tagline}</span>
            </FlowLink>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="relative">
      <div
        ref={host}
        role="region"
        aria-roledescription="carousel"
        aria-label="Projects. Drag sideways or use the arrow buttons; select a page to open it."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="relative h-[min(64dvh,560px)] min-h-[360px] w-full sm:h-[min(62dvh,540px)] touch-pan-y overflow-hidden rounded-card outline-offset-4 select-none"
        data-interactive
      >
        {!ready ? <div className="absolute inset-0 grid place-items-center text-sm text-fg-faint">Laying out the pages…</div> : null}
      </div>

      {/* guidance arrows, in liquid glass over the moving pages */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 sm:px-4">
        <LiquidGlass radius={999} className="pointer-events-auto">
          <button type="button" onClick={() => step(-1)} aria-label="Previous project" className="grid size-12 place-items-center rounded-full text-ink transition-transform active:scale-95 sm:size-14">
            <CaretLeft size={22} weight="bold" aria-hidden />
          </button>
        </LiquidGlass>
        <LiquidGlass radius={999} className="pointer-events-auto">
          <button type="button" onClick={() => step(1)} aria-label="Next project" className="grid size-12 place-items-center rounded-full text-ink transition-transform active:scale-95 sm:size-14">
            <CaretRight size={22} weight="bold" aria-hidden />
          </button>
        </LiquidGlass>
      </div>

      <p className="font-organic mt-4 text-center text-2xl text-fg-muted sm:text-3xl">
        drag or use the arrows <span aria-hidden className="text-red">·</span> click a page to open it
      </p>

      {/* the same projects as plain links for keyboard and screen-reader users */}
      <nav aria-label="All projects in the carousel" className="sr-only focus-within:not-sr-only focus-within:mt-4">
        <ul>
          {projects.map((p) => (
            <li key={p.slug}>
              <FlowLink href={p.href}>{p.title}</FlowLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
