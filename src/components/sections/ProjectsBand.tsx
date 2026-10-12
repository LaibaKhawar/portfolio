import { FileText, GithubLogo, LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { MagazineCorridor, type CorridorProject } from "@/components/magazine/MagazineCorridor";
import { WordReveal } from "@/components/motion/Reveal";
import { buttonClass, iconButtonClass } from "@/components/ui/primitives";

// Serializable page data for the corridor: every case study and card, newest first.
const corridorProjects: CorridorProject[] = projects
  .filter((p) => p.tier !== "archive")
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    categories: p.categories,
    tech: p.tech,
    cover: p.cover ? { src: p.cover.src } : undefined,
    demo: p.demo,
    liveUrl: p.liveUrl,
    href: `/work/${p.slug}`,
  }));

/** The navy band the intro portal opens onto: name, a short statement, and the projects. */
export function ProjectsBand() {
  return (
    <section id="work" aria-labelledby="band-title" className="theme-ink relative -mt-px scroll-mt-0 rounded-b-[40px] pt-24 pb-16 md:rounded-b-[88px] md:pt-28">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <h1 id="band-title" className="font-display text-6xl leading-[0.95] tracking-tight text-cream sm:text-7xl lg:text-8xl">
          <WordReveal text={profile.name} />
        </h1>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-[60ch] text-lg leading-relaxed text-fg-muted">
            {profile.role} building production LLM and NLP systems: retrieval-augmented generation, graph-based memory, automated evaluation, and agents, including one that registers patients over the phone.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={profile.resume} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
              <FileText size={16} aria-hidden /> Resume
            </a>
            <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub profile" className={iconButtonClass()}>
              <GithubLogo size={18} aria-hidden />
            </a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className={iconButtonClass()}>
              <LinkedinLogo size={18} aria-hidden />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[1600px] px-2 sm:px-4">
        <h2 className="sr-only">Projects</h2>
        <MagazineCorridor projects={corridorProjects} />
      </div>
    </section>
  );
}
