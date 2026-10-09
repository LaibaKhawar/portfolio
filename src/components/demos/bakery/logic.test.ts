import { test } from "node:test";
import assert from "node:assert/strict";
import { initState, step, runSteps, inCriticalSection, type Config, type State } from "./logic.ts";

const base: Config = { n: 2, scheduler: "random", broken: false, csSteps: 2, remSteps: 2, seed: 7 };

test("canonical Bakery under a random scheduler: mutual exclusion and no starvation (N = 2..5, 50k steps)", () => {
  for (let n = 2; n <= 5; n++) {
    for (const seed of [1, 42, 2024]) {
      let s: State = initState({ ...base, n, seed });
      for (let i = 0; i < 50_000; i++) {
        s = step(s);
        assert.ok(inCriticalSection(s).length <= 1, `n=${n} seed=${seed} step=${s.steps}`);
      }
      assert.equal(s.violations, 0);
      for (let t = 0; t < n; t++) assert.ok(s.csEntries[t] > 0, `thread ${t} starved (n=${n}, seed=${seed})`);
    }
  }
});

test("canonical Bakery survives the round-robin and adversarial schedulers too", () => {
  for (let n = 2; n <= 6; n++) {
    for (const scheduler of ["round-robin", "adversarial"] as const) {
      const s = runSteps(initState({ ...base, n, scheduler }), 20_000);
      assert.equal(s.violations, 0, `${scheduler} n=${n}`);
      assert.ok(s.csEntries.every((c) => c > 0), `${scheduler} n=${n} entries ${s.csEntries}`);
    }
  }
});

test("without the choosing flag, the adversarial scheduler breaks mutual exclusion quickly", () => {
  for (let n = 2; n <= 6; n++) {
    const s = runSteps(initState({ ...base, n, scheduler: "adversarial", broken: true }), 500, true);
    assert.ok(s.violationNow, `no violation for n=${n}`);
    assert.ok(inCriticalSection(s).length >= 2);
    assert.ok(s.steps < 100, `took ${s.steps} steps for n=${n}`);
  }
});

test("every step is exactly one shared read, one shared write, or one local step", () => {
  let s = initState({ ...base, n: 3 });
  for (let i = 0; i < 2000; i++) {
    const prev = s;
    s = step(s);
    const op = s.lastOp!;
    const changedChoosing = s.choosing.filter((v, k) => v !== prev.choosing[k]).length;
    const changedNumber = s.number.filter((v, k) => v !== prev.number[k]).length;
    if (op.kind === "read" || op.kind === "local") assert.equal(changedChoosing + changedNumber, 0);
    else assert.ok(changedChoosing + changedNumber <= 1);
  }
  assert.ok(s.log.length <= 12);
});
