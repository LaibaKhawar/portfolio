"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { Button, Chip, DemoFrame, ErrorNote, Skeleton, Stat, cx, inputClass } from "@/components/ui/primitives";
import { PRESETS, absDiff, applyConvolution, autoScale, receptiveField, resizeKernel, rgbaToGray, toBytes } from "./logic";
import type { Gray, Kernel, Mode, Padding } from "./logic";

const DEFAULT_SRC = "/demos/lazy-snapping/van-gogh.png";
const MAX_SIDE = 512;

type View = "output" | "difference";

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return String(Number(v.toFixed(4)));
}

function fmtCell(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100 || Number.isInteger(v)) return String(Math.round(v * 10) / 10);
  return v.toFixed(2);
}

async function loadGray(src: string): Promise<Gray> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.drawImage(img, 0, 0, w, h);
  return rgbaToGray(ctx.getImageData(0, 0, w, h).data, w, h);
}

function paintGray(canvas: HTMLCanvasElement | null, w: number, h: number, bytes: Uint8ClampedArray) {
  if (!canvas) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || w === 0 || h === 0) return;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < bytes.length; i++) {
    const o = i * 4;
    img.data[o] = bytes[i];
    img.data[o + 1] = bytes[i];
    img.data[o + 2] = bytes[i];
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Runs the convolution (and the opposite mode for the difference view) and times it. */
function runConvolution(gray: Gray, kernel: Kernel, opts: { stride: number; padding: Padding; mode: Mode }, withDiff: boolean) {
  const t0 = performance.now();
  const out = applyConvolution(gray, kernel, opts);
  let diff: Gray | null = null;
  let maxDiff = 0;
  if (withDiff) {
    const other = applyConvolution(gray, kernel, { ...opts, mode: opts.mode === "convolution" ? "correlation" : "convolution" });
    diff = absDiff(out, other);
    for (const v of diff.data) if (v > maxDiff) maxDiff = v;
  }
  return { out, diff, maxDiff, scale: autoScale(kernel), ms: performance.now() - t0 };
}

const asText = (k: Kernel) => k.map((r) => r.map(fmt));

export default function ConvolutionDemo() {
  const reduceMotion = useReducedMotion();
  const [input, setInput] = useState<{ gray: Gray; name: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>("sobel-x");
  const [kernel, setKernel] = useState<Kernel>(() => PRESETS.find((p) => p.id === "sobel-x")!.kernel);
  const [text, setText] = useState<string[][]>(() => asText(PRESETS.find((p) => p.id === "sobel-x")!.kernel));
  const [stride, setStride] = useState(1);
  const [padding, setPadding] = useState<Padding>("same");
  const [mode, setMode] = useState<Mode>("convolution");
  const [view, setView] = useState<View>("output");
  const [probe, setProbe] = useState<{ i: number; j: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const inRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGray(DEFAULT_SRC)
      .then((gray) => {
        if (!cancelled) setInput({ gray, name: "Van Gogh (repository image, grayscale)" });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the default image.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadGray(url)
      .then((gray) => {
        setLoadError(null);
        setProbe(null);
        setInput({ gray, name: `${f.name} (grayscale, ${gray.w} x ${gray.h})` });
      })
      .catch(() => setLoadError("That file could not be decoded as an image."))
      .finally(() => URL.revokeObjectURL(url));
  };

  const dKernel = useDeferredValue(kernel);
  const opts = useMemo(() => ({ stride, padding, mode }), [stride, padding, mode]);

  const computed = useMemo(() => (input ? runConvolution(input.gray, dKernel, opts, view === "difference") : null), [input, dKernel, opts, view]);

  useEffect(() => {
    if (input) paintGray(inRef.current, input.gray.w, input.gray.h, toBytes(input.gray, "clamp"));
  }, [input]);

  useEffect(() => {
    if (!computed) return;
    const g = computed.diff ?? computed.out;
    paintGray(outRef.current, g.w, g.h, toBytes(g, computed.diff ? "abs" : computed.scale));
  }, [computed]);

  // Sliding-window animation (user started). Steps by output pixels so it follows the stride.
  useEffect(() => {
    if (!playing || !computed) return;
    const { w, h } = computed.out;
    const step = Math.max(1, Math.round(w / 24));
    const id = window.setInterval(
      () => {
        setProbe((p) => {
          const cur = p ?? { i: 0, j: -step };
          let j = cur.j + step;
          let i = cur.i;
          if (j >= w) {
            j = 0;
            i = i + step >= h ? 0 : i + step;
          }
          return { i, j };
        });
      },
      reduceMotion ? 400 : 90,
    );
    return () => window.clearInterval(id);
  }, [playing, computed, reduceMotion]);

  const k = kernel.length;
  const kernelSum = kernel.flat().reduce((a, b) => a + b, 0);

  const choosePreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    const next = resizeKernel(p.kernel, k as 3 | 5);
    setPresetId(id);
    setKernel(next);
    setText(asText(next));
  };

  const setSize = (size: 3 | 5) => {
    if (size === k) return;
    const next = resizeKernel(kernel, size);
    setKernel(next);
    setText(asText(next));
    setProbe(null);
  };

  const editCell = (a: number, b: number, value: string) => {
    const t = text.map((r) => r.slice());
    t[a][b] = value;
    const n = Number(value);
    const nk = kernel.map((r) => r.slice());
    nk[a][b] = value.trim() === "" || !Number.isFinite(n) ? 0 : n;
    setText(t);
    setKernel(nk);
    setPresetId("custom");
  };

  const out = computed?.out;
  const probeValid = probe && out && probe.i < out.h && probe.j < out.w ? probe : null;
  const rf = useMemo(
    () => (input && probeValid ? receptiveField(input.gray, dKernel, opts, probeValid.i, probeValid.j) : null),
    [input, probeValid, dKernel, opts],
  );

  const onOutPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!out) return;
    const r = e.currentTarget.getBoundingClientRect();
    const j = Math.min(out.w - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * out.w)));
    const i = Math.min(out.h - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * out.h)));
    setPlaying(false);
    setProbe({ i, j });
  };

  const onOutKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!out) return;
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const mv = d[e.key];
    if (!mv) return;
    e.preventDefault();
    setPlaying(false);
    const big = e.shiftKey ? 10 : 1;
    setProbe((p) => {
      const cur = p ?? { i: Math.floor(out.h / 2), j: Math.floor(out.w / 2) };
      return {
        i: Math.min(out.h - 1, Math.max(0, cur.i + mv[0] * big)),
        j: Math.min(out.w - 1, Math.max(0, cur.j + mv[1] * big)),
      };
    });
  };

  const transition = reduceMotion ? undefined : "left 80ms linear, top 80ms linear";
  const scaleNote = !computed
    ? ""
    : computed.diff
      ? `Showing |convolution - correlation|, rescaled so the largest difference (${fmtCell(computed.maxDiff)}) is white. A symmetric kernel gives an all-black image.`
      : computed.scale === "abs"
        ? `This kernel sums to ${fmt(kernelSum)}, so it responds to change: output shown as |value| rescaled to 0..255.`
        : `This kernel sums to ${fmt(kernelSum)}: output values are clamped to 0..255.`;

  return (
    <DemoFrame
      title="Convolution from scratch"
      note="Runs in your browser: the notebook's apply_convolution loop (flip for convolution, zero padding for same) ported to TypeScript. The repository's original input image is not committed, so the default input is the Van Gogh painting in grayscale. Uploaded images stay on your device."
      controls={
        <>
          <Chip active={mode === "convolution"} onClick={() => setMode("convolution")}>
            Convolution
          </Chip>
          <Chip active={mode === "correlation"} onClick={() => setMode("correlation")}>
            Correlation
          </Chip>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kernel presets">
          {PRESETS.map((p) => (
            <Chip key={p.id} active={presetId === p.id} onClick={() => choosePreset(p.id)}>
              {p.name}
            </Chip>
          ))}
          {presetId === "custom" ? <Chip active>Custom</Chip> : null}
        </div>

        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <fieldset className="grid content-start gap-2">
            <legend className="mb-2 flex w-full items-center gap-3 text-xs text-fg-muted">
              Kernel
              <span className="font-mono tabular-nums text-fg-faint">sum {fmt(kernelSum)}</span>
            </legend>
            <div className="grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${k}, minmax(0, 3.75rem))` }}>
              {text.map((row, a) =>
                row.map((v, b) => (
                  <input
                    key={`${a}-${b}`}
                    type="text"
                    inputMode="decimal"
                    aria-label={`Kernel row ${a + 1} column ${b + 1}`}
                    value={v}
                    onChange={(e) => editCell(a, b, e.target.value)}
                    className={cx(inputClass, "px-1.5 py-1.5 text-center font-mono text-xs tabular-nums")}
                  />
                )),
              )}
            </div>
            <div className="mt-1 flex gap-2">
              <Chip active={k === 3} onClick={() => setSize(3)}>
                3x3
              </Chip>
              <Chip active={k === 5} onClick={() => setSize(5)}>
                5x5
              </Chip>
            </div>
          </fieldset>

          <div className="grid content-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="conv-stride" className="flex justify-between text-xs text-fg-muted">
                <span>Stride</span>
                <span className="font-mono tabular-nums text-fg">{stride}</span>
              </label>
              <input
                id="conv-stride"
                type="range"
                min={1}
                max={4}
                value={stride}
                onChange={(e) => {
                  setStride(Number(e.target.value));
                  setProbe(null);
                }}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-fg-muted" id="conv-pad-label">
                Padding
              </span>
              <div className="flex gap-2" role="group" aria-labelledby="conv-pad-label">
                <Chip active={padding === "valid"} onClick={() => setPadding("valid")}>
                  Valid
                </Chip>
                <Chip active={padding === "same"} onClick={() => setPadding("same")}>
                  Same (zeros)
                </Chip>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-fg-muted" id="conv-view-label">
                Right panel
              </span>
              <div className="flex gap-2" role="group" aria-labelledby="conv-view-label">
                <Chip active={view === "output"} onClick={() => setView("output")}>
                  Output
                </Chip>
                <Chip active={view === "difference"} onClick={() => setView("difference")}>
                  |conv - corr|
                </Chip>
              </div>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="conv-file" className="text-xs text-fg-muted">
                Your own image
              </label>
              <input
                id="conv-file"
                type="file"
                accept="image/*"
                onChange={onFile}
                className="text-xs text-fg-muted file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-transparent file:px-3 file:py-1 file:text-xs file:text-fg hover:file:border-fg-muted"
              />
            </div>
          </div>
        </div>

        {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <figure className="min-w-0">
            <div className="relative overflow-hidden rounded-input border border-line bg-bg" style={{ aspectRatio: input ? `${input.gray.w} / ${input.gray.h}` : "414 / 495" }}>
              {!input ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
              <canvas ref={inRef} role="img" aria-label="Input image in grayscale" className={cx("absolute inset-0 size-full", !input && "invisible")} />
              {rf && input ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  style={{
                    left: `${(rf.x0 / input.gray.w) * 100}%`,
                    top: `${(rf.y0 / input.gray.h) * 100}%`,
                    width: `max(10px, ${(k / input.gray.w) * 100}%)`,
                    height: `max(10px, ${(k / input.gray.h) * 100}%)`,
                    transition,
                  }}
                />
              ) : null}
            </div>
            <figcaption className="mt-1.5 truncate text-xs text-fg-faint">{input ? input.name : "Loading input"}</figcaption>
          </figure>
          <figure className="min-w-0">
            <div className="relative overflow-hidden rounded-input border border-line bg-bg" style={{ aspectRatio: out ? `${Math.max(1, out.w)} / ${Math.max(1, out.h)}` : "414 / 495" }}>
              {!computed ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
              <canvas
                ref={outRef}
                tabIndex={0}
                role="img"
                aria-label="Output image. Hover, tap or use arrow keys to inspect one output pixel."
                onPointerDown={onOutPointer}
                onPointerMove={(e) => {
                  if (e.pointerType === "mouse" || e.buttons) onOutPointer(e);
                }}
                onKeyDown={onOutKey}
                className={cx("absolute inset-0 size-full cursor-crosshair touch-none", !computed && "invisible")}
              />
              {probeValid && out ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute border-2 border-accent"
                  style={{
                    left: `${(probeValid.j / out.w) * 100}%`,
                    top: `${(probeValid.i / out.h) * 100}%`,
                    width: `max(6px, ${100 / out.w}%)`,
                    height: `max(6px, ${100 / out.h}%)`,
                    transition,
                  }}
                />
              ) : null}
            </div>
            <figcaption className="mt-1.5 text-xs text-fg-faint">{view === "difference" ? "Difference" : mode === "convolution" ? "Convolution output" : "Correlation output"}</figcaption>
          </figure>
        </div>

        <p className="text-xs text-fg-muted">{scaleNote}</p>

        <div className="grid gap-5 border-t border-line pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Input" value={input ? `${input.gray.w}x${input.gray.h}` : "-"} />
              <Stat label="Output" value={out ? `${out.w}x${out.h}` : "-"} hint={`(n ${padding === "same" ? `+ 2x${Math.floor((k - 1) / 2)} ` : ""}- ${k}) / ${stride} + 1`} />
              <Stat label="Time" value={computed ? `${computed.ms.toFixed(1)} ms` : "-"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={!computed} aria-pressed={playing}>
                {playing ? "Pause window" : "Slide window"}
              </Button>
              {mode === "convolution" ? (
                <p className="self-center text-xs text-fg-faint">Convolution flips the kernel on both axes before multiplying.</p>
              ) : (
                <p className="self-center text-xs text-fg-faint">Correlation multiplies with the kernel as written.</p>
              )}
            </div>
          </div>
          <div aria-live="polite" className="min-w-0">
            {rf && probeValid ? (
              <div className="grid gap-2">
                <div className="text-xs text-fg-muted">
                  Output pixel ({probeValid.i}, {probeValid.j}) = sum of input x {mode === "convolution" ? "flipped kernel" : "kernel"}
                </div>
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-[3px] font-mono text-[11px] tabular-nums">
                    <caption className="sr-only">Multiply-accumulate for the selected output pixel</caption>
                    <tbody>
                      {rf.values.map((row, a) => (
                        <tr key={a}>
                          {row.map((v, b) => (
                            <td key={b} className={cx("rounded-[4px] px-1.5 py-1 text-center", rf.weights[a][b] !== 0 ? "bg-accent-soft text-fg" : "bg-fg/[0.03] text-fg-faint")}>
                              <span className="block text-fg-muted">
                                {fmtCell(v)}
                                <span className="text-fg-faint"> x </span>
                                {fmtCell(rf.weights[a][b])}
                              </span>
                              <span className="block">{fmtCell(rf.products[a][b])}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="font-mono text-sm tabular-nums text-fg">
                  sum = <span className="text-accent">{fmtCell(rf.sum)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-faint">Hover or tap the output image, or focus it and use the arrow keys, to see the multiply-accumulate behind one output pixel.</p>
            )}
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
