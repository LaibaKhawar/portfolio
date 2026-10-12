import type { Metadata } from "next";
import { Gallery } from "@/components/work/Gallery";
import { Section } from "@/components/ui/Section";
import { resumeProjects } from "@/content/projects";
import { Tag } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Work",
  description: "Projects in agentic AI, retrieval, NLP, computer vision, machine learning, data engineering, and systems.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
      <Section title="Work" intro="Every public project, grouped by area. Live demos run in your browser; results are quoted from the notebooks and READMEs that recorded them." className="pt-36">
        <Gallery />
      </Section>
      <section aria-labelledby="private-title" className="mx-auto w-full max-w-[1400px] px-4 pb-28 sm:px-6 lg:px-10">
        <h2 id="private-title" className="font-display border-t border-line pt-12 text-3xl text-fg">
          Also on the resume
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm text-fg-muted">Projects whose code is not public. Described from the resume only.</p>
        <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {resumeProjects.map((p) => (
            <li key={p.title} className="rounded-card border border-line bg-bg-raised p-5">
              <h3 className="font-display text-2xl text-fg">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.text}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tech.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
