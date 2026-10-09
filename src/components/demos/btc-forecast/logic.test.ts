import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arReturnsForecast, evaluateAll, fitAR, leastSquares, mae, mape, metrics, persistence, polyTimeFit, rmse } from "./logic.ts";

const close = (n: number) => (a: number, b: number) => Math.abs(a - b) < n;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randn(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

test("least squares recovers known coefficients", () => {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 50; i++) {
    const a = i / 10;
    const b = Math.sin(i);
    X.push([1, a, b]);
    y.push(2 - 3 * a + 0.5 * b);
  }
  const beta = leastSquares(X, y);
  assert.ok(close(1e-9)(beta[0], 2));
  assert.ok(close(1e-9)(beta[1], -3));
  assert.ok(close(1e-9)(beta[2], 0.5));
});

test("polynomial-on-time fit recovers a cubic exactly in sample", () => {
  const series = Array.from({ length: 300 }, (_, t) => 100 + 0.5 * t - 0.002 * t * t + 1e-5 * t ** 3);
  const { fitted } = polyTimeFit(series, 240, 3);
  for (let t = 0; t < 300; t++) assert.ok(close(1e-6)(fitted[t], series[t]), `t=${t}`);
});

test("metrics on toy arrays", () => {
  const a = [100, 200, 400];
  const p = [110, 180, 400];
  assert.ok(close(1e-12)(rmse(a, p), Math.sqrt((100 + 400 + 0) / 3)));
  assert.ok(close(1e-12)(mae(a, p), 10));
  assert.ok(close(1e-12)(mape(a, p), ((0.1 + 0.1 + 0) / 3) * 100));
});

test("persistence RMSE on a toy series", () => {
  const s = [10, 12, 11, 15, 14];
  const pred = persistence(s, 2); // forecasts for t = 2, 3, 4 -> 12, 11, 15
  assert.deepEqual(pred, [12, 11, 15]);
  const m = metrics(s.slice(2), pred);
  assert.ok(close(1e-12)(m.rmse, Math.sqrt((1 + 16 + 1) / 3)));
});

test("AR(1) recovers phi = 0.5 on a seeded synthetic series", () => {
  const rand = mulberry32(11);
  const x = [0];
  for (let t = 1; t < 20000; t++) x.push(0.5 * x[t - 1] + randn(rand));
  const { phi, intercept } = fitAR(x, 1);
  assert.ok(close(0.02)(phi[0], 0.5), `phi ${phi[0]}`);
  assert.ok(close(0.05)(intercept, 0), `c ${intercept}`);
});

test("AR forecast on a constant-growth price series is exact", () => {
  const s = Array.from({ length: 100 }, (_, t) => 100 * Math.exp(0.01 * t + 0.001 * Math.sin(t)));
  const { pred } = arReturnsForecast(s, 80, 2);
  assert.equal(pred.length, 20);
  for (let i = 0; i < 20; i++) assert.ok(Math.abs(pred[i] / s[80 + i] - 1) < 0.01);
});

test("BTC data: chronological split, all models finite, persistence beats regression on time", () => {
  const d = JSON.parse(readFileSync(new URL("../../../../public/demos/btc/btc-daily.json", import.meta.url), "utf8")) as { close: number[] };
  assert.equal(d.close.length, 2651);
  const split = Math.round(d.close.length * 0.8);
  const res = evaluateAll(d.close, split, 5);
  for (const r of res) {
    assert.equal(r.test.length, d.close.length - split);
    assert.ok(Number.isFinite(r.metrics.rmse) && Number.isFinite(r.metrics.mape));
  }
  const by = Object.fromEntries(res.map((r) => [r.key, r.metrics]));
  assert.ok(by.persistence.rmse < by.linear.rmse);
  assert.ok(by.persistence.rmse < by.poly2.rmse);
});
