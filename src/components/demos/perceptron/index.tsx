"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowClockwise, Pause, Play, SkipForward, FastForward } from "@phosphor-icons/react";
import { Button, Chip, DemoFrame, Stat, cx, inputClass } from "@/components/ui/primitives";
import {
  accuracy,
  countMistakes,
  decisionSegment,
  generateSeparable,
  generateXor,
  initialState,
  positiveRegion,
  stepEpoch,
  stepSample,
  trainTestSplit,
  type Box,
  type Point,
  type TrainState,
} from "./logic";

type DatasetKey = "separable" | "xor" | "custom";

const DATASETS: Array<{ key: DatasetKey; label: string }> = [
  { key: "separable", label: "Linearly separable (sign(x1+x2))" },
  { key: "xor", label: "XOR" },
  { key: "custom", label: "Your points" },
];
const RATES = [0.001, 0.01, 0.1, 1];
const MAX_EPOCHS = 200;
const ACCENT = "#f2b544";
const NEG = "rgba(255,255,255,0.78)";
const DANGER = "#f2766b";

const SEPARABLE = trainTestSplit(generateSeparable(500, 42), 0.2, 42);
const XOR = generateXor(200, 7);

const fmt = (v: number) => (Math.abs(v) < 1e-12 ? "0.0000" : v.toFixed(4));

function Sparkline({ history }: { history: number[] }) {
  const W = 300;
  const H = 64;
  const max = Math.max(1, ...history);
  const n = history.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 4 - (v / max) * (H - 8);
  const d = history.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = history[n - 1];
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between text-xs text-fg-faint">
        <span>Total error per epoch, sum of |y - y_hat|</span>
        <span className="font-mono tabular-nums">max {max}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1.5 h-16 w-full"
        role="img"
        aria-label={n ? `Errors over ${n} epochs, latest ${last}, max ${max}` : "No epochs completed yet"}
      >
        <line x1="0" x2={W} y1={H - 4} y2={H - 4} stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
        {n ? <path d={d} fill="none" stroke={ACCENT} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null}
        {n === 1 ? <circle cx={x(0)} cy={y(history[0])} r="2.5" fill={ACCENT} /> : null}
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-fg-faint tabular-nums">
        <span>{n ? "epoch 1" : ""}</span>
        <span>{n ? `epoch ${n}` : "no epochs yet"}</span>
      </div>
    </figure>
  );
}

export default function PerceptronDemo() {
  const reduce = useReducedMotion();
  const [dataset, setDataset] = useState<DatasetKey>("separable");
  const [lr, setLr] = useState(0.01);
  const [custom, setCustom] = useState<Point[]>([]);
  const [addClass, setAddClass] = useState<1 | -1>(1);
  const [train, setTrain] = useState<TrainState>(initialState);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [showCursor, setShowCursor] = useState(false);
  const [size, setSize] = useState(360);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trainRef = useRef(train);
  const lrId = useId();

  const data: Point[] = dataset === "separable" ? SEPARABLE.train : dataset === "xor" ? XOR : custom;
  const box: Box = useMemo(
    () => (dataset === "xor" ? { xMin: -3, xMax: 3, yMin: -3, yMax: 3 } : { xMin: -3.5, xMax: 3.5, yMin: -3.5, yMax: 3.5 }),
    [dataset],
  );

  const commit = useCallback((s: TrainState) => {
    trainRef.current = s;
    setTrain(s);
  }, []);

  const reset = useCallback(() => {
    setPlaying(false);
    commit(initialState());
  }, [commit]);

  // Responsive square canvas.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.max(240, Math.min(460, Math.floor(entry.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Play loop.
  useEffect(() => {
    if (!playing || !data.length) return;
    const finished = (s: TrainState) => {
      const last = s.history[s.history.length - 1];
      return (s.index === 0 && s.history.length > 0 && last === 0) || s.epoch >= MAX_EPOCHS;
    };
    if (reduce) {
      const id = window.setInterval(() => {
        const next = stepEpoch(trainRef.current, data, lr);
        commit(next);
        if (finished(next)) setPlaying(false);
      }, 450);
      return () => window.clearInterval(id);
    }
    const perFrame = Math.max(1, Math.round(data.length / 45));
    let raf = 0;
    const tick = () => {
      let s = trainRef.current;
      for (let k = 0; k < perFrame; k++) {
        s = stepSample(s, data, lr);
        if (s.index === 0) break; // pause at epoch boundaries so the line is seen per epoch
      }
      commit(s);
      if (finished(s)) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduce, data, lr, commit]);

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 28;
    const inner = size - pad - 8;
    const sx = (x: number) => pad + ((x - box.xMin) / (box.xMax - box.xMin)) * inner;
    const sy = (y: number) => 8 + (1 - (y - box.yMin) / (box.yMax - box.yMin)) * inner;

    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, size, size);

    // Positive half-plane shading.
    const region = positiveRegion(train.model, box);
    if (region.length >= 3 && (train.model.w1 !== 0 || train.model.w2 !== 0)) {
      ctx.fillStyle = "rgba(242,181,68,0.07)";
      ctx.beginPath();
      region.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.closePath();
      ctx.fill();
    }

    // Grid and ticks.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#75746f";
    ctx.font = "10px ui-monospace, monospace";
    for (let t = Math.ceil(box.xMin); t <= Math.floor(box.xMax); t++) {
      ctx.strokeStyle = t === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(sx(t) + 0.5, sy(box.yMin));
      ctx.lineTo(sx(t) + 0.5, sy(box.yMax));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx(box.xMin), sy(t) + 0.5);
      ctx.lineTo(sx(box.xMax), sy(t) + 0.5);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(String(t), sx(t), size - 2);
      ctx.textAlign = "right";
      ctx.fillText(String(t), pad - 6, sy(t) + 3);
    }
    ctx.textAlign = "right";
    ctx.fillText("x1", sx(box.xMax), size - 14);
    ctx.textAlign = "left";
    ctx.fillText("x2", sx(box.xMin) + 4, 18);

    // Decision line.
    const seg = decisionSegment(train.model, box);
    if (seg) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(seg[0][0]), sy(seg[0][1]));
      ctx.lineTo(sx(seg[1][0]), sy(seg[1][1]));
      ctx.stroke();
    }

    // Points.
    const hasLine = train.model.w1 !== 0 || train.model.w2 !== 0 || train.model.b !== 0;
    const r = size < 320 ? 2.5 : 3.2;
    for (const p of data) {
      const x = sx(p.x1);
      const y = sy(p.x2);
      if (p.y === 1) {
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = NEG;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const z = train.model.w1 * p.x1 + train.model.w2 * p.x2 + train.model.b;
      if (hasLine && (z >= 0 ? 1 : -1) !== p.y) {
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Current sample.
    if (train.lastIndex !== null && data[train.lastIndex]) {
      const p = data[train.lastIndex];
      ctx.strokeStyle = train.lastUpdated ? ACCENT : "#ecebe6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(p.x1), sy(p.x2), 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Keyboard cursor for "Your points".
    if (dataset === "custom" && showCursor) {
      const cx0 = sx(cursor[0]);
      const cy0 = sy(cursor[1]);
      ctx.strokeStyle = "#ecebe6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx0 - 8, cy0);
      ctx.lineTo(cx0 + 8, cy0);
      ctx.moveTo(cx0, cy0 - 8);
      ctx.lineTo(cx0, cy0 + 8);
      ctx.stroke();
    }
  }, [train, data, size, box, dataset, cursor, showCursor]);

  const toData = (clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pad = 28;
    const inner = size - pad - 8;
    const px = ((clientX - rect.left) / rect.width) * size;
    const py = ((clientY - rect.top) / rect.height) * size;
    const x = box.xMin + ((px - pad) / inner) * (box.xMax - box.xMin);
    const y = box.yMin + (1 - (py - 8) / inner) * (box.yMax - box.yMin);
    if (x < box.xMin || x > box.xMax || y < box.yMin || y > box.yMax) return null;
    return [x, y];
  };

  const addPoint = (x: number, y: number) => setCustom((c) => [...c, { x1: x, x2: y, y: addClass }]);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (dataset !== "custom") return;
    const pt = toData(e.clientX, e.clientY);
    if (pt) addPoint(pt[0], pt[1]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (dataset !== "custom") return;
    const stepSize = 0.25;
    const clamp = (v: number) => Math.max(box.xMin, Math.min(box.xMax, v));
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-stepSize, 0],
      ArrowRight: [stepSize, 0],
      ArrowUp: [0, stepSize],
      ArrowDown: [0, -stepSize],
    };
    if (moves[e.key]) {
      e.preventDefault();
      setShowCursor(true);
      setCursor(([x, y]) => [clamp(x + moves[e.key][0]), clamp(y + moves[e.key][1])]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowCursor(true);
      addPoint(cursor[0], cursor[1]);
    }
  };

  const switchDataset = (k: DatasetKey) => {
    setDataset(k);
    reset();
  };

  const mistakes = countMistakes(train.model, data);
  const lastErr = train.history[train.history.length - 1];
  const converged = train.history.length > 0 && lastErr === 0 && train.index === 0;
  const testAcc = dataset === "separable" ? accuracy(train.model, SEPARABLE.test) : null;
  const canRun = data.length > 0;

  const summary = !train.history.length
    ? `No epochs completed. ${data.length} training points.`
    : `Epoch ${train.epoch} finished with total error ${lastErr}.${converged ? " Converged: every training point is classified correctly." : ""}${
        train.epoch >= MAX_EPOCHS && !converged ? ` Stopped after ${MAX_EPOCHS} epochs without converging.` : ""
      }`;

  const controls = (
    <>
      <Button
        variant="primary"
        onClick={() => setPlaying((p) => !p)}
        disabled={!canRun || (!playing && (converged || train.epoch >= MAX_EPOCHS))}
        aria-label={playing ? "Pause training" : "Play training"}
      >
        {playing ? <Pause size={14} weight="fill" aria-hidden /> : <Play size={14} weight="fill" aria-hidden />}
        {playing ? "Pause" : "Play"}
      </Button>
      <Button variant="ghost" onClick={() => commit(stepSample(trainRef.current, data, lr))} disabled={!canRun || playing}>
        <SkipForward size={14} aria-hidden />
        Step
      </Button>
      <Button variant="ghost" onClick={() => commit(stepEpoch(trainRef.current, data, lr))} disabled={!canRun || playing}>
        <FastForward size={14} aria-hidden />
        Epoch
      </Button>
      <Button variant="quiet" onClick={reset} aria-label="Reset weights to zero">
        <ArrowClockwise size={14} aria-hidden />
        Reset
      </Button>
    </>
  );

  return (
    <DemoFrame
      title="Rosenblatt perceptron"
      controls={controls}
      note="Runs the notebook's update rule in your browser: step activation, w += lr(y - y_hat)x, b += lr(y - y_hat), zero start, samples in fixed order. Points come from a seeded JS generator (mulberry32 + Box-Muller, seed 42) because numpy's randn stream can't be reproduced, so error counts differ from the notebook's recorded run (accuracy 0.96)."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_1fr]">
        <div ref={wrapRef} className="min-w-0">
          <canvas
            ref={canvasRef}
            style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 1", height: "auto" }}
            className={cx("block rounded-input border border-line", dataset === "custom" && "cursor-crosshair")}
            tabIndex={dataset === "custom" ? 0 : -1}
            role="img"
            aria-label={
              dataset === "custom"
                ? `Scatter plot. Click to add a class ${addClass === 1 ? "A" : "B"} point, or use arrow keys to move the cursor and Enter to add. ${data.length} points.`
                : `Scatter plot of ${data.length} training points with the current decision line. ${mistakes} misclassified.`
            }
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onBlur={() => setShowCursor(false)}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-faint">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-accent" /> Class A (+1)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 bg-white/80" /> Class B (-1)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full border border-danger" /> Misclassified
            </span>
            <span>Ring: sample just processed</span>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <div className="grid gap-2">
            <span className="text-xs text-fg-muted" id={`${lrId}-ds`}>
              Dataset
            </span>
            <div role="group" aria-labelledby={`${lrId}-ds`} className="flex flex-wrap gap-1.5">
              {DATASETS.map((d) => (
                <Chip key={d.key} active={dataset === d.key} onClick={() => switchDataset(d.key)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <label htmlFor={lrId} className="text-xs text-fg-muted">
                Learning rate
              </label>
              <select id={lrId} value={lr} onChange={(e) => setLr(Number(e.target.value))} className={cx(inputClass, "w-32 font-mono")}>
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {dataset === "custom" ? (
              <div className="grid gap-1.5">
                <span className="text-xs text-fg-muted">New point class</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip active={addClass === 1} onClick={() => setAddClass(1)}>
                    Class A
                  </Chip>
                  <Chip active={addClass === -1} onClick={() => setAddClass(-1)}>
                    Class B
                  </Chip>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setCustom([]);
                      reset();
                    }}
                    disabled={!custom.length}
                  >
                    Clear points
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Stat label="Epoch" value={train.epoch} hint={`sample ${train.index}/${data.length}`} />
            <Stat label="Misclassified" value={mistakes} hint={`of ${data.length} training`} />
            {testAcc !== null ? <Stat label="Test accuracy" value={testAcc.toFixed(2)} hint="100 held-out points" /> : <Stat label="Points" value={data.length} />}
            <Stat label="w1" value={fmt(train.model.w1)} />
            <Stat label="w2" value={fmt(train.model.w2)} />
            <Stat label="b" value={fmt(train.model.b)} />
          </div>

          <Sparkline history={train.history} />

          <p aria-live="polite" className={cx("text-sm", converged ? "text-ok" : "text-fg-muted")}>
            {dataset === "custom" && !data.length ? "Click the plot to add points, then press Play." : summary}
          </p>
          {dataset === "xor" ? (
            <p className="text-xs leading-relaxed text-fg-faint">
              No straight line separates XOR, so the error never reaches zero and the weights keep moving. Play stops after {MAX_EPOCHS} epochs.
            </p>
          ) : null}
        </div>
      </div>
    </DemoFrame>
  );
}
