"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import { GITHUB, allCategories, archive, caseStudies, cards, type Category } from "@/content/projects";
import { Chip } from "@/components/ui/primitives";
import { FlowLink } from "@/components/flow/FlowLink";
import { ProjectCard } from "./ProjectCard";

export function Gallery() {
  const [cat, setCat] = useState<Category | "All">("All");
  const match = useMemo(() => (cat === "All" ? () => true : (c: Category[]) => c.includes(cat)), [cat]);
  const shown = [...caseStudies, ...cards].filter((p) => match(p.categories));
  const shownArchive = archive.filter((p) => match(p.categories));

  return (
    <div className="grid gap-14">
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
        {(["All", ...allCategories] as const).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {shown.length + shownArchive.length} projects shown
      </p>

      <h2 className="sr-only">Projects</h2>
      {shown.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.slug} p={p} className="h-full" />
          ))}
        </div>
      ) : null}

      {shownArchive.length ? (
        <div>
          <h2 className="font-display text-3xl text-fg">Coursework and earlier projects</h2>
          <p className="mt-2 max-w-[62ch] text-sm text-fg-muted">Smaller assignments and experiments, kept for completeness. Each links to its repository.</p>
          <ul className="mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {shownArchive.map((p) => (
              <li key={p.slug} className="border-t border-line py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <FlowLink href={`/work/${p.slug}`} className="text-fg hover:text-accent">
                      {p.title}
                    </FlowLink>
                    <p className="mt-1 text-sm text-fg-muted">{p.tagline}</p>
                    <p className="mt-1.5 font-mono text-[11px] text-fg-faint">{p.tech.join(" · ")}</p>
                  </div>
                  {p.repo ? (
                    <a href={`${GITHUB}/${p.repo}`} target="_blank" rel="noreferrer" aria-label={`${p.title} on GitHub`} className="mt-0.5 shrink-0 text-fg-faint hover:text-fg">
                      <GithubLogo size={18} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!shown.length && !shownArchive.length ? (
        <div className="rounded-card border border-line p-8 text-center">
          <p className="text-fg">No projects in this category yet.</p>
          <button type="button" className="mt-3 text-sm text-accent hover:underline" onClick={() => setCat("All")}>
            Show all projects
          </button>
        </div>
      ) : null}

      <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        Everything on GitHub <ArrowUpRight size={14} aria-hidden />
      </a>
    </div>
  );
}
