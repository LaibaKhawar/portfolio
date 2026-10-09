import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { getProject, projects, repoUrl } from "@/content/projects";
import { ArchitectureDiagram } from "@/components/systems/ArchitectureDiagram";
import { Demo } from "@/components/demos/registry";
import { FlowLink } from "@/components/flow/FlowLink";
import { InView, WordReveal } from "@/components/motion/Reveal";
import { Skeleton, Tag, buttonClass } from "@/components/ui/primitives";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.tagline,
    alternates: { canonical: `/work/${p.slug}` },
    openGraph: { title: p.title, description: p.tagline, type: "article", images: p.cover ? [{ url: p.cover.src, alt: p.cover.alt }] : undefined },
  };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <InView className="grid gap-4 border-t border-line pt-10 md:grid-cols-[220px_1fr] md:gap-10">
      <h2 className="text-sm font-medium text-fg-muted">{title}</h2>
      <div className="min-w-0">{children}</div>
    </InView>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid max-w-[70ch] gap-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 leading-relaxed text-fg-muted">
          <span aria-hidden className="mt-3 h-px w-3 shrink-0 bg-accent/70" />
          {t}
        </li>
      ))}
    </ul>
  );
}

// `params` resolves inside Suspense so the shell can render (and prefetch) instantly.
export default function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  return (
    <Suspense fallback={<CaseStudySkeleton />}>
      {params.then(({ slug }) => (
        <CaseStudy slug={slug} />
      ))}
    </Suspense>
  );
}

function CaseStudySkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 pt-32 pb-24 sm:px-6 lg:px-10" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="mt-6 aspect-[16/8] w-full rounded-card" />
    </div>
  );
}

function CaseStudy({ slug }: { slug: string }) {
  const p = getProject(slug);
  if (!p) notFound();
  const repo = repoUrl(p);
  const idx = projects.filter((x) => x.tier !== "archive").findIndex((x) => x.slug === p.slug);
  const featured = projects.filter((x) => x.tier !== "archive");
  const next = idx >= 0 ? featured[(idx + 1) % featured.length] : featured[0];

  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 pt-32 pb-24 sm:px-6 lg:px-10">
      <FlowLink href="/work" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={14} aria-hidden /> All work
      </FlowLink>

      <header className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-accent">
            {p.categories.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <WordReveal as="h1" text={p.title} className="mt-4 block text-4xl leading-[1.05] font-semibold tracking-tighter text-fg sm:text-5xl md:text-6xl" />
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-fg-muted">{p.tagline}</p>
        </div>
        <div className="grid gap-4 lg:justify-items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {p.demo ? (
              <a href="#demo" className={buttonClass("primary")}>
                Try the demo
              </a>
            ) : null}
            {p.liveUrl ? (
              <a href={p.liveUrl} target="_blank" rel="noreferrer" className={buttonClass(p.demo ? "ghost" : "primary")}>
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

      <div className="mt-8 flex flex-wrap gap-1.5">
        {p.tech.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      {p.video ? (
        <InView className="mt-12">
          <video controls preload="none" poster={p.video.poster} className="w-full rounded-card border border-line bg-bg-raised" aria-label={p.video.label}>
            <source src={p.video.src} type="video/mp4" />
            Your browser cannot play this video.
          </video>
          <p className="mt-2 text-xs text-fg-faint">{p.video.label}</p>
        </InView>
      ) : p.cover ? (
        <InView className="relative mt-12 aspect-[16/8] overflow-hidden rounded-card border border-line bg-bg-raised">
          <Image src={p.cover.src} alt={p.cover.alt} fill priority sizes="(min-width: 1400px) 1320px, 100vw" className="object-contain" />
        </InView>
      ) : null}

      <div className="mt-16 grid grid-cols-1 gap-14">
        {p.overview ? (
          <Block title="Overview">
            <div className="prose-case">
              <p>{p.overview}</p>
            </div>
          </Block>
        ) : null}
        {p.problem ? (
          <Block title="Problem">
            <div className="prose-case">
              <p>{p.problem}</p>
            </div>
          </Block>
        ) : null}
        {p.solution ? (
          <Block title="Approach">
            <div className="prose-case">
              <p>{p.solution}</p>
            </div>
          </Block>
        ) : null}
        {p.architecture ? (
          <Block title="Architecture">
            <ArchitectureDiagram title={p.title} nodes={p.architecture.nodes} edges={p.architecture.edges} height={380} />
          </Block>
        ) : null}
        {p.demo ? (
          <div id="demo" className="scroll-mt-24">
            <Block title="Interactive demo">
              <div className="grid gap-3">
                {p.demoNote ? <p className="max-w-[70ch] text-sm leading-relaxed text-fg-muted">{p.demoNote}</p> : null}
                <Demo id={p.demo} />
              </div>
            </Block>
          </div>
        ) : null}
        {p.features?.length ? (
          <Block title="What it does">
            <List items={p.features} />
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
        {p.limitations?.length ? (
          <Block title="Limitations">
            <List items={p.limitations} />
          </Block>
        ) : null}
      </div>

      {next && next.slug !== p.slug ? (
        <nav aria-label="Next project" className="mt-24 border-t border-line pt-10">
          <div className="text-xs text-fg-faint">Next project</div>
          <FlowLink href={`/work/${next.slug}`} className="group mt-3 inline-flex items-center gap-3 text-3xl font-semibold tracking-tighter text-fg hover:text-accent sm:text-4xl">
            {next.title}
            <ArrowUpRight size={28} aria-hidden className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </FlowLink>
        </nav>
      ) : null}
    </article>
  );
}
