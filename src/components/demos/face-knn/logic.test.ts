import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cosine, euclidean, evaluateAll, labelOf, majorityVote, normalizeRows, predict } from "./logic.ts";

const dir = new URL("../../../../public/demos/face-knn/", import.meta.url);
const split = JSON.parse(readFileSync(new URL("split.json", dir), "utf8"));
const raw = new Uint8Array(readFileSync(new URL("faces.u8", dir)));

test("dataset shape matches split.json", () => {
  assert.equal(raw.length, split.rows * split.dim);
  assert.equal(split.train.length, 1500);
  assert.equal(split.test.length, 200);
});

test("rows are L2-normalised", () => {
  const data = normalizeRows(raw, split.rows, split.dim);
  for (const r of [0, 777, 1699]) {
    let s = 0;
    for (let j = 0; j < split.dim; j++) s += data[r * split.dim + j] ** 2;
    assert.ok(Math.abs(s - 1) < 1e-12);
  }
});

test("majority vote tie-break picks smallest label (CPython set order)", () => {
  assert.equal(majorityVote([3, 1, 3, 1]), 1);
  assert.equal(majorityVote([9, 2, 9]), 9);
  assert.equal(majorityVote([5, 4, 7]), 4);
});

test("distance functions", () => {
  const d = new Float64Array([3, 4, 0, 0, 1, 0]);
  assert.equal(euclidean(d, 0, 1, 2), Math.sqrt(9 + 16));
  assert.ok(Math.abs(cosine(d, 0, 2, 2) - (1 - 3 / 5)) < 1e-12);
});

test("k=7 Euclidean KNN reproduces the notebook accuracy of 0.96 (192/200)", () => {
  const data = normalizeRows(raw, split.rows, split.dim);
  const ev = evaluateAll(data, split.dim, split.train, split.test, 7, "euclidean", 10);
  assert.equal(ev.correct, 192);
  assert.equal(ev.accuracy, split.recorded.knn);
  let sum = 0;
  for (const row of ev.confusion) for (const v of row) sum += v;
  assert.equal(sum, 200);
});

test("predict returns k sorted neighbours with labels", () => {
  const data = normalizeRows(raw, split.rows, split.dim);
  const q = split.test[0];
  const p = predict(data, split.dim, split.train, q, 7, "euclidean");
  assert.equal(p.neighbors.length, 7);
  for (let i = 1; i < 7; i++) assert.ok(p.neighbors[i].dist >= p.neighbors[i - 1].dist);
  for (const n of p.neighbors) assert.equal(n.label, labelOf(n.index));
});
