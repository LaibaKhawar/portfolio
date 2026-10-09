"use client";

import { useMemo, useState } from "react";
import { experience, skillGroups } from "@/content/profile";
import { projects } from "@/content/projects";
import { FlowLink } from "@/components/flow/FlowLink";
import { cx } from "@/components/ui/primitives";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Map a skill to the roles and projects whose stack mentions it.
function usage(skill: string) {
  const k = norm(skill);
  const hit = (t: string) => {
    const n = norm(t);
    return n === k || (k.length > 3 && (n.includes(k) || k.includes(n) && n.length > 3));
  };
  return {
    roles: experience.filter((r) => r.stack.some(hit) || r.points.some((p) => norm(p).includes(k) && k.length > 3)).map((r) => r.company),
    projects: projects.filter((p) => p.tier !== "archive" && p.tech.some(hit)).map((p) => ({ slug: p.slug, title: p.title })),
  };
}

export function SkillsExplorer() {
  const [selected, setSelected] = useState<string | null>("pgvector");
  const used = useMemo(() => (selected ? usage(selected) : null), [selected]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {skillGroups.map((g) => (
          <div key={g.name}>
            <h3 className="text-sm font-medium text-fg">{g.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-faint">{g.blurb}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {g.items.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    aria-pressed={selected === s}
                    onClick={() => setSelected((c) => (c === s ? null : s))}
                    className={cx(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      selected === s ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <aside aria-live="polite" className="self-start rounded-card border border-line bg-bg-raised p-5 lg:sticky lg:top-24">
        {selected && used ? (
          <>
            <div className="font-mono text-xs text-accent">{selected}</div>
            <div className="mt-4 text-xs text-fg-faint">Used at</div>
            <p className="mt-1 text-sm text-fg">{used.roles.length ? used.roles.join(", ") : "Not tied to a listed role"}</p>
            <div className="mt-4 text-xs text-fg-faint">In projects</div>
            {used.projects.length ? (
              <ul className="mt-1 grid gap-1">
                {used.projects.map((p) => (
                  <li key={p.slug}>
                    <FlowLink href={`/work/${p.slug}`} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                      {p.title}
                    </FlowLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-fg-muted">
                {used.roles.length ? "Used in professional work rather than public projects." : "Listed on the resume; no public project uses it yet."}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-fg-muted">Select a skill to see where it was used.</p>
        )}
      </aside>
    </div>
  );
}
