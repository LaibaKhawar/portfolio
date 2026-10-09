/// <reference lib="webworker" />
// Runs all-MiniLM-L6-v2 (quantized ONNX) in the browser via transformers.js.
// Messages in:  { type: "load" } | { type: "embed"; id: number; texts: string[] }
// Messages out: { type: "progress"; loaded; total } | { type: "ready" } | { type: "vectors"; id; dim; data: Float32Array } | { type: "error"; message }

import { pipeline, type FeatureExtractionPipeline, type ProgressInfo } from "@huggingface/transformers";

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load() {
  extractor ??= pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
    progress_callback: (p: ProgressInfo) => {
      if (p.status === "progress_total") self.postMessage({ type: "progress", loaded: p.loaded, total: p.total });
    },
  }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      self.postMessage({ type: "ready" });
    } else if (msg.type === "embed") {
      const ex = await load();
      const out = await ex(msg.texts as string[], { pooling: "mean", normalize: true });
      const data = out.data as Float32Array;
      const dim = out.dims[out.dims.length - 1];
      self.postMessage({ type: "vectors", id: msg.id, dim, data }, [data.buffer]);
    }
  } catch (err) {
    extractor = null;
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
