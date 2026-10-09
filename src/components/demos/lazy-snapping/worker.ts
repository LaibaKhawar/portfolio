// Runs the k-means colour models and per-pixel classification off the main thread.
import { MAX_ITER, N_CLUSTERS, classifyRange, fitModels } from "./logic";
import type { SegmentStats } from "./logic";

export interface SegmentRequest {
  id: number;
  image: Uint8ClampedArray;
  seeds: Uint8Array;
  w: number;
  h: number;
}

export type SegmentResponse =
  | { id: number; type: "progress"; phase: "kmeans" | "classify"; fraction: number }
  | { id: number; type: "done"; mask: Uint8Array; stats: SegmentStats; kmeansMs: number; classifyMs: number }
  | { id: number; type: "error"; message: string };

interface WorkerScope {
  onmessage: ((e: MessageEvent<SegmentRequest>) => void) | null;
  postMessage(msg: SegmentResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, image, seeds, w, h } = e.data;
  try {
    scope.postMessage({ id, type: "progress", phase: "kmeans", fraction: 0 });
    const t0 = performance.now();
    const { fg, bg, fgUsed, bgUsed, fgModel, bgModel } = fitModels(image, seeds, 0, N_CLUSTERS, MAX_ITER);
    if (fg.length === 0 || bg.length === 0) throw new Error("Paint at least one foreground and one background stroke.");
    const t1 = performance.now();
    const n = w * h;
    const mask = new Uint8Array(n);
    const cache = new Map<number, number>();
    const chunk = Math.max(1, Math.ceil(n / 20));
    for (let from = 0; from < n; from += chunk) {
      classifyRange(image, fgModel.centroids, bgModel.centroids, from, Math.min(n, from + chunk), mask, cache);
      scope.postMessage({ id, type: "progress", phase: "classify", fraction: Math.min(1, (from + chunk) / n) });
    }
    const t2 = performance.now();
    let foregroundPixels = 0;
    for (let i = 0; i < n; i++) foregroundPixels += mask[i];
    const stats: SegmentStats = {
      fgSeeds: fg.length,
      bgSeeds: bg.length,
      fgUsed: fgUsed.length,
      bgUsed: bgUsed.length,
      fgIterations: fgModel.iterations,
      bgIterations: bgModel.iterations,
      fgClusters: fgModel.centroids.length / 3,
      bgClusters: bgModel.centroids.length / 3,
      foregroundPixels,
    };
    scope.postMessage({ id, type: "done", mask, stats, kmeansMs: t1 - t0, classifyMs: t2 - t1 }, [mask.buffer]);
  } catch (err) {
    scope.postMessage({ id, type: "error", message: err instanceof Error ? err.message : "Segmentation failed." });
  }
};
