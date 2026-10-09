// Lazy Snapping colour model, following i211697_Q1.ipynb:
//   1. take foreground / background seed pixels from a stroke image
//   2. k-means (N = 64, max_iter = 10) on each seed set in RGB space
//   3. likelihood(p) = sum_k exp(-wk * ||p - c_k||), wk = 0.1
//   4. pixel is foreground when L_F(p) > L_B(p)
// Framework-free so it can run in a Web Worker and under `node --test`.

export const N_CLUSTERS = 64;
export const MAX_ITER = 10;
export const WK = 0.1;
export const MAX_SEEDS = 4000;

export type SeedKind = 0 | 1 | 2; // 0 = none, 1 = foreground, 2 = background

/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
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

/** Classify a stroke colour: red = foreground, blue-ish = background. */
export function strokeKind(r: number, g: number, b: number): SeedKind {
  if (r > 200 && g < 60 && b < 60) return 1;
  if (b > 200 && r < 60 && g < 60) return 2;
  return 0;
}

/** Turn an RGBA stroke image into a per-pixel seed map. */
export function seedMapFromStroke(stroke: ArrayLike<number>, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (stroke[o + 3] < 128) continue;
    out[i] = strokeKind(stroke[o], stroke[o + 1], stroke[o + 2]);
  }
  return out;
}

/** Evenly strided deterministic subsample of indices, at most `max` long. */
export function subsample(indices: number[], max: number): number[] {
  if (indices.length <= max) return indices;
  const out: number[] = [];
  const step = indices.length / max;
  for (let i = 0; i < max; i++) out.push(indices[Math.floor(i * step)]);
  return out;
}

/** Gather RGB triples of the image at the given pixel indices. */
export function gatherRGB(image: ArrayLike<number>, indices: number[]): Float64Array {
  const out = new Float64Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const o = indices[i] * 4;
    out[i * 3] = image[o];
    out[i * 3 + 1] = image[o + 1];
    out[i * 3 + 2] = image[o + 2];
  }
  return out;
}

function sqDist3(a: Float64Array, ai: number, b: Float64Array, bi: number): number {
  const dr = a[ai] - b[bi];
  const dg = a[ai + 1] - b[bi + 1];
  const db = a[ai + 2] - b[bi + 2];
  return dr * dr + dg * dg + db * db;
}

export interface KMeansResult {
  centroids: Float64Array; // k * 3
  labels: Int32Array;
  iterations: number;
  converged: boolean;
  inertia: number;
}

/**
 * Lloyd's k-means with k-means++ initialisation (as sklearn's KMeans default),
 * seeded so results are reproducible. `points` is a flat array of RGB triples.
 * If there are fewer points than clusters, k is reduced to the point count.
 */
export function kmeans(points: Float64Array, k: number, maxIter: number = MAX_ITER, seed: number = 0): KMeansResult {
  const n = points.length / 3;
  if (n === 0) return { centroids: new Float64Array(0), labels: new Int32Array(0), iterations: 0, converged: true, inertia: 0 };
  const K = Math.min(k, n);
  const rand = mulberry32(seed);
  const C = new Float64Array(K * 3);

  // k-means++ seeding
  const first = Math.floor(rand() * n);
  C.set(points.subarray(first * 3, first * 3 + 3), 0);
  const d2 = new Float64Array(n);
  for (let i = 0; i < n; i++) d2[i] = sqDist3(points, i * 3, C, 0);
  for (let c = 1; c < K; c++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += d2[i];
    let pick = 0;
    if (sum === 0) {
      pick = Math.floor(rand() * n);
    } else {
      let r = rand() * sum;
      for (pick = 0; pick < n - 1; pick++) {
        r -= d2[pick];
        if (r <= 0) break;
      }
    }
    C.set(points.subarray(pick * 3, pick * 3 + 3), c * 3);
    for (let i = 0; i < n; i++) {
      const d = sqDist3(points, i * 3, C, c * 3);
      if (d < d2[i]) d2[i] = d;
    }
  }

  const labels = new Int32Array(n).fill(-1);
  const sums = new Float64Array(K * 3);
  const counts = new Int32Array(K);
  let iterations = 0;
  let converged = false;
  let inertia = 0;
  for (let it = 0; it < maxIter; it++) {
    iterations = it + 1;
    let changed = 0;
    inertia = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < K; c++) {
        const d = sqDist3(points, i * 3, C, c * 3);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      inertia += bestD;
      if (labels[i] !== best) {
        labels[i] = best;
        changed++;
      }
    }
    if (changed === 0) {
      converged = true;
      break;
    }
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      sums[c * 3] += points[i * 3];
      sums[c * 3 + 1] += points[i * 3 + 1];
      sums[c * 3 + 2] += points[i * 3 + 2];
      counts[c]++;
    }
    for (let c = 0; c < K; c++) {
      if (counts[c] === 0) continue; // empty cluster keeps its centroid
      C[c * 3] = sums[c * 3] / counts[c];
      C[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
      C[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
    }
  }
  return { centroids: C, labels, iterations, converged, inertia };
}

/** sum over centroids of exp(-wk * euclidean(pixel, centroid)), as compute_likelihood in the notebook. */
export function likelihood(r: number, g: number, b: number, centroids: Float64Array, wk: number = WK): number {
  let s = 0;
  for (let c = 0; c < centroids.length; c += 3) {
    const dr = r - centroids[c];
    const dg = g - centroids[c + 1];
    const db = b - centroids[c + 2];
    s += Math.exp(-wk * Math.sqrt(dr * dr + dg * dg + db * db));
  }
  return s;
}

/**
 * Foreground mask (1 = foreground, 0 = background) for pixels [from, to) of an RGBA image.
 * Identical colours are cached, which matters for paintings with flat regions.
 */
export function classifyRange(
  image: ArrayLike<number>,
  fg: Float64Array,
  bg: Float64Array,
  from: number,
  to: number,
  out: Uint8Array,
  cache: Map<number, number> = new Map(),
  wk: number = WK,
): void {
  for (let i = from; i < to; i++) {
    const o = i * 4;
    const r = image[o];
    const g = image[o + 1];
    const b = image[o + 2];
    const key = (r << 16) | (g << 8) | b;
    let v = cache.get(key);
    if (v === undefined) {
      v = likelihood(r, g, b, fg, wk) > likelihood(r, g, b, bg, wk) ? 1 : 0;
      cache.set(key, v);
    }
    out[i] = v;
  }
}

export function classify(image: ArrayLike<number>, w: number, h: number, fg: Float64Array, bg: Float64Array, wk: number = WK): Uint8Array {
  const out = new Uint8Array(w * h);
  classifyRange(image, fg, bg, 0, w * h, out, new Map(), wk);
  return out;
}

export interface SegmentStats {
  fgSeeds: number;
  bgSeeds: number;
  fgUsed: number;
  bgUsed: number;
  fgIterations: number;
  bgIterations: number;
  fgClusters: number;
  bgClusters: number;
  foregroundPixels: number;
}

/** Collect seed indices of each kind from a seed map. */
export function seedIndices(seeds: Uint8Array): { fg: number[]; bg: number[] } {
  const fg: number[] = [];
  const bg: number[] = [];
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i] === 1) fg.push(i);
    else if (seeds[i] === 2) bg.push(i);
  }
  return { fg, bg };
}

/** Fit both colour models from the seed map. Seed colours are read from the original image. */
export function fitModels(image: ArrayLike<number>, seeds: Uint8Array, seed: number = 0, k: number = N_CLUSTERS, maxIter: number = MAX_ITER) {
  const { fg, bg } = seedIndices(seeds);
  const fgUsed = subsample(fg, MAX_SEEDS);
  const bgUsed = subsample(bg, MAX_SEEDS);
  const fgModel = kmeans(gatherRGB(image, fgUsed), k, maxIter, seed);
  const bgModel = kmeans(gatherRGB(image, bgUsed), k, maxIter, seed);
  return { fg, bg, fgUsed, bgUsed, fgModel, bgModel };
}
