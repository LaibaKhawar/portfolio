import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accuracy,
  countMistakes,
  fit,
  generateSeparable,
  generateXor,
  initialState,
  stepEpoch,
  stepSample,
  trainTestSplit,
  updateOne,
  type Point,
} from "./logic.ts";

test("update rule matches a hand-computed step", () => {
  // w = 0, b = 0 -> z = 0 -> y_hat = 1. y = -1 -> error = -2.
  const { model, error } = updateOne({ w1: 0, w2: 0, b: 0 }, { x1: 0.5, x2: -1.5, y: -1 }, 0.01);
  assert.equal(error, 2);
  assert.ok(Math.abs(model.w1 - -0.01) < 1e-15); // 0.01 * -2 * 0.5
  assert.ok(Math.abs(model.w2 - 0.03) < 1e-15); // 0.01 * -2 * -1.5
  assert.ok(Math.abs(model.b - -0.02) < 1e-15); // 0.01 * -2
  // Correct prediction: no change, zero error.
  const same = updateOne(model, { x1: 0.5, x2: -1.5, y: -1 }, 0.01);
  assert.equal(same.error, 0);
  assert.deepEqual(same.model, model);
});

test("epoch total error is 2 x mistakes, as printed in the notebook", () => {
  const data = generateSeparable(100, 1);
  const s = stepEpoch(initialState(), data, 0.01);
  let m = { w1: 0, w2: 0, b: 0 };
  let mistakes = 0;
  for (const p of data) {
    const r = updateOne(m, p, 0.01);
    if (r.error) mistakes++;
    m = r.model;
  }
  assert.equal(s.history[0], 2 * mistakes);
  assert.equal(s.epoch, 1);
  assert.equal(s.index, 0);
});

test("stepSample walks the samples in order and wraps into the next epoch", () => {
  const data: Point[] = [
    { x1: 1, x2: 0, y: 1 },
    { x1: -1, x2: 0, y: -1 },
  ];
  let s = stepSample(initialState(), data, 0.1);
  assert.equal(s.lastIndex, 0);
  assert.equal(s.index, 1);
  s = stepSample(s, data, 0.1);
  assert.equal(s.epoch, 1);
  assert.equal(s.index, 0);
  assert.equal(s.history.length, 1);
});

test("separable data with a margin converges to zero training errors", () => {
  const data = generateSeparable(400, 3).filter((p) => Math.abs(p.x1 + p.x2) > 0.1);
  let s = initialState();
  let converged = -1;
  for (let e = 0; e < 500; e++) {
    s = stepEpoch(s, data, 0.01);
    if (s.history[s.history.length - 1] === 0) {
      converged = e + 1;
      break;
    }
  }
  assert.ok(converged > 0, "should converge within 500 epochs");
  assert.equal(countMistakes(s.model, data), 0);
});

test("XOR never reaches zero errors", () => {
  const data = generateXor(200, 7);
  const s = fit(data, 0.1, 300);
  assert.ok(s.history.every((e) => e > 0));
  assert.ok(countMistakes(s.model, data) > 0);
});

test("notebook setup (500 points, lr 0.01, 20 epochs) reaches high test accuracy", () => {
  const { train, test: held } = trainTestSplit(generateSeparable(500, 42), 0.2, 42);
  assert.equal(train.length, 400);
  assert.equal(held.length, 100);
  const s = fit(train, 0.01, 20);
  assert.equal(s.history.length, 20);
  assert.ok(accuracy(s.model, held) >= 0.9, `accuracy ${accuracy(s.model, held)}`);
});
