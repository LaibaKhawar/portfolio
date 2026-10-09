// Lamport's Bakery algorithm as explicit per-thread program counters.
// Every step executes exactly one operation for one thread: a shared-memory read,
// a shared-memory write, or a local step (remainder / critical section work).
//
// Canonical algorithm for thread i:
//   choosing[i] = true
//   number[i] = 1 + max(number[0..N-1])      (N reads, then one write)
//   choosing[i] = false
//   for j != i:
//     while choosing[j] {}                    (one read per check)
//     while number[j] != 0 && (number[j], j) < (number[i], i) {}   (one read per check)
//   critical section
//   number[i] = 0
//   remainder section
//
// "Break it" removes the choosing flag entirely (no writes, no waits on it).

export type Pc =
  | "remainder"
  | "setChoosing"
  | "readMax"
  | "writeNumber"
  | "clearChoosing"
  | "waitChoosing"
  | "waitNumber"
  | "critical"
  | "exit";

export type Thread = {
  id: number;
  pc: Pc;
  /** Loop index for readMax / waitChoosing / waitNumber. */
  j: number;
  /** Running maximum while in readMax. */
  max: number;
  /** Local steps left in the remainder or critical section. */
  left: number;
};

export type Scheduler = "round-robin" | "random" | "adversarial";

export type Config = {
  n: number;
  scheduler: Scheduler;
  broken: boolean;
  csSteps: number;
  remSteps: number;
  seed: number;
};

export type Op = {
  step: number;
  thread: number;
  kind: "read" | "write" | "local";
  array: "choosing" | "number" | null;
  index: number;
  value: number | boolean | null;
  text: string;
};

export type State = {
  config: Config;
  choosing: boolean[];
  number: number[];
  threads: Thread[];
  steps: number;
  rng: number;
  rrNext: number;
  csEntries: number[];
  violations: number;
  /** True right after a step that let a second thread into the critical section. */
  violationNow: boolean;
  firstViolationStep: number | null;
  log: Op[];
  lastOp: Op | null;
};

export const LOG_SIZE = 12;

export function initState(config: Config): State {
  const n = Math.max(2, Math.min(6, Math.floor(config.n)));
  const cfg = { ...config, n };
  return {
    config: cfg,
    choosing: Array(n).fill(false),
    number: Array(n).fill(0),
    threads: Array.from({ length: n }, (_, id) => ({ id, pc: "remainder" as Pc, j: 0, max: 0, left: cfg.remSteps })),
    steps: 0,
    rng: (cfg.seed >>> 0) || 1,
    rrNext: 0,
    csEntries: Array(n).fill(0),
    violations: 0,
    violationNow: false,
    firstViolationStep: null,
    log: [],
    lastOp: null,
  };
}

// mulberry32
function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  t = t >>> 0;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** (a, i) < (b, j) in lexicographic order. */
export function ticketLess(a: number, i: number, b: number, j: number) {
  return a < b || (a === b && i < j);
}

function firstOther(i: number, from: number, n: number): number {
  let j = from;
  while (j === i) j++;
  return j < n ? j : n;
}

export function phaseLabel(t: Thread): string {
  switch (t.pc) {
    case "remainder":
      return "remainder";
    case "setChoosing":
    case "readMax":
    case "writeNumber":
    case "clearChoosing":
      return "doorway";
    case "waitChoosing":
      return `waiting on T${t.j} (choosing)`;
    case "waitNumber":
      return `waiting on T${t.j} (ticket)`;
    case "critical":
      return "critical section";
    case "exit":
      return "exit";
  }
}

export function inCriticalSection(s: State): number[] {
  return s.threads.filter((t) => t.pc === "critical").map((t) => t.id);
}

/** True if the thread's next step is a wait check that would fail (it would spin). */
export function wouldSpin(s: State, id: number): boolean {
  const t = s.threads[id];
  if (t.pc === "waitChoosing") return s.choosing[t.j];
  if (t.pc === "waitNumber") {
    const nj = s.number[t.j];
    return nj !== 0 && ticketLess(nj, t.j, s.number[id], id);
  }
  return false;
}

function rotatePick(s: State, ids: number[]): number {
  // Next id at or after rrNext, wrapping around.
  const n = s.config.n;
  for (let k = 0; k < n; k++) {
    const id = (s.rrNext + k) % n;
    if (ids.includes(id)) return id;
  }
  return ids[0];
}

/**
 * Adversarial schedule: let a thread finish reading the maximum but hold back its write,
 * run everyone else, and only release the held thread once someone sits in the critical section.
 * Without the choosing flag this lets a lower-id thread take a stale ticket that ties with
 * the thread already inside, and the tie-break by id lets it in too.
 */
function adversarialPick(s: State): number {
  const ids = s.threads.map((t) => t.id);
  const inCs = ids.filter((id) => s.threads[id].pc === "critical");
  const poised = ids.filter((id) => s.threads[id].pc === "writeNumber");
  if (inCs.length > 0 && poised.length > 0) return poised[0];
  const others = ids.filter((id) => s.threads[id].pc !== "critical" && s.threads[id].pc !== "writeNumber" && !wouldSpin(s, id));
  if (others.length > 0) return rotatePick(s, others);
  if (poised.length > 0) return poised[poised.length - 1];
  const spinning = ids.filter((id) => s.threads[id].pc !== "critical");
  if (inCs.length > 0) return rotatePick(s, inCs);
  return rotatePick(s, spinning);
}

export function pickThread(s: State): { id: number; rng: number } {
  const n = s.config.n;
  switch (s.config.scheduler) {
    case "round-robin":
      return { id: s.rrNext % n, rng: s.rng };
    case "random": {
      const [r, rng] = nextRandom(s.rng);
      return { id: Math.floor(r * n), rng };
    }
    case "adversarial":
      return { id: adversarialPick(s), rng: s.rng };
  }
}

/** Executes one operation for thread `id`. Returns a new state (input is not mutated). */
export function stepThread(prev: State, id: number): State {
  const s: State = {
    ...prev,
    choosing: prev.choosing.slice(),
    number: prev.number.slice(),
    threads: prev.threads.map((t) => ({ ...t })),
    csEntries: prev.csEntries.slice(),
  };
  const { n, broken, csSteps, remSteps } = s.config;
  const t = s.threads[id];
  const step = s.steps + 1;
  let op: Op;
  const mk = (kind: Op["kind"], array: Op["array"], index: number, value: Op["value"], text: string): Op => ({
    step,
    thread: id,
    kind,
    array,
    index,
    value,
    text,
  });
  const enterWaits = () => {
    const j = firstOther(id, 0, n);
    t.j = j;
    t.pc = j >= n ? "critical" : broken ? "waitNumber" : "waitChoosing";
    if (t.pc === "critical") {
      t.left = csSteps;
      s.csEntries[id]++;
    }
  };
  const startDoorway = () => {
    t.j = 0;
    t.max = 0;
    t.pc = broken ? "readMax" : "setChoosing";
  };

  switch (t.pc) {
    case "remainder": {
      op = mk("local", null, -1, null, `T${id} remainder work`);
      t.left--;
      if (t.left <= 0) startDoorway();
      break;
    }
    case "setChoosing": {
      s.choosing[id] = true;
      op = mk("write", "choosing", id, true, `T${id} write choosing[${id}] = true`);
      t.pc = "readMax";
      t.j = 0;
      t.max = 0;
      break;
    }
    case "readMax": {
      const v = s.number[t.j];
      op = mk("read", "number", t.j, v, `T${id} read number[${t.j}] = ${v}`);
      t.max = Math.max(t.max, v);
      t.j++;
      if (t.j >= n) t.pc = "writeNumber";
      break;
    }
    case "writeNumber": {
      s.number[id] = t.max + 1;
      op = mk("write", "number", id, t.max + 1, `T${id} write number[${id}] = ${t.max + 1}`);
      if (broken) enterWaits();
      else t.pc = "clearChoosing";
      break;
    }
    case "clearChoosing": {
      s.choosing[id] = false;
      op = mk("write", "choosing", id, false, `T${id} write choosing[${id}] = false`);
      enterWaits();
      break;
    }
    case "waitChoosing": {
      const v = s.choosing[t.j];
      op = mk("read", "choosing", t.j, v, `T${id} read choosing[${t.j}] = ${v}${v ? ", wait" : ""}`);
      if (!v) t.pc = "waitNumber";
      break;
    }
    case "waitNumber": {
      const nj = s.number[t.j];
      const blocked = nj !== 0 && ticketLess(nj, t.j, s.number[id], id);
      op = mk(
        "read",
        "number",
        t.j,
        nj,
        `T${id} read number[${t.j}] = ${nj}${blocked ? `, (${nj},${t.j}) < (${s.number[id]},${id}) wait` : ", pass"}`,
      );
      if (!blocked) {
        const j = firstOther(id, t.j + 1, n);
        if (j >= n) {
          t.pc = "critical";
          t.left = csSteps;
          s.csEntries[id]++;
          op.text += ", enter CS";
        } else {
          t.j = j;
          t.pc = broken ? "waitNumber" : "waitChoosing";
        }
      }
      break;
    }
    case "critical": {
      op = mk("local", null, -1, null, `T${id} critical section work`);
      t.left--;
      if (t.left <= 0) t.pc = "exit";
      break;
    }
    case "exit": {
      s.number[id] = 0;
      op = mk("write", "number", id, 0, `T${id} write number[${id}] = 0, leave CS`);
      t.pc = "remainder";
      t.left = remSteps;
      break;
    }
  }

  s.steps = step;
  s.lastOp = op;
  s.log = [...prev.log.slice(-(LOG_SIZE - 1)), op];
  const occupants = s.threads.filter((x) => x.pc === "critical").length;
  const before = prev.threads.filter((x) => x.pc === "critical").length;
  // A violation is a thread entering while another one is already inside.
  s.violationNow = occupants > 1 && occupants > before;
  if (s.violationNow) {
    s.violations++;
    if (s.firstViolationStep === null) s.firstViolationStep = step;
  }
  return s;
}

/** Picks a thread with the configured scheduler and executes one operation. */
export function step(prev: State): State {
  const { id, rng } = pickThread(prev);
  const s = stepThread({ ...prev, rng }, id);
  s.rrNext = (id + 1) % s.config.n;
  return s;
}

/** Runs up to `maxSteps`, optionally stopping at the first violation. */
export function runSteps(s: State, maxSteps: number, stopOnViolation = false): State {
  let cur = s;
  for (let i = 0; i < maxSteps; i++) {
    cur = step(cur);
    if (stopOnViolation && cur.violationNow) break;
  }
  return cur;
}
