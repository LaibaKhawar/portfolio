"use client";

import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import { motion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import { experience } from "@/content/profile";
import { InView } from "@/components/motion/Reveal";
import { Tag } from "@/components/ui/primitives";

export function ExperienceTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <ol ref={ref} className="relative grid gap-14 pl-8 md:pl-0">
      {/* rail: static line, plus a blue flow that fills with scroll */}
      <div aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-line md:left-[calc(25%+5px)]" />
      <motion.div
        aria-hidden
        className="absolute top-2 bottom-2 left-[5px] w-px origin-top bg-gradient-to-b from-accent via-accent to-accent/0 md:left-[calc(25%+5px)]"
        style={{ scaleY: reduce ? 1 : progress }}
      />
      {experience.map((r) => (
        <li key={r.company} className="relative grid gap-3 md:grid-cols-[25%_1fr] md:gap-10">
          <span aria-hidden className="absolute top-1.5 -left-8 size-[11px] rounded-full border-2 border-red bg-bg md:left-[25%]" />
          <div className="font-mono text-xs text-fg-faint md:pt-1 md:pr-8 md:text-right">
            {r.start} to {r.end}
            <div className="mt-1 hidden md:block">{r.location}</div>
          </div>
          <InView className="md:pl-8">
            <h3 className="text-xl font-medium tracking-tight text-fg">
              {r.title}
              <span className="text-fg-muted">, {r.company}</span>
            </h3>
            <p className="mt-3 max-w-[68ch] leading-relaxed text-fg-muted">{r.summary}</p>
            {r.points.length ? (
              <ul className="mt-4 grid max-w-[68ch] gap-2">
                {r.points.map((pt) => (
                  <li key={pt} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
                    <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-accent/70" />
                    {pt}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-1.5">
              {r.stack.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
          </InView>
        </li>
      ))}
    </ol>
  );
}
