"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DemoKey } from "@/content/projects";
import { Skeleton } from "@/components/ui/primitives";

const loading = () => <Skeleton className="h-[420px] w-full rounded-card" />;

// Each demo is split into its own chunk and only loaded on pages that render it.
const demos: Record<DemoKey, ComponentType> = {
  "lazy-snapping": dynamic(() => import("./lazy-snapping"), { ssr: false, loading }),
  "face-knn": dynamic(() => import("./face-knn"), { ssr: false, loading }),
  perceptron: dynamic(() => import("./perceptron"), { ssr: false, loading }),
  convolution: dynamic(() => import("./convolution"), { ssr: false, loading }),
  cryptarithm: dynamic(() => import("./cryptarithm"), { ssr: false, loading }),
  bakery: dynamic(() => import("./bakery"), { ssr: false, loading }),
  bridge: dynamic(() => import("./bridge"), { ssr: false, loading }),
  "btc-forecast": dynamic(() => import("./btc-forecast"), { ssr: false, loading }),
  "urdu-segmenter": dynamic(() => import("./urdu-segmenter"), { ssr: false, loading }),
};

export function Demo({ id }: { id: DemoKey }) {
  const C = demos[id];
  return <C />;
}
