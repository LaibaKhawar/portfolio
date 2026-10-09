import type { ReactNode } from "react";
import { cx } from "./primitives";
import { InView } from "@/components/motion/Reveal";

export function Section({ id, title, intro, children, className }: { id?: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cx("mx-auto w-full max-w-[1400px] scroll-mt-24 px-4 py-24 sm:px-6 md:py-32 lg:px-10", className)}>
      <InView>
        <h2 id={id ? `${id}-title` : undefined} className="max-w-3xl text-3xl font-semibold tracking-tighter text-fg sm:text-4xl md:text-5xl">
          {title}
        </h2>
        {intro ? <div className="mt-4 max-w-[62ch] text-base leading-relaxed text-fg-muted">{intro}</div> : null}
      </InView>
      <div className="mt-12 md:mt-16">{children}</div>
    </section>
  );
}
