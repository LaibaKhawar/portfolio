"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button, Chip, DemoFrame, ErrorNote, Skeleton, Stat, cx } from "@/components/ui/primitives";
import { evaluateRange, labelOf, newEvaluation, normalizeRows, predict } from "./logic";
import type { Evaluation, Metric } from "./logic";

interface Split {
  rows: number;
  dim: number;
  side: number;
  subjects: number;
  perSubject: number;
  train: number[];
  test: number[];
  recorded: { knn: number; svm: number; gnb: number };
}

interface Loaded {
  split: Split;
  raw: Uint8Array;
  data: Float64Array;
}

const BASE = "/demos/face-knn/";

/** One 32x32 face drawn into its own canvas. Rows are stored column-major: pixel (x, y) = row[x * side + y]. */
function Face({ raw, row, side, label, className }: { raw: Uint8Array; row: number; side: number; label?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(side, side);
    const off = row * side * side;
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const v = raw[off + x * side + y];
        const o = (y * side + x) * 4;
        img.data[o] = v;
        img.data[o + 1] = v;
        img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }, [raw, row, side]);
  return (
    <canvas
      ref={ref}
      width={side}
      height={side}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("block aspect-square w-full", className)}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function FaceKnnDemo() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; d: Loaded }>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [k, setK] = useState(7);
  const [metric, setMetric] = useState<Metric>("euclidean");
  const [selected, setSelected] = useState(0);
  const [evalState, setEvalState] = useState<{ ev: Evaluation; k: number; metric: Metric; ms: number; running: boolean } | null>(null);
  const runToken = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(BASE + "split.json").then((r) => {
        if (!r.ok) throw new Error(`split.json: HTTP ${r.status}`);
        return r.json() as Promise<Split>;
      }),
      fetch(BASE + "faces.u8").then((r) => {
        if (!r.ok) throw new Error(`faces.u8: HTTP ${r.status}`);
        return r.arrayBuffer();
      }),
    ])
      .then(([split, buf]) => {
        if (cancelled) return;
        const raw = new Uint8Array(buf);
        if (raw.length !== split.rows * split.dim) throw new Error("Face data has an unexpected size.");
        const data = normalizeRows(raw, split.rows, split.dim);
        setState({ status: "ready", d: { split, raw, data } });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Could not load the face data." });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Cancel any running evaluation on unmount.
  useEffect(() => () => void (runToken.current += 1), []);

  const d = state.status === "ready" ? state.d : null;

  const result = useMemo(() => {
    if (!d) return null;
    const q = d.split.test[selected];
    return { q, truth: labelOf(q, d.split.perSubject), ...predict(d.data, d.split.dim, d.split.train, q, k, metric, d.split.perSubject) };
  }, [d, selected, k, metric]);

  const evaluate = useCallback(() => {
    if (!d) return;
    const token = ++runToken.current;
    const { split, data } = d;
    const ev = newEvaluation(split.test.length, split.subjects);
    const t0 = performance.now();
    const params = { k, metric };
    setEvalState({ ev: { ...ev }, ...params, ms: 0, running: true });
    let next = 0;
    const step = () => {
      if (token !== runToken.current) return;
      const start = performance.now();
      while (next < split.test.length && performance.now() - start < 12) {
        evaluateRange(data, split.dim, split.train, split.test, params.k, params.metric, next, next + 1, ev, split.perSubject);
        next++;
      }
      const done = next >= split.test.length;
      setEvalState({
        ev: { ...ev, confusion: ev.confusion.map((r) => r.slice()), predictions: ev.predictions.slice() },
        ...params,
        ms: performance.now() - t0,
        running: !done,
      });
      if (!done) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }, [d, k, metric]);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!d) return;
    const el = gridRef.current;
    const cols = el ? getComputedStyle(el).gridTemplateColumns.split(" ").length : 10;
    const n = d.split.test.length;
    const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -selected, End: n - 1 - selected };
    if (!(e.key in delta)) return;
    e.preventDefault();
    const nextIdx = Math.min(n - 1, Math.max(0, selected + delta[e.key]));
    setSelected(nextIdx);
    const btn = el?.querySelector<HTMLButtonElement>(`[data-idx="${nextIdx}"]`);
    btn?.focus();
  };

  const evalStale = evalState && !evalState.running && (evalState.k !== k || evalState.metric !== metric);
  const metricName = (m: Metric) => (m === "euclidean" ? "Euclidean" : "Cosine");

  return (
    <DemoFrame
      title="Face recognition with KNN"
      note="Runs in your browser on the repository's dataset: 1,700 faces of 10 subjects, 32x32 pixels, rows L2-normalised, the notebook's 1,500 / 200 train/test split."
      controls={
        <>
          <Chip active={metric === "euclidean"} onClick={() => setMetric("euclidean")}>
            Euclidean
          </Chip>
          <Chip active={metric === "cosine"} onClick={() => setMetric("cosine")}>
            Cosine
          </Chip>
        </>
      }
    >
      {state.status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : state.status === "error" ? (
        <div className="grid gap-3">
          <ErrorNote>Could not load the face data. {state.message}</ErrorNote>
          <div>
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((a) => a + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : d && result ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-xs">
              <label htmlFor="knn-k" className="flex justify-between text-xs text-fg-muted">
                <span>Neighbours (k)</span>
                <span className="font-mono tabular-nums text-fg">{k}</span>
              </label>
              <input
                id="knn-k"
                type="range"
                min={1}
                max={15}
                step={1}
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <Button variant="primary" onClick={evaluate} disabled={evalState?.running}>
              {evalState?.running ? `Evaluating ${evalState.ev.total} / ${d.split.test.length}` : "Evaluate all 200"}
            </Button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between text-xs text-fg-faint">
                <span id="knn-grid-label">Test faces, 20 per subject. Arrow keys move, the selection updates instantly.</span>
              </div>
              <div
                ref={gridRef}
                role="listbox"
                aria-labelledby="knn-grid-label"
                onKeyDown={onGridKey}
                className="grid max-h-[340px] grid-cols-10 gap-1 overflow-y-auto rounded-input border border-line bg-bg p-1.5 sm:grid-cols-20"
              >
                {d.split.test.map((row, i) => {
                  const pred = evalState && !evalStale ? evalState.ev.predictions[i] : -1;
                  const wrong = pred >= 0 && pred !== labelOf(row, d.split.perSubject);
                  return (
                    <button
                      key={row}
                      type="button"
                      role="option"
                      aria-selected={i === selected}
                      data-idx={i}
                      tabIndex={i === selected ? 0 : -1}
                      onClick={() => setSelected(i)}
                      aria-label={`Test face ${i + 1}, subject ${labelOf(row, d.split.perSubject)}${wrong ? ", misclassified" : ""}`}
                      className={cx(
                        "relative overflow-hidden rounded-[4px] outline-offset-1",
                        i === selected ? "ring-2 ring-accent" : wrong ? "ring-1 ring-danger" : "opacity-80 hover:opacity-100",
                      )}
                    >
                      <Face raw={d.raw} row={row} side={d.split.side} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-card border border-line bg-surface p-4">
              <div className="flex gap-4">
                <div className="w-28 shrink-0 overflow-hidden rounded-input border border-line">
                  <Face raw={d.raw} row={result.q} side={d.split.side} label={`Selected test face, subject ${result.truth}`} />
                </div>
                <div className="grid content-start gap-3" aria-live="polite">
                  <Stat label="True subject" value={result.truth} />
                  <Stat
                    label="Predicted"
                    value={
                      <span className={result.pred === result.truth ? "text-ok" : "text-danger"}>
                        {result.pred} {result.pred === result.truth ? "correct" : "wrong"}
                      </span>
                    }
                  />
                </div>
              </div>
              <div className="mt-4 text-xs text-fg-muted">
                {k} nearest training faces ({metricName(metric)} distance)
              </div>
              <ol className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
                {result.neighbors.map((n, i) => (
                  <li key={n.index} className="min-w-0">
                    <div className={cx("overflow-hidden rounded-[6px] border", n.label === result.pred ? "border-accent/60" : "border-line")}>
                      <Face raw={d.raw} row={n.index} side={d.split.side} label={`Neighbour ${i + 1}, subject ${n.label}`} />
                    </div>
                    <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-fg-faint">
                      <span className={n.label === result.pred ? "text-accent" : undefined}>s{n.label}</span>
                      <span>{n.dist.toFixed(3)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="grid gap-5 border-t border-line pt-5 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-live="polite">
                <Stat
                  label={evalState ? `Live KNN, k=${evalState.k}, ${metricName(evalState.metric)}` : "Live KNN"}
                  value={evalState ? `${evalState.ev.accuracy.toFixed(3)}` : "-"}
                  hint={
                    evalState
                      ? `${evalState.ev.correct} / ${evalState.ev.total} correct, ${Math.round(evalState.ms)} ms${evalStale ? ", settings changed" : ""}`
                      : "Press Evaluate all 200"
                  }
                />
                <Stat label="Recorded KNN (k=7)" value={d.split.recorded.knn.toFixed(2)} hint="notebook cell 2" />
                <Stat label="Recorded SVM" value={d.split.recorded.svm.toFixed(2)} hint="sklearn SVC" />
                <Stat label="Recorded Gaussian NB" value={d.split.recorded.gnb.toFixed(2)} hint="sklearn GaussianNB" />
              </div>
              {evalState && !evalState.running ? (
                <p className="text-xs text-fg-faint">
                  Misclassified faces are outlined in red in the grid. Recorded numbers come from i211697_Q2.ipynb; the live number is recomputed here.
                </p>
              ) : null}
            </div>
            {evalState ? <Confusion ev={evalState.ev} classes={d.split.subjects} /> : null}
          </div>
        </div>
      ) : null}
    </DemoFrame>
  );
}

function Confusion({ ev, classes }: { ev: Evaluation; classes: number }) {
  const max = Math.max(1, ...ev.confusion.flat());
  const ids = Array.from({ length: classes }, (_, i) => i);
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="border-separate border-spacing-[2px] font-mono text-[10px] tabular-nums">
        <caption className="mb-1 text-left font-sans text-xs text-fg-muted">Confusion matrix (rows true, columns predicted)</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              True subject
            </th>
            {ids.map((c) => (
              <th key={c} scope="col" className="w-6 font-normal text-fg-faint">
                <span className="sr-only">Predicted </span>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((r) => (
            <tr key={r}>
              <th scope="row" className="pr-1 text-right font-normal text-fg-faint">
                <span className="sr-only">True </span>
                {r}
              </th>
              {ids.map((c) => {
                const v = ev.confusion[r][c];
                return (
                  <td
                    key={c}
                    className={cx("size-6 rounded-[3px] text-center", v === 0 ? "text-fg-faint/40" : r === c ? "text-accent-ink" : "text-fg")}
                    style={{ backgroundColor: v === 0 ? "rgba(20,32,74,0.03)" : `rgba(65,105,225,${(0.15 + 0.85 * (v / max)).toFixed(3)})` }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
