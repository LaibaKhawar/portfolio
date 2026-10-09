import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, fitModels, kmeans, likelihood, mulberry32, seedMapFromStroke, strokeKind, subsample } from "./logic.ts";

function rgbaFrom(colors: Array<[number, number, number]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], i) => out.set([r, g, b, 255], i * 4));
  return out;
}

test("likelihood matches sum of exp(-0.1 * distance) on hand-computed values", () => {
  // distances from (0,0,0): 5 (3,4,0) and 13 (5,12,0)
  const centroids = new Float64Array([3, 4, 0, 5, 12, 0]);
  const expected = Math.exp(-0.5) + Math.exp(-1.3);
  assert.ok(Math.abs(likelihood(0, 0, 0, centroids) - expected) < 1e-15);
  // a single centroid at the pixel contributes exp(0) = 1
  assert.equal(likelihood(10, 20, 30, new Float64Array([10, 20, 30])), 1);
  // custom wk
  assert.ok(Math.abs(likelihood(0, 0, 0, new Float64Array([0, 0, 10]), 0.2) - Math.exp(-2)) < 1e-15);
});

test("k-means converges on a synthetic 2-colour set", () => {
  const rand = mulberry32(7);
  const pts: number[] = [];
  for (let i = 0; i < 200; i++) {
    const base = i % 2 === 0 ? [20, 30, 40] : [220, 200, 180];
    pts.push(base[0] + rand() * 4 - 2, base[1] + rand() * 4 - 2, base[2] + rand() * 4 - 2);
  }
  const res = kmeans(new Float64Array(pts), 2, 10, 0);
  assert.equal(res.converged, true);
  assert.ok(res.iterations <= 10);
  const c = [...res.centroids];
  const a = [c[0], c[1], c[2]];
  const b = [c[3], c[4], c[5]];
  const [lo, hi] = a[0] < b[0] ? [a, b] : [b, a];
  for (let j = 0; j < 3; j++) {
    assert.ok(Math.abs(lo[j] - [20, 30, 40][j]) < 1);
    assert.ok(Math.abs(hi[j] - [220, 200, 180][j]) < 1);
  }
  // every even point in one cluster, every odd in the other
  for (let i = 2; i < 200; i++) assert.equal(res.labels[i], res.labels[i % 2]);
  assert.notEqual(res.labels[0], res.labels[1]);
});

test("k-means is deterministic for a fixed seed and clamps k to point count", () => {
  const pts = new Float64Array([1, 2, 3, 4, 5, 6, 200, 100, 50, 7, 8, 9]);
  const a = kmeans(pts, 64, 10, 3);
  const b = kmeans(pts, 64, 10, 3);
  assert.deepEqual([...a.centroids], [...b.centroids]);
  assert.equal(a.centroids.length, 4 * 3);
});

test("classification separates two synthetic colour clusters", () => {
  const w = 20;
  const h = 10;
  const colors: Array<[number, number, number]> = [];
  const rand = mulberry32(11);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const j = () => Math.round(rand() * 10 - 5);
      colors.push(x < 10 ? [200 + j(), 60 + j(), 50 + j()] : [40 + j(), 90 + j(), 180 + j()]);
    }
  const image = rgbaFrom(colors);
  // stroke: red on column 2, blue on column 17
  const strokeColors: Array<[number, number, number]> = colors.map((_, i) => {
    const x = i % w;
    return x === 2 ? [255, 0, 0] : x === 17 ? [6, 0, 255] : [0, 0, 0];
  });
  const seeds = seedMapFromStroke(rgbaFrom(strokeColors), w, h);
  const { fg, bg, fgModel, bgModel } = fitModels(image, seeds, 0);
  assert.equal(fg.length, h);
  assert.equal(bg.length, h);
  const mask = classify(image, w, h, fgModel.centroids, bgModel.centroids);
  for (let i = 0; i < w * h; i++) assert.equal(mask[i], i % w < 10 ? 1 : 0);
});

test("stroke colours and subsampling", () => {
  assert.equal(strokeKind(255, 0, 0), 1);
  assert.equal(strokeKind(6, 0, 255), 2);
  assert.equal(strokeKind(0, 0, 0), 0);
  const idx = Array.from({ length: 10000 }, (_, i) => i);
  const s = subsample(idx, 4000);
  assert.equal(s.length, 4000);
  assert.deepEqual(subsample(idx, 4000), s);
});
