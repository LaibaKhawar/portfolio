// One-lane bridge with a mutex and two condition variables, simulated step by step.
//
// Rule: at most 2 cars on the bridge, or exactly 1 bus alone.
// Each vehicle is a process:
//   lock mutex -> check condition -> (wait on condvar | enter, unlock) -> cross for T ticks
//   -> lock mutex -> leave + signal per policy -> unlock -> done
// Condition variables have Mesa semantics: wait releases the mutex and blocks; a woken
// process must reacquire the mutex and re-check its condition.
//
// One tick: every process that can act takes exactly one action, in a seeded random order.
// Mutex actions are sequential inside the tick, so at most one process holds the mutex at a time.
// The mutex is granted in request order (FIFO), so waiting times reflect the condvar policy
// rather than luck in a mutex race.

export type Kind = "car" | "bus";
export type Policy = "original" | "fixed" | "fair";
export type CondVar = "cars" | "buses";

export const POLICIES: { id: Policy; label: string }[] = [
  { id: "original", label: "Original (from Q2.cpp)" },
  { id: "fixed", label: "Fixed" },
  { id: "fair", label: "Fixed + fairness" },
];

export type Pc =
  | "pending" // not arrived yet
  | "lock" // wants the mutex to enter
  | "check" // holds mutex, evaluates its condition
  | "waiting" // blocked on a condvar
  | "relock" // woken, wants the mutex back
  | "unlockEnter" // on the bridge, releases the mutex
  | "crossing"
  | "lockExit"
  | "leave" // holds mutex, decrements and signals
  | "unlockExit"
  | "done";

export type Vehicle = {
  id: number;
  kind: Kind;
  arriveAt: number;
  pc: Pc;
  left: number;
  enteredAt: number | null;
  doneAt: number | null;
  /** Bus has been counted in busesWaiting. */
  queued: boolean;
  /** Position (1-based) in its arrival order per kind, for labels. */
  label: string;
};

export type Arrival = { kind: Kind; at: number };

export type Preset = "mixed" | "bus-after-cars" | "rush-hour";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "mixed", label: "Mixed" },
  { id: "bus-after-cars", label: "Bus after cars" },
  { id: "rush-hour", label: "Rush hour" },
];

export type Config = {
  policy: Policy;
  crossTicks: number;
  seed: number;
  /** Fairness: max cars admitted in a row while a bus is waiting. */
  carBatch: number;
};

export type LogEntry = { tick: number; text: string };

export type State = {
  config: Config;
  tick: number;
  rng: number;
  /** Sorted by arrival time; id = index. */
  vehicles: Vehicle[];
  /** Ids of vehicles that have arrived and are not done. */
  active: number[];
  /** Index of the next vehicle that has not arrived yet. */
  nextArrival: number;
  mutex: number | null;
  /** Processes queued for the mutex, in request order. */
  mutexQueue: number[];
  cvQueues: Record<CondVar, number[]>;
  cars: number;
  buses: number;
  /** Buses that have found the bridge busy and not yet entered (fair policy). */
  busesWaiting: number;
  carsSinceBus: number;
  stalled: boolean;
  finished: boolean;
  violations: number;
  violation: string | null;
  log: LogEntry[];
};

export const LOG_SIZE = 10;

// mulberry32
function rand(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** Seeded random arrivals: `count` vehicles, Bernoulli arrivals with probability `rate` per tick. */
export function randomArrivals(seed: number, count: number, rate: number, busShare: number): Arrival[] {
  const out: Arrival[] = [];
  let s = (seed >>> 0) || 1;
  let t = 0;
  while (out.length < count) {
    let r: number;
    [r, s] = rand(s);
    if (r < rate) {
      [r, s] = rand(s);
      out.push({ kind: r < busShare ? "bus" : "car", at: t });
    }
    t++;
  }
  return out;
}

/**
 * Preset arrival schedules.
 * "bus-after-cars" is deterministic: two cars take the bridge, a bus arrives behind them and
 * waits on the bus condvar, more cars follow. In Q2.cpp a leaving car only broadcasts the car
 * condvar, so that bus is never woken.
 */
export function presetArrivals(preset: Preset, seed: number, rate = 0.35, busShare = 0.3): Arrival[] {
  switch (preset) {
    case "bus-after-cars":
      return [
        { kind: "car", at: 0 },
        { kind: "car", at: 0 },
        { kind: "bus", at: 2 },
        { kind: "car", at: 3 },
        { kind: "car", at: 9 },
        { kind: "car", at: 10 },
      ];
    case "rush-hour":
      return randomArrivals(seed, 36, Math.min(0.95, rate * 2.2), Math.min(busShare, 0.15));
    case "mixed":
      return randomArrivals(seed, 24, rate, busShare);
  }
}

export function initState(config: Config, arrivals: Arrival[]): State {
  const sorted = arrivals.map((a, i) => ({ ...a, i })).sort((a, b) => a.at - b.at || a.i - b.i);
  const counts = { car: 0, bus: 0 };
  const vehicles: Vehicle[] = sorted.map((a, id) => ({
    id,
    kind: a.kind,
    arriveAt: a.at,
    pc: "pending",
    left: 0,
    enteredAt: null,
    doneAt: null,
    queued: false,
    label: `${a.kind === "car" ? "C" : "B"}${++counts[a.kind]}`,
  }));
  return {
    config,
    tick: 0,
    rng: (config.seed >>> 0) || 1,
    vehicles,
    mutex: null,
    mutexQueue: [],
    active: [],
    nextArrival: 0,
    cvQueues: { cars: [], buses: [] },
    cars: 0,
    buses: 0,
    busesWaiting: 0,
    carsSinceBus: 0,
    stalled: false,
    finished: vehicles.length === 0,
    violations: 0,
    violation: null,
    log: [],
  };
}

function clone(s: State): State {
  return {
    ...s,
    vehicles: s.vehicles.map((v) => ({ ...v })),
    active: s.active.slice(),
    cvQueues: { cars: s.cvQueues.cars.slice(), buses: s.cvQueues.buses.slice() },
    mutexQueue: s.mutexQueue.slice(),
    log: s.log.slice(),
  };
}

/** True if this vehicle must wait given the current counters and policy. */
export function mustWait(s: State, kind: Kind): boolean {
  if (kind === "bus") return s.buses >= 1 || s.cars > 0;
  const base = s.cars >= 2 || s.buses > 0;
  if (s.config.policy === "fair") return base || (s.busesWaiting > 0 && s.carsSinceBus >= s.config.carBatch);
  return base;
}

function isLockPc(pc: Pc) {
  return pc === "lock" || pc === "relock" || pc === "lockExit";
}

function canAct(s: State, v: Vehicle): boolean {
  switch (v.pc) {
    case "pending":
    case "waiting":
    case "done":
      return false;
    case "lock":
    case "relock":
    case "lockExit":
      return s.mutex === null && s.mutexQueue[0] === v.id;
    default:
      return true;
  }
}

/** Every process that is active and not blocked on a condvar (it may still be queued on the mutex). */
export function runnable(s: State): Vehicle[] {
  return activeVehicles(s).filter((v) => v.pc !== "waiting");
}

export function onBridge(s: State): Vehicle[] {
  return activeVehicles(s).filter((v) => v.pc === "unlockEnter" || v.pc === "crossing" || v.pc === "lockExit" || v.pc === "leave");
}

export function waiting(s: State): Vehicle[] {
  return activeVehicles(s).filter((v) => v.pc === "waiting");
}

export function activeVehicles(s: State): Vehicle[] {
  return s.active.map((id) => s.vehicles[id]);
}

/** Broadcast (count = "all") or signal `count` times. Each signal wakes the longest waiter, if any. */
function wake(s: State, cv: CondVar, count: number | "all", by: Vehicle, push: (t: string) => void) {
  const q = s.cvQueues[cv];
  const all = count === "all";
  const woken = q.splice(0, all ? q.length : count);
  for (const id of woken) {
    s.vehicles[id].pc = "relock";
    s.mutexQueue.push(id);
  }
  const verb = all ? "broadcast" : count === 1 ? "signal" : `signal x${count}`;
  push(`${by.label} ${verb} ${cv === "cars" ? "canCrossBridge" : "canCrossBridgeForBus"}${woken.length ? `, woke ${woken.map((id) => s.vehicles[id].label).join(" ")}` : ", nobody waiting"}`);
}

function act(s: State, v: Vehicle, push: (t: string) => void) {
  const { policy, crossTicks } = s.config;
  switch (v.pc) {
    case "lock":
    case "relock":
      if (s.mutex !== null || s.mutexQueue[0] !== v.id) return; // still blocked on the mutex
      s.mutexQueue.shift();
      s.mutex = v.id;
      v.pc = "check";
      return;
    case "check": {
      if (mustWait(s, v.kind)) {
        if (v.kind === "bus" && !v.queued) {
          // Counted once per bus so the fairness rule knows a bus is queued.
          s.busesWaiting++;
          v.queued = true;
        }
        const cv: CondVar = v.kind === "car" ? "cars" : "buses";
        s.cvQueues[cv].push(v.id);
        v.pc = "waiting";
        s.mutex = null;
        push(`${v.label} waits on ${cv === "cars" ? "canCrossBridge" : "canCrossBridgeForBus"} (cars=${s.cars}, buses=${s.buses})`);
        return;
      }
      if (v.kind === "car") {
        s.cars++;
        s.carsSinceBus++;
      } else {
        s.buses++;
        s.carsSinceBus = 0;
        if (v.queued) s.busesWaiting--;
      }
      v.enteredAt = s.tick;
      v.pc = "unlockEnter";
      push(`${v.label} enters the bridge (cars=${s.cars}, buses=${s.buses})`);
      if (policy === "original") {
        // Q2.cpp broadcasts its own condvar right after entering.
        wake(s, v.kind === "car" ? "cars" : "buses", "all", v, push);
      }
      return;
    }
    case "unlockEnter":
      s.mutex = null;
      v.pc = "crossing";
      v.left = crossTicks;
      return;
    case "crossing":
      v.left--;
      if (v.left <= 0) {
        v.pc = "lockExit";
        s.mutexQueue.push(v.id);
      }
      return;
    case "lockExit":
      if (s.mutex !== null || s.mutexQueue[0] !== v.id) return;
      s.mutexQueue.shift();
      s.mutex = v.id;
      v.pc = "leave";
      return;
    case "leave": {
      if (v.kind === "car") s.cars--;
      else s.buses--;
      push(`${v.label} leaves (cars=${s.cars}, buses=${s.buses})`);
      if (policy === "original") {
        // Q2.cpp: a bus signals only the bus condvar, a car broadcasts only the car condvar.
        if (v.kind === "bus") wake(s, "buses", 1, v, push);
        else wake(s, "cars", "all", v, push);
      } else if (policy === "fixed") {
        // Bridge empty: wake enough of both kinds to fill it (a bus and two cars); whoever loses
        // the re-check waits again and is woken by the next exit. One car slot freed: wake one car.
        if (s.cars === 0 && s.buses === 0) {
          wake(s, "cars", 2, v, push);
          wake(s, "buses", 1, v, push);
        } else if (v.kind === "car" && s.cars === 1) {
          wake(s, "cars", 1, v, push);
        }
      } else {
        // Fair: once the car batch is used up and a bus is queued, hand the empty bridge to a bus.
        const busTurn = s.busesWaiting > 0 && s.carsSinceBus >= s.config.carBatch;
        if (s.cars === 0 && s.buses === 0) {
          if (busTurn && s.cvQueues.buses.length > 0) wake(s, "buses", 1, v, push);
          else {
            wake(s, "cars", 2, v, push);
            wake(s, "buses", 1, v, push);
          }
        } else if (v.kind === "car" && s.cars === 1 && !busTurn) {
          wake(s, "cars", 1, v, push);
        }
      }
      v.pc = "unlockExit";
      return;
    }
    case "unlockExit":
      s.mutex = null;
      v.pc = "done";
      v.doneAt = s.tick;
      return;
  }
}

function checkInvariant(s: State, on: Vehicle[]): string | null {
  let c = 0;
  let b = 0;
  for (const v of on) {
    if (v.pc !== "unlockEnter" && v.pc !== "crossing" && v.pc !== "lockExit" && v.pc !== "leave") continue;
    if (v.kind === "car") c++;
    else b++;
  }
  if (c > 2) return `${c} cars on the bridge`;
  if (b > 1) return `${b} buses on the bridge`;
  if (b > 0 && c > 0) return "a bus and a car share the bridge";
  return null;
}

/** Advances the simulation by one tick. Returns a new state (input is not mutated). */
export function tick(prev: State): State {
  if (prev.stalled || prev.finished) return prev;
  const s = clone(prev);
  tickInPlace(s);
  return s;
}

/** Same as tick() but mutates `s`. Used for long headless runs. */
export function tickInPlace(s: State): void {
  if (s.stalled || s.finished) return;
  s.tick++;
  const push = (text: string) => {
    s.log.push({ tick: s.tick, text });
    if (s.log.length > LOG_SIZE) s.log.shift();
  };
  while (s.nextArrival < s.vehicles.length && s.vehicles[s.nextArrival].arriveAt <= s.tick - 1) {
    const v = s.vehicles[s.nextArrival++];
    v.pc = "lock";
    s.active.push(v.id);
    s.mutexQueue.push(v.id);
    push(`${v.label} arrives`);
  }
  // Seeded shuffle of the processes that may act this tick. Of the processes queued on the
  // mutex only the head can act: once anyone acquires it, it stays held until a later tick.
  const head = s.mutexQueue[0];
  const order = runnable(s)
    .filter((v) => !isLockPc(v.pc) || v.id === head)
    .map((v) => v.id);
  for (let i = order.length - 1; i > 0; i--) {
    let r: number;
    [r, s.rng] = rand(s.rng);
    const j = Math.floor(r * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const actives = activeVehicles(s);
  for (const id of order) {
    const v = s.vehicles[id];
    act(s, v, push);
    const bad = checkInvariant(s, actives);
    if (bad) {
      s.violations++;
      s.violation = bad;
    }
  }

  s.active = s.active.filter((id) => s.vehicles[id].pc !== "done");
  const pendingLeft = s.nextArrival < s.vehicles.length;
  const anyActive = activeVehicles(s).some((v) => canAct(s, v));
  const waiters = waiting(s).length;
  s.finished = !pendingLeft && s.active.length === 0;
  if (!s.finished && !pendingLeft && !anyActive && waiters > 0 && onBridge(s).length === 0 && s.mutex === null) {
    s.stalled = true;
    push(`stalled: ${waiters} waiting, nobody left to wake them`);
  }
}

/** Runs up to `max` ticks (or until finished or stalled) on a copy of `s`. */
export function runTicks(s: State, max: number): State {
  const cur = clone(s);
  for (let i = 0; i < max && !cur.stalled && !cur.finished; i++) tickInPlace(cur);
  return cur;
}

export type Stats = {
  crossedCars: number;
  crossedBuses: number;
  avgWait: number;
  maxWait: number;
  maxBusWait: number;
};

/** Wait = ticks between arrival and entering the bridge (still-waiting vehicles count their wait so far). */
export function stats(s: State): Stats {
  let sum = 0;
  let count = 0;
  let maxWait = 0;
  let maxBusWait = 0;
  let crossedCars = 0;
  let crossedBuses = 0;
  for (const v of s.vehicles) {
    if (v.pc === "done") {
      if (v.kind === "car") crossedCars++;
      else crossedBuses++;
    }
    if (v.pc === "pending") continue;
    const w = (v.enteredAt ?? s.tick) - v.arriveAt;
    if (v.enteredAt !== null) {
      sum += w;
      count++;
    }
    maxWait = Math.max(maxWait, w);
    if (v.kind === "bus") maxBusWait = Math.max(maxBusWait, w);
  }
  return { crossedCars, crossedBuses, avgWait: count ? sum / count : 0, maxWait, maxBusWait };
}
