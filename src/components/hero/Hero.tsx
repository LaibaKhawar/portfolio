"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowDownRight, FileText, GithubLogo, LinkedinLogo } from "@phosphor-icons/react";
import { profile } from "@/content/profile";
import { LiquidGlass } from "@/components/glass/LiquidGlass";
import { Magnetic } from "@/components/motion/Magnetic";
import { WordReveal } from "@/components/motion/Reveal";
import { buttonClass, cx } from "@/components/ui/primitives";
import { stages } from "./stages";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

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

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const webgl = useSyncExternalStore(noopSubscribe, hasWebGL, () => false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} aria-labelledby="hero-title" className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden pt-24">
      {/* 3D network: full-bleed behind the copy on mobile, right-weighted on desktop */}
      <div className="absolute inset-0 -z-10 md:left-[18%]">
        {webgl ? <HeroScene active={active} visible={visible} reduced={reduce} /> : null}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,transparent_30%,var(--bg)_78%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-bg via-bg/80 to-transparent md:w-1/2" />
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 content-center gap-10 px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-accent">{profile.role}</p>
          <h1 id="hero-title" className="text-5xl leading-[1.02] font-semibold tracking-tighter text-fg sm:text-6xl lg:text-7xl">
            <WordReveal text={profile.name} />
          </h1>
          <WordReveal
            as="p"
            delay={0.25}
            className="mt-5 block text-2xl leading-snug tracking-tight text-fg-muted sm:text-3xl"
            text="Building LLM systems that retrieve, reason, and verify."
          />
          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-fg-muted">
            Generative AI, RAG, graph memory, and agentic workflows, from model pipelines to production services.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <a href="#work" className={buttonClass("primary", "px-6 py-3")}>
                Explore projects <ArrowDownRight size={16} weight="bold" aria-hidden />
              </a>
            </Magnetic>
            <LiquidGlass radius={999} className="flex items-center gap-1 p-1">
              <a href={profile.resume} target="_blank" rel="noreferrer" className={buttonClass("quiet", "px-4 py-2 text-fg")}>
                <FileText size={16} aria-hidden /> View resume
              </a>
              <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub profile" className={buttonClass("quiet", "size-9 p-0 text-fg")}>
                <GithubLogo size={18} aria-hidden />
              </a>
              <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className={buttonClass("quiet", "size-9 p-0 text-fg")}>
                <LinkedinLogo size={18} aria-hidden />
              </a>
            </LiquidGlass>
          </div>
        </div>
      </div>

      {/* Stage legend: drives the highlight in the 3D network and explains it in words */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-3 border-t border-line pt-5 md:flex-row md:items-center md:justify-between">
          <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Stages of an LLM system">
            {stages.map((s, i) => (
              <li key={s.id} className="flex items-center">
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                  aria-pressed={active === i}
                  className={cx(
                    "rounded-full px-3 py-1.5 font-mono text-xs transition-colors",
                    active === i ? "bg-accent-soft text-accent" : "text-fg-faint hover:text-fg",
                  )}
                >
                  <span className="mr-1.5 text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </button>
                {i < stages.length - 1 ? <span aria-hidden className="mx-0.5 h-px w-3 bg-line-strong" /> : null}
              </li>
            ))}
          </ol>
          <p aria-live="polite" className="min-h-[1.25rem] max-w-md text-sm text-fg-muted md:text-right">
            {active !== null ? stages[active].detail : "Select a stage to trace it through the network."}
          </p>
        </div>
      </div>
    </section>
  );
}
