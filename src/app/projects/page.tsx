import type { Metadata } from "next";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { archive, projects, repoUrl, resumeProjects } from "@/content/projects";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { ProjectIndex } from "@/components/projects/ProjectIndex";
import { HashScroll } from "@/components/projects/HashScroll";
import { InView } from "@/components/motion/Reveal";
import { Tag } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Projects",
  description: "Every project in detail: the problem, the approach, the architecture, recorded results, and live demos.",
  alternates: { canonical: "/projects" },
};

const featured = projects.filter((p) => p.tier !== "archive");

export default function ProjectsPage() {
  const index = featured.map(({ slug, title }) => ({ slug, title }));
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-36 pb-24 sm:px-6 lg:px-10">
      <HashScroll />
      <InView>
        <h1 className="font-display max-w-3xl text-5xl leading-[1.02] tracking-tight text-fg sm:text-6xl md:text-7xl">Projects</h1>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-fg-muted">
          Every project in detail: the problem, how I approached it, how it is built, and what it achieved. Results are quoted from the notebooks and READMEs that recorded them, and the demos run in your browser.
        </p>
      </InView>

      {/* on phones the index folds away */}
      <details className="mt-8 rounded-card border border-line lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm text-fg">Jump to a project ({featured.length})</summary>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
          <ProjectIndex items={index} />
        </div>
      </details>

      <div className="mt-12 grid gap-12 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Projects on this page" className="hidden lg:block">
          <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
            <ProjectIndex items={index} />
          </div>
        </nav>
        <div className="min-w-0">
          {featured.map((p, i) => (
            <ProjectDetail key={p.slug} p={p} index={i} total={featured.length} />
          ))}

          <section aria-labelledby="coursework-title" className="border-t border-line pt-12">
            <h2 id="coursework-title" className="font-display text-3xl text-fg sm:text-4xl">
              Coursework and smaller projects
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm text-fg-muted">Earlier university and practice work, kept for completeness.</p>
            <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {archive.map((p) => {
                const repo = repoUrl(p);
                return (
                  <li key={p.slug} id={p.slug} className="scroll-mt-28 rounded-card border border-line bg-bg-raised p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl text-fg">{p.title}</h3>
                      {repo ? (
                        <a href={repo} target="_blank" rel="noreferrer" aria-label={`${p.title} repository`} className="shrink-0 text-fg-faint hover:text-fg">
                          <GithubLogo size={18} aria-hidden />
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{p.tagline}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.tech.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="private-title" className="mt-16 border-t border-line pt-12">
            <h2 id="private-title" className="font-display text-3xl text-fg sm:text-4xl">
              Also on the resume
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm text-fg-muted">Projects whose code is not public. Described from the resume only.</p>
            <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {resumeProjects.map((p) => (
                <li key={p.title} className="rounded-card border border-line bg-bg-raised p-5">
                  <h3 className="font-display text-xl text-fg">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{p.text}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tech.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
