// Pure KNN face recognition, faithful to i211697_Q2.ipynb.
// Rows are L2-normalised, distances are computed against every training row,
// the k smallest are kept and the label is decided by majority vote with
// Python's `max(set(labels), key=labels.count)` tie-break (smallest label wins).

export type Metric = "euclidean" | "cosine";

export interface Neighbor {
  index: number; // row index in the full dataset
  dist: number;
  label: number;
}

export interface Prediction {
  pred: number;
  neighbors: Neighbor[];
}

export interface Evaluation {
  correct: number;
  total: number;
  accuracy: number;
  predictions: Int32Array; // aligned with the test index list
  confusion: number[][]; // confusion[true][pred]
}

export const PER_SUBJECT = 170;

export function labelOf(row: number, perSubject: number = PER_SUBJECT): number {
  return Math.floor(row / perSubject);
}

/** Divide every row by its L2 norm (pandas `data.div(np.linalg.norm(data, axis=1), axis=0)`). */
export function normalizeRows(raw: ArrayLike<number>, rows: number, dim: number): Float64Array {
  const out = new Float64Array(rows * dim);
  for (let r = 0; r < rows; r++) {
    const off = r * dim;
    let ss = 0;
    for (let j = 0; j < dim; j++) {
      const v = raw[off + j];
      ss += v * v;
    }
    const n = Math.sqrt(ss);
    for (let j = 0; j < dim; j++) out[off + j] = n === 0 ? 0 : raw[off + j] / n;
  }
  return out;
}

/** np.sqrt(np.sum((x1 - x2) ** 2)) */
export function euclidean(data: Float64Array, a: number, b: number, dim: number): number {
  const ao = a * dim;
  const bo = b * dim;
  let s = 0;
  for (let j = 0; j < dim; j++) {
    const d = data[ao + j] - data[bo + j];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** 1 - dot(x1, x2) / (|x1| |x2|) */
export function cosine(data: Float64Array, a: number, b: number, dim: number): number {
  const ao = a * dim;
  const bo = b * dim;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let j = 0; j < dim; j++) {
    const x = data[ao + j];
    const y = data[bo + j];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 1 : 1 - dot / den;
}

/**
 * Majority vote. Among labels tied on count, returns the one that CPython's
 * set iteration would yield first, which for small non-negative ints is the
 * smallest value.
 */
export function majorityVote(labels: number[]): number {
  const counts = new Map<number, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  let best = -1;
  let bestCount = -1;
  const keys = [...counts.keys()].sort((x, y) => x - y);
  for (const l of keys) {
    const c = counts.get(l) as number;
    if (c > bestCount) {
      best = l;
      bestCount = c;
    }
  }
  return best;
}

export function predict(
  data: Float64Array,
  dim: number,
  train: number[],
  query: number,
  k: number,
  metric: Metric,
  perSubject: number = PER_SUBJECT,
): Prediction {
  const fn = metric === "cosine" ? cosine : euclidean;
  const all: Neighbor[] = new Array(train.length);
  for (let i = 0; i < train.length; i++) {
    const idx = train[i];
    all[i] = { index: idx, dist: fn(data, query, idx, dim), label: labelOf(idx, perSubject) };
  }
  // Array.prototype.sort is stable: equal distances keep training order.
  all.sort((x, y) => x.dist - y.dist);
  const neighbors = all.slice(0, Math.max(1, Math.min(k, all.length)));
  return { pred: majorityVote(neighbors.map((n) => n.label)), neighbors };
}

export function emptyConfusion(classes: number): number[][] {
  return Array.from({ length: classes }, () => new Array<number>(classes).fill(0));
}

/** Evaluate a slice [from, to) of the test list, accumulating into `acc`. */
export function evaluateRange(
  data: Float64Array,
  dim: number,
  train: number[],
  test: number[],
  k: number,
  metric: Metric,
  from: number,
  to: number,
  acc: Evaluation,
  perSubject: number = PER_SUBJECT,
): void {
  for (let t = from; t < to; t++) {
    const q = test[t];
    const { pred } = predict(data, dim, train, q, k, metric, perSubject);
    const truth = labelOf(q, perSubject);
    acc.predictions[t] = pred;
    acc.confusion[truth][pred] += 1;
    if (pred === truth) acc.correct += 1;
    acc.total += 1;
    acc.accuracy = acc.correct / acc.total;
  }
}

export function newEvaluation(testCount: number, classes: number): Evaluation {
  return { correct: 0, total: 0, accuracy: 0, predictions: new Int32Array(testCount).fill(-1), confusion: emptyConfusion(classes) };
}

export function evaluateAll(
  data: Float64Array,
  dim: number,
  train: number[],
  test: number[],
  k: number,
  metric: Metric,
  classes: number,
  perSubject: number = PER_SUBJECT,
): Evaluation {
  const acc = newEvaluation(test.length, classes);
  evaluateRange(data, dim, train, test, k, metric, 0, test.length, acc, perSubject);
  return acc;
}
