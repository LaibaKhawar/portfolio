/**
 * Rosenblatt's perceptron, ported from "Rosenblatt’s Perceptron.ipynb".
 *
 * Notebook rule (per sample, fixed order, no shuffling):
 *   y_hat = step(w . x + b), step(z) = 1 if z >= 0 else -1
 *   error = y - y_hat               (0 or +-2)
 *   total_error += |error|          (so an epoch's total is 2 x mistakes)
 *   w += lr * error * x
 *   b += lr * error
 * Weights and bias start at zero.
 */

export type Point = { x1: number; x2: number; y: 1 | -1 };

/** Seeded PRNG (mulberry32). numpy's randn stream can't be reproduced in JS. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sampler via Box-Muller. */
export function gaussian(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** generate_data: randn(n, 2), y = 1 if x1 + x2 > 0 else -1. */
export function generateSeparable(n = 500, seed = 42): Point[] {
  const g = gaussian(mulberry32(seed));
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = g();
    const x2 = g();
    pts.push({ x1, x2, y: x1 + x2 > 0 ? 1 : -1 });
  }
  return pts;
}

/** XOR: four Gaussian blobs, opposite corners share a class. Not linearly separable. */
export function generateXor(n = 200, seed = 7, spread = 0.45): Point[] {
  const g = gaussian(mulberry32(seed));
  const centers: Array<[number, number, 1 | -1]> = [
    [1.4, 1.4, 1],
    [-1.4, -1.4, 1],
    [-1.4, 1.4, -1],
    [1.4, -1.4, -1],
  ];
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [cx, cy, y] = centers[i % 4];
    pts.push({ x1: cx + g() * spread, x2: cy + g() * spread, y });
  }
  return pts;
}

/** Seeded shuffle split, standing in for train_test_split(test_size=0.2). */
export function trainTestSplit<T>(items: T[], testSize = 0.2, seed = 42): { train: T[]; test: T[] } {
  const rand = mulberry32(seed);
  const idx = items.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTest = Math.ceil(items.length * testSize);
  return { test: idx.slice(0, nTest).map((i) => items[i]), train: idx.slice(nTest).map((i) => items[i]) };
}

export const step = (z: number): 1 | -1 => (z >= 0 ? 1 : -1);

export type Model = { w1: number; w2: number; b: number };

export const predict = (m: Model, p: { x1: number; x2: number }) => step(m.w1 * p.x1 + m.w2 * p.x2 + m.b);

/** One sample update. Returns the new model and |y - y_hat|. */
export function updateOne(m: Model, p: Point, lr: number): { model: Model; error: number } {
  const yHat = predict(m, p);
  const error = p.y - yHat;
  return {
    model: { w1: m.w1 + lr * error * p.x1, w2: m.w2 + lr * error * p.x2, b: m.b + lr * error },
    error: Math.abs(error),
  };
}

export type TrainState = {
  model: Model;
  epoch: number; // completed epochs
  index: number; // next sample in the current epoch
  epochError: number; // running total_error for the current epoch
  history: number[]; // total_error per completed epoch
  lastIndex: number | null; // sample processed most recently
  lastUpdated: boolean;
};

export const initialState = (): TrainState => ({
  model: { w1: 0, w2: 0, b: 0 },
  epoch: 0,
  index: 0,
  epochError: 0,
  history: [],
  lastIndex: null,
  lastUpdated: false,
});

/** Process one sample. Closes the epoch when the last sample is done. */
export function stepSample(s: TrainState, data: Point[], lr: number): TrainState {
  if (!data.length) return s;
  const i = s.index;
  const { model, error } = updateOne(s.model, data[i], lr);
  const epochError = s.epochError + error;
  const done = i + 1 >= data.length;
  return {
    model,
    epoch: done ? s.epoch + 1 : s.epoch,
    index: done ? 0 : i + 1,
    epochError: done ? 0 : epochError,
    history: done ? [...s.history, epochError] : s.history,
    lastIndex: i,
    lastUpdated: error !== 0,
  };
}

/** Finish the current epoch (or run a full one if at its start). */
export function stepEpoch(s: TrainState, data: Point[], lr: number): TrainState {
  if (!data.length) return s;
  let cur = stepSample(s, data, lr);
  while (cur.index !== 0) cur = stepSample(cur, data, lr);
  return cur;
}

/** Notebook fit(): n_iters epochs from zero weights. */
export function fit(data: Point[], lr: number, epochs: number): TrainState {
  let s = initialState();
  for (let e = 0; e < epochs; e++) s = stepEpoch(s, data, lr);
  return s;
}

export function countMistakes(m: Model, data: Point[]): number {
  let c = 0;
  for (const p of data) if (predict(m, p) !== p.y) c++;
  return c;
}

export function accuracy(m: Model, data: Point[]): number {
  return data.length ? 1 - countMistakes(m, data) / data.length : 0;
}

export type Box = { xMin: number; xMax: number; yMin: number; yMax: number };

/**
 * Clip the box to the half-plane w1*x + w2*y + b >= 0 (Sutherland-Hodgman,
 * one edge). Used to shade the region the model predicts as class +1.
 */
export function positiveRegion(m: Model, box: Box): Array<[number, number]> {
  const poly: Array<[number, number]> = [
    [box.xMin, box.yMin],
    [box.xMax, box.yMin],
    [box.xMax, box.yMax],
    [box.xMin, box.yMax],
  ];
  const f = (p: [number, number]) => m.w1 * p[0] + m.w2 * p[1] + m.b;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const c = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fc = f(c);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fc >= 0) {
      const t = fa / (fa - fc);
      out.push([a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]);
    }
  }
  return out;
}

/** Endpoints of the decision line inside the box, or null if it misses the box or w = 0. */
export function decisionSegment(m: Model, box: Box): [[number, number], [number, number]] | null {
  if (m.w1 === 0 && m.w2 === 0) return null;
  const pts: Array<[number, number]> = [];
  const f = (x: number, y: number) => m.w1 * x + m.w2 * y + m.b;
  const corners: Array<[number, number]> = [
    [box.xMin, box.yMin],
    [box.xMax, box.yMin],
    [box.xMax, box.yMax],
    [box.xMin, box.yMax],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const c = corners[(i + 1) % 4];
    const fa = f(a[0], a[1]);
    const fc = f(c[0], c[1]);
    if (fa === 0) pts.push(a);
    if ((fa < 0 && fc > 0) || (fa > 0 && fc < 0)) {
      const t = fa / (fa - fc);
      pts.push([a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]);
    }
  }
  if (pts.length < 2) return null;
  return [pts[0], pts[1]];
}
