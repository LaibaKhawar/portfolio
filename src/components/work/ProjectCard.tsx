"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowUpRight, Play } from "@phosphor-icons/react";
import type { Project } from "@/content/projects";
import { FlowLink } from "@/components/flow/FlowLink";
import { Tag, cx } from "@/components/ui/primitives";

/** Ordered stage labels from a project's architecture, used as a compact pipeline preview. */
function pipeline(p: Project) {
  if (!p.architecture) return [];
  const byStage = new Map<number, string[]>();
  for (const n of p.architecture.nodes) byStage.set(n.stage, [...(byStage.get(n.stage) ?? []), n.label]);
  return [...byStage.entries()].sort((a, b) => a[0] - b[0]).map(([, labels]) => labels);
}

function PipelinePreview({ p }: { p: Project }) {
  const stages = pipeline(p);
  return (
    <div aria-hidden className="relative flex h-full min-h-[180px] items-center overflow-hidden px-5">
      <div className="absolute inset-x-5 top-1/2 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      <div className="absolute top-1/2 left-0 h-px w-1/3 -translate-y-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-500 group-hover:animate-[sweep_1.6s_ease-in-out_infinite] group-hover:opacity-100" />
      <ol className="relative flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:flex-nowrap sm:justify-between">
        {stages.map((labels, i) => (
          <li key={i} className="flex flex-col items-center gap-1.5">
            {labels.slice(0, 3).map((l) => (
              <span key={l} className="rounded-input border border-line bg-bg px-2 py-1 font-mono text-[10px] whitespace-nowrap text-fg-muted transition-colors group-hover:border-line-strong">
                {l}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProjectCard({ p, size = "standard", className }: { p: Project; size?: "feature" | "standard"; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <article ref={ref} className={cx("group relative flex flex-col overflow-hidden rounded-card border border-line bg-bg-raised transition-colors hover:border-red/60", className)}>
      <div className={cx("relative overflow-hidden border-b border-line bg-bg", size === "feature" ? "aspect-[16/8] lg:aspect-auto lg:min-h-[320px] lg:flex-1" : "aspect-[16/9]")}>
        {p.cover ? (
          <Image
            src={p.cover.src}
            alt={p.cover.alt}
            fill
            sizes={size === "feature" ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, 100vw"}
            className="object-cover opacity-85 transition-[transform,opacity] duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
          />
        ) : (
          <PipelinePreview p={p} />
        )}
        {p.demo ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-bg/80 px-2.5 py-1 text-[11px] text-accent backdrop-blur">
            <Play size={10} weight="fill" aria-hidden /> Live demo
          </span>
        ) : null}
        {/* the flow begins here and leaves the card when you open it */}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-red transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-x-100" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-fg-faint">
          {p.categories.slice(0, 2).map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <h3 className={cx("font-medium tracking-tight text-fg", size === "feature" ? "text-2xl" : "text-lg")}>
          <FlowLink href={`/work/${p.slug}`} originRef={ref} className="after:absolute after:inset-0 after:content-['']">
            {p.title}
          </FlowLink>
        </h3>
        <p className="text-sm leading-relaxed text-fg-muted">{p.tagline}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {p.tech.slice(0, size === "feature" ? 6 : 4).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
          <ArrowUpRight size={16} aria-hidden className="ml-auto text-fg-faint transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-red" />
        </div>
      </div>
    </article>
  );
}
