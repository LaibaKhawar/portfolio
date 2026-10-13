import type { ReactNode } from "react";
import { cx } from "./primitives";
import { InView } from "@/components/motion/Reveal";

export function Section({ id, title, intro, children, className }: { id?: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cx("mx-auto w-full max-w-[1400px] scroll-mt-20 px-4 py-14 sm:px-6 md:py-20 lg:px-10", className)}>
      <InView>
        <h2 id={id ? `${id}-title` : undefined} className="font-display max-w-3xl text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl md:text-6xl">
          {title}
        </h2>
        {intro ? <div className="mt-4 max-w-[62ch] text-base leading-relaxed text-fg-muted">{intro}</div> : null}
      </InView>
      <div className="mt-8 md:mt-10">{children}</div>
    </section>
  );
}
