import Link from "next/link";
import { ArrowRight, Certificate, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { ProjectsBand } from "@/components/sections/ProjectsBand";
import { CharacterIntro } from "@/components/intro/CharacterIntro";
import { BackToTop } from "@/components/shell/BackToTop";
import { Section } from "@/components/ui/Section";
import { ProjectCard } from "@/components/work/ProjectCard";
import { SystemsExplorer } from "@/components/systems/SystemsExplorer";
import { ExperienceTimeline } from "@/components/sections/ExperienceTimeline";
import { SkillsExplorer } from "@/components/sections/SkillsExplorer";
import { ContactForm } from "@/components/sections/ContactForm";
import { InView } from "@/components/motion/Reveal";
import { FlowLink } from "@/components/flow/FlowLink";
import { buttonClass } from "@/components/ui/primitives";
import { caseStudies, cards, projects } from "@/content/projects";
import { certifications, education, profile } from "@/content/profile";

export default function Home() {
  const demoCards = cards.filter((p) => p.demo);
  const publicCount = projects.filter((p) => p.repo).length;

  return (
    <>
      <CharacterIntro />
      <BackToTop />
      <ProjectsBand />

      <Section
        id="systems"
        title="Inside the systems"
        intro="The same projects, opened up. Pick one to trace how data moves between its components."
      >
        <SystemsExplorer items={caseStudies.filter((p) => p.architecture).map(({ slug, title, tagline, architecture }) => ({ slug, title, tagline, architecture }))} />
      </Section>

      <Section
        id="demos"
        title="Run the algorithms"
        intro="Faithful in-browser reimplementations of notebook projects, running on the original datasets where the repository includes them."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {demoCards.map((p, i) => (
            <InView key={p.slug} delay={0.04 * (i % 3)}>
              <ProjectCard p={p} className="h-full" />
            </InView>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <FlowLink href="/work" className={buttonClass("ghost")}>
            All {publicCount} public projects <ArrowRight size={16} aria-hidden />
          </FlowLink>
          <FlowLink href="/lab" className={buttonClass("quiet")}>
            Open the retrieval lab
          </FlowLink>
        </div>
      </Section>

      <Section id="experience" title="Experience" intro="Production LLM and NLP platforms, graph-based customer memory, and the teaching and internship work before that.">
        <ExperienceTimeline />
      </Section>

      <Section
        id="about"
        title="How I work"
        intro={
          <>
            <p>{profile.summary}</p>
            <p className="mt-4">
              Across these roles the common thread is the system around the model: retrieval scoped to the right customer or document, evaluation that goes beyond exact matching (NLI, semantic similarity, LLM judges), and long-running pipelines made resumable with checkpoints.
            </p>
          </>
        }
      >
        <SkillsExplorer />
      </Section>

      <section aria-labelledby="edu-title" className="mx-auto w-full max-w-[1400px] px-4 pb-24 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 border-t border-line pt-14 md:grid-cols-2">
          <InView>
            <h2 id="edu-title" className="font-display flex items-center gap-2.5 text-3xl text-fg">
              <GraduationCap size={22} className="text-accent" aria-hidden /> Education
            </h2>
            <ul className="mt-6 grid gap-6">
              {education.map((e) => (
                <li key={e.title}>
                  <div className="text-fg">{e.title}</div>
                  <div className="mt-0.5 text-sm text-fg-muted">
                    {e.place}
                    {e.period ? `, ${e.period}` : ""}
                  </div>
                  {e.note ? <div className="mt-1 text-sm text-accent">{e.note}</div> : null}
                </li>
              ))}
            </ul>
          </InView>
          <InView delay={0.05}>
            <h2 className="font-display flex items-center gap-2.5 text-3xl text-fg">
              <Certificate size={22} className="text-accent" aria-hidden /> Certifications
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {certifications.map((c) => (
                <li key={c.name} className="rounded-input border border-line px-4 py-3">
                  <div className="text-sm text-fg">{c.name}</div>
                  <div className="mt-0.5 text-xs text-fg-faint">{c.issuer}</div>
                </li>
              ))}
            </ul>
          </InView>
        </div>
      </section>

      <Section id="contact" title="Get in touch" intro="Questions about a project, a role, or something to build together. Email is the fastest way to reach me." className="pb-32">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <InView className="grid content-start gap-6">
            <dl className="grid gap-5 text-sm">
              <div>
                <dt className="text-fg-faint">Email</dt>
                <dd className="mt-1">
                  <a className="text-fg underline-offset-4 hover:underline" href={`mailto:${profile.email}`}>
                    {profile.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-fg-faint">Based in</dt>
                <dd className="mt-1 text-fg">{profile.location}</dd>
              </div>
              <div>
                <dt className="text-fg-faint">Elsewhere</dt>
                <dd className="mt-1 flex flex-wrap gap-4">
                  <a className="text-fg-muted hover:text-fg" href={profile.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                  <a className="text-fg-muted hover:text-fg" href={profile.github} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                  <Link className="text-fg-muted hover:text-fg" href={profile.resume} target="_blank">
                    Resume (PDF)
                  </Link>
                </dd>
              </div>
            </dl>
          </InView>
          <InView delay={0.05}>
            <ContactForm />
          </InView>
        </div>
      </Section>
    </>
  );
}
