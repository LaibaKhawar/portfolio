import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initState,
  presetArrivals,
  randomArrivals,
  runTicks,
  tick,
  tickInPlace,
  stats,
  onBridge,
  waiting,
  type Arrival,
  type Config,
  type Policy,
} from "./logic.ts";

const cfg = (policy: Policy, seed = 1): Config => ({ policy, crossTicks: 5, seed, carBatch: 4 });

test("Original policy stalls on the 'Bus after cars' preset", () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const s = runTicks(initState(cfg("original", seed), presetArrivals("bus-after-cars", seed)), 1000);
    assert.equal(s.stalled, true, `seed ${seed}`);
    assert.equal(s.finished, false);
    assert.equal(onBridge(s).length, 0);
    const stuck = waiting(s);
    assert.ok(stuck.some((v) => v.kind === "bus"));
    assert.equal(s.violations, 0);
  }
});

test("Fixed and fair policies complete every vehicle on the same preset", () => {
  for (const policy of ["fixed", "fair"] as const) {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const s = runTicks(initState(cfg(policy, seed), presetArrivals("bus-after-cars", seed)), 1000);
      assert.equal(s.finished, true, `${policy} seed ${seed}`);
      assert.equal(s.stalled, false);
      assert.equal(s.violations, 0);
    }
  }
});

test("invariants hold for 20k random ticks under all policies", () => {
  for (const policy of ["original", "fixed", "fair"] as const) {
    for (const seed of [7, 8, 9]) {
      const s = initState(cfg(policy, seed), randomArrivals(seed, 1500, 0.08, 0.3));
      let ticks = 0;
      while (ticks < 20_000 && !s.finished && !s.stalled) {
        tickInPlace(s);
        ticks++;
        const on = onBridge(s);
        const cars = on.filter((v) => v.kind === "car").length;
        const buses = on.length - cars;
        assert.ok(cars <= 2 && buses <= 1 && !(cars > 0 && buses > 0), `${policy} tick ${s.tick}`);
        assert.equal(s.cars, cars);
        assert.equal(s.buses, buses);
      }
      assert.equal(s.violations, 0, policy);
      if (policy !== "original") {
        assert.equal(s.stalled, false, `${policy} should never stall`);
        assert.ok(ticks >= 15_000 || s.finished, `${policy} ran ${ticks}`);
      }
    }
  }
});

test("Fixed + fairness bounds bus waiting time under a heavy car stream", () => {
  const arrivals: Arrival[] = [];
  // A car every 2 ticks is more than the bridge can carry, so it never empties on its own.
  for (let t = 0; t < 180; t += 2) arrivals.push({ kind: "car", at: t });
  arrivals.push({ kind: "bus", at: 10 }, { kind: "bus", at: 90 });
  for (const seed of [1, 2, 3, 4, 5]) {
    const fixed = runTicks(initState(cfg("fixed", seed), arrivals), 50_000);
    const fair = runTicks(initState(cfg("fair", seed), arrivals), 50_000);
    assert.equal(fixed.finished, true);
    assert.equal(fair.finished, true);
    const fixedWait = stats(fixed).maxBusWait;
    const fairWait = stats(fair).maxBusWait;
    // Bound: the 4-car batch plus one crossing ahead of the bus, with mutex overhead.
    assert.ok(fairWait < 100, `fair bus wait ${fairWait}`);
    assert.ok(fixedWait > fairWait * 4, `fixed ${fixedWait} vs fair ${fairWait}`);
  }
});

test("Mesa semantics: a woken vehicle re-acquires the mutex and re-checks", () => {
  let s = initState(cfg("fixed"), presetArrivals("bus-after-cars", 1));
  let sawRelock = false;
  for (let i = 0; i < 200 && !s.finished; i++) {
    s = tick(s);
    if (s.vehicles.some((v) => v.pc === "relock" || (v.pc === "check" && v.queued))) sawRelock = true;
    assert.ok(s.mutex === null || ["check", "leave", "unlockEnter", "unlockExit"].includes(s.vehicles[s.mutex].pc));
  }
  assert.ok(sawRelock);
});
