"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Button, Chip, DemoFrame, ErrorNote, Skeleton, Stat, cx } from "@/components/ui/primitives";
import { MAX_SEEDS, N_CLUSTERS, seedMapFromStroke } from "./logic";
import type { SegmentStats } from "./logic";
import type { SegmentRequest, SegmentResponse } from "./worker";

const IMAGES = [
  { id: "mona-lisa", name: "Mona Lisa" },
  { id: "lady", name: "Lady" },
  { id: "van-gogh", name: "Van Gogh" },
] as const;
type ImageId = (typeof IMAGES)[number]["id"];

const BASE = "/demos/lazy-snapping/";
const BRUSH_RADIUS = 3;
const FG_RGB = [255, 48, 48];
const BG_RGB = [40, 110, 255];

interface Loaded {
  w: number;
  h: number;
  image: Uint8ClampedArray;
  repoSeeds: Uint8Array;
}

interface Result {
  mask: Uint8Array;
  stats: SegmentStats;
  kmeansMs: number;
  classifyMs: number;
  stale: boolean;
}

async function loadPixels(src: string): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
}

function putRGBA(canvas: HTMLCanvasElement | null, w: number, h: number, rgba: Uint8ClampedArray) {
  if (!canvas) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
}

/** Spawn a worker for one segmentation request. The caller terminates it. */
function startWorker(req: SegmentRequest, onMessage: (msg: SegmentResponse) => void, onError: () => void): Worker {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<SegmentResponse>) => onMessage(ev.data);
  worker.onerror = onError;
  worker.postMessage(req, [req.image.buffer, req.seeds.buffer]);
  return worker;
}

function countSeeds(seeds: Uint8Array) {
  let fg = 0;
  let bg = 0;
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i] === 1) fg++;
    else if (seeds[i] === 2) bg++;
  }
  return { fg, bg };
}

export default function LazySnappingDemo() {
  const [imageId, setImageId] = useState<ImageId>("mona-lisa");
  const [loaded, setLoaded] = useState<{ id: ImageId; data: Loaded } | null>(null);
  const [error, setError] = useState<{ id: ImageId; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [brush, setBrush] = useState<1 | 2>(1);
  const [counts, setCounts] = useState({ fg: 0, bg: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState<{ phase: "kmeans" | "classify"; fraction: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [split, setSplit] = useState(50);

  const seedsRef = useRef<Uint8Array | null>(null);
  const editRef = useRef<HTMLCanvasElement>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const cutRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);

  const data = loaded && loaded.id === imageId ? loaded.data : null;
  const loadError = error && error.id === imageId ? error.message : null;

  // Load image + repository stroke.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPixels(`${BASE}${imageId}.png`), loadPixels(`${BASE}${imageId}-stroke.png`)])
      .then(([img, stroke]) => {
        if (cancelled) return;
        if (img.w !== stroke.w || img.h !== stroke.h) throw new Error("Stroke image size does not match.");
        const repoSeeds = seedMapFromStroke(stroke.data, img.w, img.h);
        seedsRef.current = repoSeeds.slice();
        runId.current++;
        setLoaded({ id: imageId, data: { w: img.w, h: img.h, image: img.data, repoSeeds } });
        setCounts(countSeeds(repoSeeds));
        setResult(null);
        setProgress(null);
        setRunError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError({ id: imageId, message: e instanceof Error ? e.message : "Could not load the image." });
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, attempt]);

  // Worker lifecycle.
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const redrawEdit = useCallback(() => {
    const seeds = seedsRef.current;
    if (!data || !seeds) return;
    const out = new Uint8ClampedArray(data.image);
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      if (s === 0) continue;
      const c = s === 1 ? FG_RGB : BG_RGB;
      out[i * 4] = c[0];
      out[i * 4 + 1] = c[1];
      out[i * 4 + 2] = c[2];
    }
    putRGBA(editRef.current, data.w, data.h, out);
  }, [data]);

  useEffect(() => {
    redrawEdit();
  }, [redrawEdit]);

  // Paint result panels.
  useEffect(() => {
    if (!data || !result) return;
    const { w, h, image } = data;
    const n = w * h;
    const mask = new Uint8ClampedArray(n * 4);
    const cut = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const m = result.mask[i];
      const v = m ? 255 : 0;
      mask[o] = v;
      mask[o + 1] = v;
      mask[o + 2] = v;
      mask[o + 3] = 255;
      if (m) {
        cut[o] = image[o];
        cut[o + 1] = image[o + 1];
        cut[o + 2] = image[o + 2];
      } else {
        // background dimmed to 15% so the cut-out reads clearly on the dark page
        cut[o] = image[o] * 0.15;
        cut[o + 1] = image[o + 1] * 0.15;
        cut[o + 2] = image[o + 2] * 0.15;
      }
      cut[o + 3] = 255;
    }
    putRGBA(originalRef.current, w, h, image);
    putRGBA(maskRef.current, w, h, mask);
    putRGBA(cutRef.current, w, h, cut);
    putRGBA(afterRef.current, w, h, cut);
    putRGBA(beforeRef.current, w, h, image);
  }, [data, result]);

  const toImageCoords = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const stamp = (x: number, y: number) => {
    const seeds = seedsRef.current;
    if (!data || !seeds) return;
    const cx0 = Math.round(x);
    const cy0 = Math.round(y);
    for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++)
      for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
        if (dx * dx + dy * dy > BRUSH_RADIUS * BRUSH_RADIUS) continue;
        const px = cx0 + dx;
        const py = cy0 + dy;
        if (px < 0 || py < 0 || px >= data.w || py >= data.h) continue;
        seeds[py * data.w + px] = brush;
      }
  };

  const strokeTo = (x: number, y: number) => {
    const last = lastPt.current;
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y);
      const steps = Math.max(1, Math.ceil(dist / (BRUSH_RADIUS * 0.75)));
      for (let s = 1; s <= steps; s++) stamp(last.x + ((x - last.x) * s) / steps, last.y + ((y - last.y) * s) / steps);
    } else stamp(x, y);
    lastPt.current = { x, y };
    redrawEdit();
  };

  const markStale = () => setResult((r) => (r && !r.stale ? { ...r, stale: true } : r));

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!data) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastPt.current = null;
    const p = toImageCoords(e);
    strokeTo(p.x, p.y);
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!lastPt.current) return;
    const p = toImageCoords(e);
    strokeTo(p.x, p.y);
  };
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!lastPt.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    lastPt.current = null;
    if (seedsRef.current) setCounts(countSeeds(seedsRef.current));
    markStale();
  };

  const clearStrokes = () => {
    if (!data) return;
    seedsRef.current = new Uint8Array(data.w * data.h);
    setCounts({ fg: 0, bg: 0 });
    redrawEdit();
    markStale();
  };
  const resetStrokes = () => {
    if (!data) return;
    seedsRef.current = data.repoSeeds.slice();
    setCounts(countSeeds(data.repoSeeds));
    redrawEdit();
    markStale();
  };

  const segment = () => {
    const seeds = seedsRef.current;
    if (!data || !seeds) return;
    if (counts.fg === 0 || counts.bg === 0) {
      setRunError("Paint at least one foreground and one background stroke.");
      return;
    }
    setRunError(null);
    workerRef.current?.terminate();
    const id = ++runId.current;
    setProgress({ phase: "kmeans", fraction: 0 });
    const req: SegmentRequest = { id, image: data.image.slice(), seeds: seeds.slice(), w: data.w, h: data.h };
    workerRef.current = startWorker(
      req,
      (msg) => {
        if (msg.id !== runId.current) return;
        if (msg.type === "progress") setProgress({ phase: msg.phase, fraction: msg.fraction });
        else if (msg.type === "error") {
          setProgress(null);
          setRunError(msg.message);
        } else {
          setProgress(null);
          setResult({ mask: msg.mask, stats: msg.stats, kmeansMs: msg.kmeansMs, classifyMs: msg.classifyMs, stale: false });
        }
      },
      () => {
        if (id !== runId.current) return;
        setProgress(null);
        setRunError("The segmentation worker failed to run.");
      },
    );
  };

  const running = progress !== null;
  const aspect = data ? `${data.w} / ${data.h}` : "431 / 414";

  return (
    <DemoFrame
      title="Lazy Snapping colour segmentation"
      note={`Runs in your browser in a Web Worker on the repository's images and strokes. Seed colours are clustered with k-means (k = ${N_CLUSTERS}, 10 iterations, fixed seed, up to ${MAX_SEEDS.toLocaleString()} seeds per side); a pixel is foreground when the sum of exp(-0.1 x distance) to the foreground centroids beats the background sum.`}
      controls={IMAGES.map((im) => (
        <Chip key={im.id} active={im.id === imageId} onClick={() => setImageId(im.id)} disabled={running}>
          {im.name}
        </Chip>
      ))}
    >
      {loadError ? (
        <div className="grid gap-3">
          <ErrorNote>Could not load the image. {loadError}</ErrorNote>
          <div>
            <Button
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
            <div className="min-w-0">
              <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-input border border-line bg-bg" style={{ aspectRatio: aspect }}>
                {!data ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
                <canvas
                  ref={editRef}
                  aria-label={`${IMAGES.find((i) => i.id === imageId)?.name} with seed strokes. Drag to paint ${brush === 1 ? "foreground" : "background"} strokes.`}
                  className={cx("absolute inset-0 size-full cursor-crosshair touch-none", !data && "invisible")}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                />
              </div>
            </div>
            <div className="grid content-start gap-4">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-xs text-fg-muted">Brush</legend>
                <div className="flex flex-wrap gap-2">
                  <Chip active={brush === 1} onClick={() => setBrush(1)}>
                    <span className="mr-1.5 inline-block size-2 rounded-full bg-[#ff3030] align-middle" aria-hidden />
                    Foreground
                  </Chip>
                  <Chip active={brush === 2} onClick={() => setBrush(2)}>
                    <span className="mr-1.5 inline-block size-2 rounded-full bg-[#286eff] align-middle" aria-hidden />
                    Background
                  </Chip>
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button variant="quiet" onClick={clearStrokes} disabled={!data || running}>
                  Clear strokes
                </Button>
                <Button variant="quiet" onClick={resetStrokes} disabled={!data || running}>
                  Reset to repository strokes
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Foreground seeds" value={counts.fg.toLocaleString()} />
                <Stat label="Background seeds" value={counts.bg.toLocaleString()} />
              </div>
              <Button variant="primary" onClick={segment} disabled={!data || running}>
                {running ? (progress.phase === "kmeans" ? "Clustering seeds" : `Classifying ${Math.round(progress.fraction * 100)}%`) : "Segment"}
              </Button>
              {runError ? <ErrorNote>{runError}</ErrorNote> : null}
              <p className="text-xs text-fg-faint">Painting works with mouse, pen or touch. Keyboard users can segment with the repository strokes.</p>
            </div>
          </div>

          <div aria-live="polite" className="sr-only">
            {result && !result.stale
              ? `Segmented. ${((result.stats.foregroundPixels / (data ? data.w * data.h : 1)) * 100).toFixed(1)} percent of pixels are foreground. Took ${Math.round(result.kmeansMs + result.classifyMs)} milliseconds.`
              : running
                ? "Segmenting"
                : ""}
          </div>

          {result && data ? (
            <div className={cx("grid gap-5 border-t border-line pt-5 transition-opacity", result.stale && "opacity-60")}>
              {result.stale ? <p className="text-xs text-fg-muted">Strokes changed. Press Segment to update the result.</p> : null}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Stat label="Seeds used (F / B)" value={`${result.stats.fgUsed} / ${result.stats.bgUsed}`} hint={result.stats.fgUsed < result.stats.fgSeeds || result.stats.bgUsed < result.stats.bgSeeds ? "evenly subsampled" : "all seeds"} />
                <Stat label="k-means iterations (F / B)" value={`${result.stats.fgIterations} / ${result.stats.bgIterations}`} hint={`${result.stats.fgClusters} / ${result.stats.bgClusters} clusters`} />
                <Stat label="Time" value={`${Math.round(result.kmeansMs + result.classifyMs)} ms`} hint={`k-means ${Math.round(result.kmeansMs)} ms, pixels ${Math.round(result.classifyMs)} ms`} />
                <Stat label="Foreground" value={`${((result.stats.foregroundPixels / (data.w * data.h)) * 100).toFixed(1)}%`} hint={`${result.stats.foregroundPixels.toLocaleString()} px`} />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { ref: originalRef, label: "Original" },
                  { ref: maskRef, label: "Mask" },
                  { ref: cutRef, label: "Cut-out" },
                ].map((p) => (
                  <figure key={p.label} className="min-w-0">
                    <canvas ref={p.ref} role="img" aria-label={p.label} className="block h-auto w-full rounded-input border border-line" />
                    <figcaption className="mt-1.5 text-xs text-fg-faint">{p.label}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="mx-auto grid w-full max-w-[520px] gap-2">
                <div className="relative overflow-hidden rounded-input border border-line" style={{ aspectRatio: `${data.w} / ${data.h}` }}>
                  <canvas ref={afterRef} role="img" aria-label="Cut-out" className="absolute inset-0 size-full" />
                  <canvas
                    ref={beforeRef}
                    role="img"
                    aria-label="Original"
                    className="absolute inset-0 size-full"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                  />
                  <div aria-hidden className="absolute inset-y-0 w-px bg-accent" style={{ left: `${split}%` }} />
                </div>
                <label htmlFor="ls-split" className="flex justify-between text-xs text-fg-muted">
                  <span>Before</span>
                  <span>After</span>
                </label>
                <input
                  id="ls-split"
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  aria-label="Before and after divider"
                  onChange={(e) => setSplit(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </DemoFrame>
  );
}
