import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { RetrievalLab } from "@/components/lab/RetrievalLab";
import { Section } from "@/components/ui/Section";
import { FlowLink } from "@/components/flow/FlowLink";
import { InView } from "@/components/motion/Reveal";
import { projects } from "@/content/projects";

export const metadata: Metadata = {
  title: "Lab",
  description: "Interactive AI engineering demos: hybrid retrieval with BM25, in-browser embeddings, rank fusion and graph expansion, plus algorithm reimplementations.",
  alternates: { canonical: "/lab" },
};

export default function LabPage() {
  const demos = projects.filter((p) => p.demo);
  return (
    <>
      <Section
        title="Retrieval lab"
        intro="Ask a question about my work and watch how a RAG system would find the context: keyword search, embedding search, the fusion of both, and a graph step that pulls in related work through shared entities."
        className="pt-36"
      >
        <RetrievalLab />
      </Section>

      <Section title="Algorithm demos" intro="Each runs in your browser and reimplements a repository's notebook or C++ code. Where the notebook recorded results, the demo is tested against them.">
        <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((p, i) => (
            <li key={p.slug} className="border-t border-line py-5">
              <InView delay={0.03 * (i % 3)}>
                <FlowLink href={`/work/${p.slug}#demo`} className="group flex items-start justify-between gap-4">
                  <span>
                    <span className="block text-fg group-hover:text-accent">{p.title}</span>
                    <span className="mt-1 block text-sm text-fg-muted">{p.tagline}</span>
                  </span>
                  <ArrowUpRight size={16} aria-hidden className="mt-1 shrink-0 text-fg-faint group-hover:text-accent" />
                </FlowLink>
              </InView>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
