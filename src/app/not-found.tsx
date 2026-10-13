import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <section className="mx-auto grid min-h-[70dvh] max-w-[1400px] content-center px-4 pt-24 sm:px-6 lg:px-10">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="font-display mt-3 text-5xl tracking-tight text-fg">Nothing is stored at this address.</h1>
      <p className="mt-3 max-w-[56ch] text-fg-muted">The page may have moved. The projects page lists everything.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/projects" className={buttonClass("primary")}>
          See all projects
        </Link>
        <Link href="/" className={buttonClass("ghost")}>
          Home
        </Link>
      </div>
    </section>
  );
}
