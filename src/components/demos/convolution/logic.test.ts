import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, absDiff, applyConvolution, outputSize, receptiveField, resizeKernel, toBytes } from "./logic.ts";
import type { Gray, Kernel } from "./logic.ts";

// 5x5 ramp: I[r][c] = 5r + c + 1 (1..25)
const img: Gray = { data: Float64Array.from({ length: 25 }, (_, i) => i + 1), w: 5, h: 5 };
const K: Kernel = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const grid = (g: Gray) => Array.from({ length: g.h }, (_, i) => Array.from(g.data.subarray(i * g.w, (i + 1) * g.w)));

// Hand computation: correlation at (0,0) = 1*1+2*2+3*3+6*4+7*5+8*6+11*7+12*8+13*9 = 411.
// For a linear ramp each step right adds sum(K)=45, each step down adds 5*45=225.
// Convolution uses the flipped kernel [[9,8,7],[6,5,4],[3,2,1]]: at (0,0) = 219.

test("valid, stride 1, correlation", () => {
  const out = applyConvolution(img, K, { stride: 1, padding: "valid", mode: "correlation" });
  assert.deepEqual(grid(out), [
    [411, 456, 501],
    [636, 681, 726],
    [861, 906, 951],
  ]);
});

test("valid, stride 1, convolution flips the kernel", () => {
  const out = applyConvolution(img, K, { stride: 1, padding: "valid", mode: "convolution" });
  assert.deepEqual(grid(out), [
    [219, 264, 309],
    [444, 489, 534],
    [669, 714, 759],
  ]);
});

test("valid, stride 2", () => {
  const corr = applyConvolution(img, K, { stride: 2, padding: "valid", mode: "correlation" });
  assert.deepEqual(grid(corr), [
    [411, 501],
    [861, 951],
  ]);
  const conv = applyConvolution(img, K, { stride: 2, padding: "valid", mode: "convolution" });
  assert.deepEqual(grid(conv), [
    [219, 309],
    [669, 759],
  ]);
});

test("same padding, stride 1: size preserved, corners use zero padding", () => {
  const corr = applyConvolution(img, K, { stride: 1, padding: "same", mode: "correlation" });
  assert.equal(corr.w, 5);
  assert.equal(corr.h, 5);
  // corner (0,0): 5*1 + 6*2 + 8*6 + 9*7 = 128
  assert.equal(corr.data[0], 128);
  // interior equals valid output shifted by one
  assert.equal(corr.data[1 * 5 + 1], 411);
  assert.equal(corr.data[3 * 5 + 3], 951);
  const conv = applyConvolution(img, K, { stride: 1, padding: "same", mode: "convolution" });
  // corner (0,0) with flipped kernel: 5*1 + 4*2 + 2*6 + 1*7 = 32
  assert.equal(conv.data[0], 32);
  assert.equal(conv.data[2 * 5 + 2], 489);
});

test("same padding, stride 2", () => {
  const corr = applyConvolution(img, K, { stride: 2, padding: "same", mode: "correlation" });
  assert.equal(corr.w, 3);
  assert.equal(corr.h, 3);
  assert.equal(corr.data[0], 128);
  assert.equal(corr.data[1 * 3 + 1], 681);
});

test("same padding keeps size for any image size at stride 1 (3x3 and 5x5)", () => {
  for (const [w, h] of [
    [7, 4],
    [13, 9],
    [1, 1],
  ]) {
    for (const size of [3, 5] as const) {
      const k = resizeKernel(PRESETS[0].kernel, size);
      assert.deepEqual(outputSize(w, h, k, { stride: 1, padding: "same", mode: "convolution" }), { w, h });
    }
  }
});

test("symmetric kernels give identical convolution and correlation; asymmetric do not", () => {
  const box = PRESETS.find((p) => p.id === "box")!.kernel;
  const a = applyConvolution(img, box, { stride: 1, padding: "same", mode: "convolution" });
  const b = applyConvolution(img, box, { stride: 1, padding: "same", mode: "correlation" });
  assert.ok(absDiff(a, b).data.every((v) => v < 1e-12));
  const c = applyConvolution(img, K, { stride: 1, padding: "same", mode: "convolution" });
  const d = applyConvolution(img, K, { stride: 1, padding: "same", mode: "correlation" });
  assert.ok(absDiff(c, d).data.some((v) => v > 0));
});

test("receptive field breakdown sums to the output value", () => {
  const opts = { stride: 2, padding: "same", mode: "convolution" } as const;
  const out = applyConvolution(img, K, opts);
  const rf = receptiveField(img, K, opts, 1, 2);
  assert.equal(rf.sum, out.data[1 * out.w + 2]);
  assert.equal(rf.y0, 1);
  assert.equal(rf.x0, 3);
  assert.deepEqual(rf.weights[0], [9, 8, 7]);
});

test("Laplacian preset is the standard kernel and display scaling", () => {
  assert.deepEqual(PRESETS.find((p) => p.id === "laplacian")!.kernel, [
    [0, 1, 0],
    [1, -4, 1],
    [0, 1, 0],
  ]);
  const g: Gray = { data: new Float64Array([-10, 5, 300, 0]), w: 2, h: 2 };
  assert.deepEqual([...toBytes(g, "clamp")], [0, 5, 255, 0]);
  assert.deepEqual([...toBytes(g, "abs")], [9, 4, 255, 0]);
});
