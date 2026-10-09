"use client";

import { useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { Project } from "@/content/projects";
import { Chip } from "@/components/ui/primitives";
import { FlowLink } from "@/components/flow/FlowLink";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

type Item = Pick<Project, "slug" | "title" | "tagline" | "architecture">;

export function SystemsExplorer({ items }: { items: Item[] }) {
  const [slug, setSlug] = useState(items[0]?.slug);
  const current = items.find((i) => i.slug === slug) ?? items[0];
  if (!current?.architecture) return null;
  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Choose a system" className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Chip key={i.slug} role="tab" aria-pressed={undefined} aria-selected={i.slug === current.slug} active={i.slug === current.slug} onClick={() => setSlug(i.slug)}>
            {i.title}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" aria-label={current.title} className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="max-w-2xl text-sm text-fg-muted">{current.tagline}</p>
          <FlowLink href={`/work/${current.slug}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
            Read the case study <ArrowUpRight size={14} aria-hidden />
          </FlowLink>
        </div>
        <ArchitectureDiagram key={current.slug} title={current.title} nodes={current.architecture.nodes} edges={current.architecture.edges} height={360} />
      </div>
    </div>
  );
}
