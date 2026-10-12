"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto grid min-h-[70dvh] max-w-[1400px] content-center px-4 pt-24 sm:px-6 lg:px-10">
      <h1 className="font-display text-4xl tracking-tight text-fg">This part of the page failed to load.</h1>
      <p className="mt-3 max-w-[56ch] text-fg-muted">The rest of the site still works. Trying again usually fixes it.</p>
      <div className="mt-8">
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </section>
  );
}
