import Link from "next/link";
import { ArrowUpRight, EnvelopeSimple, FileText, GithubLogo, LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { education, experience, profile } from "@/content/profile";
import { caseStudies, projects } from "@/content/projects";
import { MagazineCorridor, type CorridorProject } from "@/components/magazine/MagazineCorridor";
import { FlowLink } from "@/components/flow/FlowLink";
import { InView, WordReveal } from "@/components/motion/Reveal";
import { buttonClass, iconButtonClass } from "@/components/ui/primitives";
import { projectHref } from "@/lib/links";

// Serializable page data for the corridor: every case study and card, newest first.
const corridorProjects: CorridorProject[] = projects
  .filter((p) => p.tier !== "archive")
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    categories: p.categories,
    tech: p.tech,
    // compact copies made for the carousel (public/projects/thumbs); case studies use the originals
    cover: p.cover ? { src: `/projects/thumbs/${p.cover.src.split("/").pop()!.replace(/\.\w+$/, "")}.jpg` } : undefined,
    demo: p.demo,
    liveUrl: p.liveUrl,
    href: projectHref(p.slug),
  }));

// Systems a recruiter should see first. Professional work links to the experience
// timeline (code is not public); personal projects link to their case studies.
const shipped = [
  { name: "Customer Memory Graph", where: "Hyperengage, at Dataspecc", href: "/#experience" },
  { name: "PVS-LLM report intelligence", where: "SysReforms International", href: "/#experience" },
  { name: "AnalystOS", where: "Autonomous data analyst, verified numbers", href: projectHref("analystos") },
  { name: "Veriflow agent platform", where: "Seven agents, evidence-verified claims", href: projectHref("veriflow") },
  { name: "Voice AI patient registration", where: "Phone agent, Vapi + FastAPI", href: projectHref("voice-patient-registration") },
  { name: "EDIConnect", where: "Final-year project, LLaMA 3.1", href: projectHref("ediconnect") },
];

const degree = education[0];
const demoCount = projects.filter((p) => p.demo).length;

/** The dark band the intro portal opens onto: a recruiter-first introduction, then the projects. */
export function ProjectsBand() {
  return (
    <section id="work" aria-labelledby="band-title" className="theme-ink relative -mt-px rounded-b-[40px] pt-24 pb-14 md:rounded-b-[88px] md:pt-28">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
        {/* who, what, and how to reach */}
        <div className="lg:col-span-7">
          <p className="font-mono text-xs tracking-[0.18em] text-fg-faint uppercase">
            {profile.role} · {profile.location}
          </p>
          <h1 id="band-title" className="font-display mt-4 text-6xl leading-[0.95] tracking-tight text-cream sm:text-7xl lg:text-8xl">
            <WordReveal text={profile.name} />
          </h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-fg-muted sm:text-xl">
            I build LLM applications and autonomous agents that show their work: a customer-memory graph for Hyperengage, PVS-LLM pipelines at SysReforms, a data-analyst agent that verifies every number, and a voice agent that registers patients by phone.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <a href={profile.resume} target="_blank" rel="noreferrer" className={buttonClass("primary", "px-5 py-2.5 sm:px-6 sm:py-3")}>
              <FileText size={16} aria-hidden /> Resume
            </a>
            <a href={`mailto:${profile.email}`} className={buttonClass("ghost", "px-4 py-2.5 sm:px-5 sm:py-3")}>
              <EnvelopeSimple size={16} aria-hidden /> Email me
            </a>
            <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub profile" className={iconButtonClass()}>
              <GithubLogo size={18} aria-hidden />
            </a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className={iconButtonClass()}>
              <LinkedinLogo size={18} aria-hidden />
            </a>
          </div>
        </div>

        {/* where I have worked, scannable at a glance */}
        <InView className="lg:col-span-5 lg:pt-10">
          <h2 className="text-sm text-fg-faint">Where I have worked</h2>
          <ol className="mt-3 divide-y divide-line rounded-card border border-line">
            {experience.map((r, i) => (
              <li key={r.company}>
                <Link href="/#experience" className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-fg/[0.04]">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-xl text-fg">{r.company}</span>
                      {i === 0 ? <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#2a2020] uppercase">Now</span> : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-fg-muted">{r.title}</span>
                  </span>
                  <span className="shrink-0 pt-1 font-mono text-[11px] text-fg-faint">
                    {r.start} to {r.end === "Present" ? "now" : r.end}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </InView>

        {/* what I have shipped */}
        <InView className="lg:col-span-12">
          <h2 className="text-sm text-fg-faint">Systems I have built</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shipped.map((s) => (
              <li key={s.name}>
                <FlowLink href={s.href} className="group flex h-full items-start justify-between gap-3 rounded-card border border-line px-4 py-3 transition-colors hover:border-red/70">
                  <span>
                    <span className="block text-[15px] font-medium text-fg">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-fg-faint">{s.where}</span>
                  </span>
                  <ArrowUpRight size={14} aria-hidden className="mt-1 shrink-0 text-fg-faint transition-colors group-hover:text-red" />
                </FlowLink>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
            {[
              [String(experience.length), "roles in AI, ML, and teaching"],
              [String(caseStudies.length), "in-depth case studies"],
              [String(demoCount + 1), "interactive demos you can run"],
              ["2×", `Dean's List, ${degree.title}`],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-4xl text-cream">{value}</dd>
                <dd className="mt-1 text-sm text-fg-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </InView>
      </div>

      <div className="mx-auto mt-14 w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <h2 className="font-display text-4xl text-cream sm:text-5xl">Projects</h2>
      </div>
      <div className="mx-auto mt-4 w-full max-w-[1600px] px-2 sm:px-4">
        <MagazineCorridor projects={corridorProjects} />
      </div>
    </section>
  );
}
