"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Chip, DemoFrame, ErrorNote, Skeleton, Stat, cx, inputClass } from "@/components/ui/primitives";
import { bestBy, evaluateAll, type Metrics, type ModelKey, type ModelResult } from "./logic";

type BtcData = { source: string; dates: string[]; close: number[] };

const ACCENT = "#315b8c";
const PRICE = "rgba(65, 51, 51,0.62)";
const MODEL_ORDER: ModelKey[] = ["linear", "poly2", "poly3", "persistence", "ar"];
const SHORT: Record<ModelKey, string> = {
  linear: "Linear",
  poly2: "Poly 2",
  poly3: "Poly 3",
  persistence: "Persistence",
  ar: "AR(p)",
};

const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `$${Math.round(v)}`);

const RECORDED = [
  { model: "Linear regression", rmse: "10160.62", mae: "7857.78", mape: "511.48%" },
  { model: "Polynomial degree 2", rmse: "7444.31", mae: "5338.78", mape: "218.00%" },
];

function PriceChart({
  dates,
  close,
  split,
  result,
  logScale,
}: {
  dates: string[];
  close: number[];
  split: number;
  result: ModelResult | undefined;
  logScale: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = close.length;
  const H = width < 480 ? 240 : 320;
  const ml = width < 480 ? 44 : 56;
  const mr = 10;
  const mt = 10;
  const mb = 26;
  const iw = width - ml - mr;
  const ih = H - mt - mb;

  const geom = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of close) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    // Keep extrapolated regression lines in view without letting them flatten the price.
    if (result) {
      for (const v of result.test) {
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    hi = Math.min(hi, 2 * Math.max(...close));
    const linLo = Math.min(0, lo);
    const logLo = Math.log10(Math.max(50, Math.min(...close) * 0.8));
    const logHi = Math.log10(hi * 1.15);
    const x = (i: number) => ml + (i / (n - 1)) * iw;
    const y = (v: number) => {
      if (logScale) {
        const lv = Math.log10(Math.max(v, 10 ** logLo));
        return mt + (1 - (lv - logLo) / (logHi - logLo)) * ih;
      }
      const yy = mt + (1 - (v - linLo) / (hi * 1.05 - linLo)) * ih;
      return Math.max(mt - 4, Math.min(mt + ih + 4, yy));
    };
    const path = (vals: number[], offset: number) => {
      let d = "";
      for (let i = 0; i < vals.length; i++) d += `${i ? "L" : "M"}${x(i + offset).toFixed(1)},${y(vals[i]).toFixed(1)}`;
      return d;
    };
    let yTicks: number[];
    if (logScale) {
      yTicks = [];
      for (let p = Math.ceil(logLo); p <= Math.floor(logHi); p++) yTicks.push(10 ** p);
    } else {
      const span = hi * 1.05 - linLo;
      const raw = span / 4;
      const mag = 10 ** Math.floor(Math.log10(raw));
      const stepV = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
      yTicks = [];
      for (let v = Math.ceil(linLo / stepV) * stepV; v <= hi * 1.05; v += stepV) yTicks.push(v);
    }
    const xTicks: Array<{ i: number; label: string }> = [];
    dates.forEach((d, i) => {
      if (d.endsWith("-01-01")) xTicks.push({ i, label: d.slice(0, 4) });
    });
    return { x, y, path, yTicks, xTicks };
  }, [close, dates, result, logScale, n, iw, ih, ml, mt]);

  const pricePath = useMemo(() => geom.path(close, 0), [geom, close]);
  const testPath = result ? geom.path(result.test, split) : "";
  const trainPath = result?.train ? geom.path(result.train, 0) : "";
  const showEvery = width < 480 ? 2 : 1;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - ml) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  const hi = hover ?? n - 1;
  const predAt = result && hi >= split ? result.test[hi - split] : result?.train && hi < split ? result.train[hi] : undefined;

  return (
    <div ref={wrapRef} className="min-w-0">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-fg-muted" aria-hidden>
        <span>{dates[hi]}</span>
        <span>Actual {usd0(close[hi])}</span>
        {predAt !== undefined ? <span className="text-accent">Model {usd0(predAt)}</span> : null}
        <span className="text-fg-faint">{hi >= split ? "test" : "train"}</span>
      </div>
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        className="block max-w-full touch-pan-y select-none"
        role="img"
        aria-label={`BTC daily close from ${dates[0]} to ${dates[n - 1]}, ${logScale ? "log" : "linear"} price scale. Training range ends ${dates[split - 1]}; test range ${dates[split]} to ${dates[n - 1]}.${result ? ` Overlay: ${result.label}.` : ""}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <rect x={ml} y={mt} width={geom.x(split) - ml} height={ih} fill="rgba(65, 51, 51,0.025)" />
        <rect x={geom.x(split)} y={mt} width={ml + iw - geom.x(split)} height={ih} fill="rgba(49, 91, 140,0.05)" />
        {geom.yTicks.map((v) => (
          <g key={v}>
            <line x1={ml} x2={ml + iw} y1={geom.y(v)} y2={geom.y(v)} stroke="rgba(65, 51, 51,0.06)" />
            <text x={ml - 6} y={geom.y(v) + 3} textAnchor="end" fontSize="10" fill="#7a6662" className="font-mono">
              {compact(v)}
            </text>
          </g>
        ))}
        {geom.xTicks.map((t, k) =>
          k % showEvery === 0 ? (
            <text key={t.i} x={geom.x(t.i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#7a6662" className="font-mono">
              {t.label}
            </text>
          ) : null,
        )}
        <path d={pricePath} fill="none" stroke={PRICE} strokeWidth="1.2" />
        {trainPath ? <path d={trainPath} fill="none" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="4 3" /> : null}
        {testPath ? <path d={testPath} fill="none" stroke={ACCENT} strokeWidth="1.6" /> : null}
        <line x1={geom.x(split)} x2={geom.x(split)} y1={mt} y2={mt + ih} stroke={ACCENT} strokeDasharray="3 3" />
        <text x={geom.x(split) - 4} y={mt + 12} textAnchor="end" fontSize="10" fill="#5e4c4a">
          train
        </text>
        <text x={geom.x(split) + 4} y={mt + 12} fontSize="10" fill={ACCENT}>
          test
        </text>
        {hover !== null ? <line x1={geom.x(hover)} x2={geom.x(hover)} y1={mt} y2={mt + ih} stroke="rgba(65, 51, 51,0.3)" /> : null}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-faint">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-fg/60" /> Actual close
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-accent" /> {result?.label ?? "Model"} (test)
        </span>
        {trainPath ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 border-t border-dashed border-accent/60" /> In-sample fit
          </span>
        ) : null}
      </div>
    </div>
  );
}

const COLS: Array<{ key: keyof Metrics; label: string }> = [
  { key: "rmse", label: "RMSE" },
  { key: "mae", label: "MAE" },
  { key: "mape", label: "MAPE" },
];

export default function BtcForecastDemo() {
  const [data, setData] = useState<BtcData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState(0);
  const [p, setP] = useState(5);
  const [overlay, setOverlay] = useState<ModelKey>("poly2");
  const [logScale, setLogScale] = useState(true);
  const splitId = useId();
  const pId = useId();

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/demos/btc/btc-daily.json", { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BtcData>;
      })
      .then((d) => {
        if (!Array.isArray(d.close) || d.close.length !== d.dates.length || d.close.length < 100) throw new Error("bad data");
        setData(d);
        setSplit(Math.round(d.close.length * 0.8));
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError("Could not load the BTC price series.");
      });
    return () => ctrl.abort();
  }, []);

  const dSplit = useDeferredValue(split);
  const dP = useDeferredValue(p);
  const results = useMemo(() => (data && dSplit ? evaluateAll(data.close, dSplit, dP) : null), [data, dSplit, dP]);
  const best = results ? bestBy(results) : null;
  const current = results?.find((r) => r.key === overlay);

  const controls = (
    <Chip active={logScale} onClick={() => setLogScale((v) => !v)}>
      Log scale
    </Chip>
  );

  return (
    <DemoFrame
      title="BTC forecasting, done chronologically"
      controls={controls}
      note="Runs in your browser on 2,651 daily closes (2014-11-28 to 2022-03-01). Every model is fitted only on days before the split and scored on the days after. Least squares via Cholesky on a standardised time feature; persistence and AR(p) forecast one day ahead using actual past prices."
    >
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data || !results || !best ? (
        <div className="grid gap-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <label htmlFor={splitId} className="flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
                <span>Split date (train before, test from)</span>
                <span className="font-mono tabular-nums text-fg">
                  {data.dates[split]} &middot; {Math.round((split / data.close.length) * 100)}% train
                </span>
              </label>
              <input
                id={splitId}
                type="range"
                min={Math.round(data.close.length * 0.2)}
                max={data.close.length - 30}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                aria-valuetext={`Test starts ${data.dates[split]}`}
                className="w-full accent-[#315b8c]"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={pId} className="text-xs text-fg-muted">
                AR order p
              </label>
              <select id={pId} value={p} onChange={(e) => setP(Number(e.target.value))} className={cx(inputClass, "w-24 font-mono")}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-xs text-fg-muted" id={`${pId}-ov`}>
              Overlay
            </span>
            <div role="group" aria-labelledby={`${pId}-ov`} className="flex flex-wrap gap-1.5">
              {MODEL_ORDER.map((k) => (
                <Chip key={k} active={overlay === k} onClick={() => setOverlay(k)}>
                  {k === "ar" ? `AR(${p})` : SHORT[k]}
                </Chip>
              ))}
            </div>
          </div>

          <PriceChart dates={data.dates} close={data.close} split={dSplit} result={current} logScale={logScale} />

          <div className="min-w-0">
            <h4 className="mb-2 text-xs font-medium text-fg-muted">
              Test range metrics, {data.dates[dSplit]} to {data.dates[data.dates.length - 1]} ({data.close.length - dSplit} days)
            </h4>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full min-w-[440px] text-sm">
                <caption className="sr-only">Error of each model on the chronological test range. Lower is better; best per column marked.</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-fg-faint">
                    <th scope="col" className="px-3 py-2 font-normal">
                      Model
                    </th>
                    {COLS.map((c) => (
                      <th key={c.key} scope="col" className="px-3 py-2 text-right font-normal">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.key} className={cx("border-b border-line last:border-b-0", overlay === r.key && "bg-fg/[0.03]")}>
                      <th scope="row" className="px-3 py-2 text-left font-normal text-fg">
                        {r.label}
                      </th>
                      {COLS.map((c) => {
                        const isBest = best[c.key] === i;
                        const v = r.metrics[c.key];
                        return (
                          <td key={c.key} className={cx("px-3 py-2 text-right font-mono tabular-nums", isBest ? "text-accent" : "text-fg-muted")}>
                            {c.key === "mape" ? `${v.toFixed(2)}%` : usd(v)}
                            {isBest ? <span className="ml-1.5 text-[10px] uppercase tracking-wide">best</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p aria-live="polite" className="mt-3 text-sm text-fg-muted">
              {`Best RMSE: ${results[best.rmse].label}, ${usd(results[best.rmse].metrics.rmse)}. Linear regression on time: ${usd(results[0].metrics.rmse)}.`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-fg-faint">
              Regression on time does far worse here than in the notebook because it must extrapolate a fitted trend into unseen dates,
              while a random split puts neighbouring days from the future into training, so the model only has to interpolate.
            </p>
          </div>

          <section aria-label="Recorded in the notebook (random split)" className="rounded-card border border-line bg-bg p-4">
            <h4 className="text-xs font-medium text-fg-muted">Recorded in the notebook (random split)</h4>
            <p className="mt-1 text-xs text-fg-faint">sklearn, train_test_split(test_size=0.2, random_state=42) on the unix timestamp. Copied from the notebook output, not recomputed.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-fg-faint">
                    <th scope="col" className="py-1.5 pr-3 font-normal">
                      Model
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                      RMSE
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                      MAE
                    </th>
                    <th scope="col" className="py-1.5 text-right font-normal">
                      MAPE
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-fg-muted">
                  {RECORDED.map((r) => (
                    <tr key={r.model} className="border-t border-line">
                      <th scope="row" className="py-1.5 pr-3 text-left font-sans font-normal text-fg">
                        {r.model}
                      </th>
                      <td className="py-1.5 pr-3 text-right">{r.rmse}</td>
                      <td className="py-1.5 pr-3 text-right">{r.mae}</td>
                      <td className="py-1.5 text-right">{r.mape}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat label="ADF on close" value="-1.918" hint="p = 0.3236, not stationary" />
              <Stat label="ADF on first difference" value="-8.529" hint="p = 1.05e-13, stationary" />
            </div>
          </section>
        </div>
      )}
    </DemoFrame>
  );
}
