import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { repoUrl, type Project } from "@/content/projects";
import { ArchitectureDiagram } from "@/components/systems/ArchitectureDiagram";
import { Demo } from "@/components/demos/registry";
import { LazyMount } from "@/components/projects/LazyMount";
import { Tag, buttonClass } from "@/components/ui/primitives";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line pt-6 md:grid-cols-[180px_1fr] md:gap-10">
      <h3 className="text-sm font-medium text-fg-muted">{title}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid max-w-[70ch] gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-3 leading-relaxed text-fg-muted">
          <span aria-hidden className="mt-3 h-px w-3 shrink-0 bg-accent/70" />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Prose({ text }: { text: string }) {
  return <p className="max-w-[70ch] leading-relaxed text-fg-muted">{text}</p>;
}

/** One project, explained in full: the target of every project link on the site. */
export function ProjectDetail({ p, index, total }: { p: Project; index: number; total: number }) {
  const repo = repoUrl(p);
  return (
    <section id={p.slug} aria-labelledby={`${p.slug}-title`} className="scroll-mt-28 border-t border-line pt-12 pb-16 first:border-t-0 first:pt-0">
      <header className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-accent">
            <span className="text-fg-faint">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            {p.categories.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <h2 id={`${p.slug}-title`} className="font-display mt-3 text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl">
            {p.title}
          </h2>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-fg-muted">{p.tagline}</p>
        </div>
        <div className="grid gap-3 lg:justify-items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {p.liveUrl ? (
              <a href={p.liveUrl} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
                Live app <ArrowUpRight size={14} aria-hidden />
              </a>
            ) : null}
            {repo ? (
              <a href={repo} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
                <GithubLogo size={16} aria-hidden /> Repository
              </a>
            ) : null}
          </div>
          <p className="max-w-sm text-sm text-fg-faint lg:text-right">{p.repoNote ?? p.status}</p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {p.tech.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      {p.video ? (
        <div className="mt-8">
          <video controls preload="none" poster={p.video.poster} className="w-full rounded-card border border-line bg-bg-raised" aria-label={p.video.label}>
            <source src={p.video.src} type="video/mp4" />
            Your browser cannot play this video.
          </video>
          <p className="mt-2 text-xs text-fg-faint">{p.video.label}</p>
        </div>
      ) : p.cover ? (
        <div className="relative mt-8 aspect-[16/8] overflow-hidden rounded-card border border-line bg-bg-raised">
          <Image src={p.cover.src} alt={p.cover.alt} fill sizes="(min-width: 1400px) 1000px, 100vw" className="object-contain" />
        </div>
      ) : null}

      {p.gallery?.length ? (
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {p.gallery.map((g) => (
            <figure key={g.src}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-card border border-line bg-bg-raised">
                <Image src={g.src} alt={g.alt} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover object-top" />
              </div>
              {g.caption ? <figcaption className="mt-2 text-sm text-fg-faint">{g.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-8">
        {p.overview ? (
          <Block title="Overview">
            <Prose text={p.overview} />
          </Block>
        ) : null}
        {p.problem ? (
          <Block title="Problem">
            <Prose text={p.problem} />
          </Block>
        ) : null}
        {p.solution ? (
          <Block title="Approach">
            <Prose text={p.solution} />
          </Block>
        ) : null}
        {p.features?.length ? (
          <Block title="What it does">
            <List items={p.features} />
          </Block>
        ) : null}
        {p.architecture ? (
          <Block title="Architecture">
            <LazyMount minHeight={420}>
              <ArchitectureDiagram title={p.title} nodes={p.architecture.nodes} edges={p.architecture.edges} height={380} />
            </LazyMount>
          </Block>
        ) : null}
        {p.demo ? (
          <Block title="Interactive demo">
            <div className="grid gap-3">
              {p.demoNote ? <p className="max-w-[70ch] text-sm leading-relaxed text-fg-muted">{p.demoNote}</p> : null}
              <LazyMount minHeight={420}>
                <Demo id={p.demo} />
              </LazyMount>
            </div>
          </Block>
        ) : null}
        {p.results?.length ? (
          <Block title="Recorded results">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {p.results.map((r) => (
                <div key={r.label} className="rounded-card border border-line bg-bg-raised p-5">
                  <dt className="text-xs text-fg-faint">{r.label}</dt>
                  <dd className="mt-2 font-mono text-2xl text-fg tabular-nums">{r.value}</dd>
                  <dd className="mt-2 text-sm text-fg-muted">{r.context}</dd>
                  <dd className="mt-3 font-mono text-[11px] text-fg-faint">Source: {r.source}</dd>
                </div>
              ))}
            </dl>
          </Block>
        ) : null}
        {p.challenges?.length ? (
          <Block title="Technical challenges">
            <List items={p.challenges} />
          </Block>
        ) : null}
        {p.decisions?.length ? (
          <Block title="Engineering decisions">
            <List items={p.decisions} />
          </Block>
        ) : null}
        {p.limitations?.length ? (
          <Block title="Limitations">
            <List items={p.limitations} />
          </Block>
        ) : null}
      </div>
    </section>
  );
}
