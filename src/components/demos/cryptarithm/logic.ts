// Cryptarithm search, framework free.
//
// Three complete searches over a puzzle of the form WORD + WORD (+ WORD...) = WORD:
//  - "bfs":    breadth-first by insertion order. This is what the original notebook's
//              "A*" actually does: its priority len(assignment) + (#letters - len(assignment))
//              is constant, so the priority queue degenerates to FIFO.
//  - "dfs":    depth-first backtracking, assigns every letter before checking (as in the notebook).
//  - "column": column-wise constraint search (the improvement). Letters are assigned column by
//              column from the right, carries are propagated, and any partial assignment whose
//              fully assigned columns are inconsistent is pruned immediately.
//
// All searches are generators yielding one event per node so a UI can step them.

export type Algorithm = "bfs" | "dfs" | "column";

export const ALGORITHMS: { id: Algorithm; label: string }[] = [
  { id: "bfs", label: "Breadth-first (notebook's A*)" },
  { id: "dfs", label: "Depth-first backtracking" },
  { id: "column", label: "Column-wise constraint search" },
];

export type Puzzle = {
  addends: string[];
  result: string;
  /** Distinct letters in order of first appearance. */
  letters: string[];
  /** letter index -> true if that letter starts a word with 2+ letters (may not be 0). */
  leading: boolean[];
  /** Puzzle text normalised, e.g. "SEND + MORE = MONEY". */
  text: string;
};

export type ParseResult = { ok: true; puzzle: Puzzle } | { ok: false; error: string };

export const MAX_WORD_LENGTH = 10;

export function parsePuzzle(input: string): ParseResult {
  const cleaned = input.toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return { ok: false, error: "Enter a puzzle such as SEND + MORE = MONEY." };
  const sides = cleaned.split(/==|=/);
  if (sides.length !== 2) return { ok: false, error: "Use exactly one '=' between the sum and the result." };
  const [lhs, rhs] = sides;
  const addends = lhs.split("+");
  if (addends.some((w) => w.length === 0) || rhs.length === 0) {
    return { ok: false, error: "Every word must contain at least one letter." };
  }
  for (const w of [...addends, rhs]) {
    if (!/^[A-Z]+$/.test(w)) return { ok: false, error: `"${w}" must contain letters A to Z only.` };
    if (w.length > MAX_WORD_LENGTH) return { ok: false, error: `Words can be at most ${MAX_WORD_LENGTH} letters.` };
  }
  if (addends.length < 2 || addends.length > 5) {
    return { ok: false, error: "Use between 2 and 5 words on the left of '='." };
  }
  const longest = Math.max(...addends.map((w) => w.length));
  if (rhs.length < longest) {
    return { ok: false, error: "The result must be at least as long as the longest word being added." };
  }
  const letters: string[] = [];
  for (const ch of addends.join("") + rhs) if (!letters.includes(ch)) letters.push(ch);
  if (letters.length > 10) return { ok: false, error: `Found ${letters.length} distinct letters; at most 10 are possible.` };
  const leading = letters.map((l) => [...addends, rhs].some((w) => w.length > 1 && w[0] === l));
  return { ok: true, puzzle: { addends, result: rhs, letters, leading, text: `${addends.join(" + ")} = ${rhs}` } };
}

/** Value of a word under a digits-by-letter-index assignment. */
export function wordValue(puzzle: Puzzle, word: string, digits: ArrayLike<number>): number {
  let v = 0;
  for (const ch of word) v = v * 10 + digits[puzzle.letters.indexOf(ch)];
  return v;
}

/** Full check: every letter assigned, distinct digits, no leading zeros, arithmetic holds. */
export function verify(puzzle: Puzzle, digits: ArrayLike<number>): boolean {
  const seen = new Set<number>();
  for (let i = 0; i < puzzle.letters.length; i++) {
    const d = digits[i];
    if (d < 0 || d > 9 || seen.has(d)) return false;
    if (d === 0 && puzzle.leading[i]) return false;
    seen.add(d);
  }
  const sum = puzzle.addends.reduce((s, w) => s + wordValue(puzzle, w, digits), 0);
  return sum === wordValue(puzzle, puzzle.result, digits);
}

/** Variable order: letters in first appearance, or column by column from the right. */
export function letterOrder(puzzle: Puzzle, algo: Algorithm): number[] {
  if (algo !== "column") return puzzle.letters.map((_, i) => i);
  const order: number[] = [];
  const words = [...puzzle.addends, puzzle.result];
  for (let c = 0; c < puzzle.result.length; c++) {
    for (const w of words) {
      const ch = w[w.length - 1 - c];
      if (ch === undefined) continue;
      const idx = puzzle.letters.indexOf(ch);
      if (!order.includes(idx)) order.push(idx);
    }
  }
  return order;
}

type ColumnModel = { addendIdx: number[][]; resultIdx: number[] };

function columnModel(puzzle: Puzzle): ColumnModel {
  const addendIdx: number[][] = [];
  const resultIdx: number[] = [];
  for (let c = 0; c < puzzle.result.length; c++) {
    const col: number[] = [];
    for (const w of puzzle.addends) {
      const ch = w[w.length - 1 - c];
      if (ch !== undefined) col.push(puzzle.letters.indexOf(ch));
    }
    addendIdx.push(col);
    resultIdx.push(puzzle.letters.indexOf(puzzle.result[puzzle.result.length - 1 - c]));
  }
  return { addendIdx, resultIdx };
}

/**
 * Checks every fully assigned column from the right, propagating the carry.
 * Stops at the first column with an unassigned letter. If every column is assigned,
 * the final carry must be zero.
 */
function columnsConsistent(model: ColumnModel, digits: ArrayLike<number>): boolean {
  let carry = 0;
  const cols = model.resultIdx.length;
  for (let c = 0; c < cols; c++) {
    let sum: number = carry;
    for (const idx of model.addendIdx[c]) {
      const d = digits[idx];
      if (d < 0) return true;
      sum += d;
    }
    const r = digits[model.resultIdx[c]];
    if (r < 0) return true;
    if (sum % 10 !== r) return false;
    carry = Math.floor(sum / 10);
  }
  return carry === 0;
}

/** Carry into each column (index 0 = rightmost) given the assigned digits, or null where unknown. */
export function columnCarries(puzzle: Puzzle, digits: ArrayLike<number>): (number | null)[] {
  const model = columnModel(puzzle);
  const carries: (number | null)[] = [0];
  let carry: number | null = 0;
  for (let c = 0; c < model.resultIdx.length; c++) {
    if (carry === null) {
      carries.push(null);
      continue;
    }
    let sum: number = carry;
    for (const idx of model.addendIdx[c]) {
      if (digits[idx] < 0) {
        sum = -1;
        break;
      }
      sum += digits[idx];
    }
    carry = sum < 0 ? null : Math.floor(sum / 10);
    carries.push(carry);
  }
  return carries;
}

export type SearchEvent = {
  type: "expand" | "prune" | "goal";
  /** Digit per letter index, -1 when unassigned. Shared buffer: copy it if you keep it. */
  assignment: Int8Array;
  frontierSize: number;
  nodesExpanded: number;
};

export type SearchStatus = "running" | "done" | "budget" | "cap";

export type SearchStats = {
  status: SearchStatus;
  nodesExpanded: number;
  pruned: number;
  frontierSize: number;
  maxFrontier: number;
  solutions: number[][];
  /** nodesExpanded at the moment the first solution was found. */
  firstSolutionAt: number | null;
};

export type SearchOptions = {
  /** Stop after this many expanded nodes. */
  budget?: number;
  /** Stop when the frontier would exceed this many states (protects memory for BFS). */
  frontierCap?: number;
  /** Stop at the first solution instead of enumerating all of them. */
  stopAtFirst?: boolean;
};

export const DEFAULT_BUDGET = 3_000_000;
export const DEFAULT_FRONTIER_CAP = 300_000;

// States are packed into one float64: depth + 16 * sum(digit_k * 10^k), k = position in order.
// 10 digits * 10^10 * 16 < 2^53, so this is exact.
function pack(depth: number, payload: number) {
  return depth + 16 * payload;
}

const POW10 = Array.from({ length: 11 }, (_, i) => 10 ** i);

export type Search = { events: Generator<SearchEvent, SearchStats, void>; stats: SearchStats; order: number[] };

export function createSearch(puzzle: Puzzle, algo: Algorithm, opts: SearchOptions = {}): Search {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const cap = opts.frontierCap ?? DEFAULT_FRONTIER_CAP;
  const order = letterOrder(puzzle, algo);
  const stats: SearchStats = {
    status: "running",
    nodesExpanded: 0,
    pruned: 0,
    frontierSize: 1,
    maxFrontier: 1,
    solutions: [],
    firstSolutionAt: null,
  };
  return { events: run(puzzle, algo, order, budget, cap, !!opts.stopAtFirst, stats), stats, order };
}

function* run(
  puzzle: Puzzle,
  algo: Algorithm,
  order: number[],
  budget: number,
  cap: number,
  stopAtFirst: boolean,
  stats: SearchStats,
): Generator<SearchEvent, SearchStats, void> {
  const n = order.length;
  const model = columnModel(puzzle);
  const digits = new Int8Array(puzzle.letters.length).fill(-1);
  const fifo = algo === "bfs";
  // Frontier: plain array used as a queue (head pointer) or as a stack.
  let frontier: number[] = [pack(0, 0)];
  let head = 0;
  const ev: SearchEvent = { type: "expand", assignment: digits, frontierSize: 1, nodesExpanded: 0 };
  const emit = (type: SearchEvent["type"]) => {
    ev.type = type;
    ev.frontierSize = stats.frontierSize;
    ev.nodesExpanded = stats.nodesExpanded;
    return ev;
  };
  const load = (state: number) => {
    const depth = state % 16;
    let payload = (state - depth) / 16;
    digits.fill(-1);
    let used = 0;
    for (let k = 0; k < depth; k++) {
      const d = payload % 10;
      payload = (payload - d) / 10;
      digits[order[k]] = d;
      used |= 1 << d;
    }
    return { depth, used, payload: (state - depth) / 16 };
  };

  while (frontier.length - head > 0) {
    if (stats.nodesExpanded >= budget) {
      stats.status = "budget";
      return stats;
    }
    const state = fifo ? frontier[head++] : (frontier.pop() as number);
    if (fifo && head > 65536 && head * 2 > frontier.length) {
      frontier = frontier.slice(head);
      head = 0;
    }
    stats.frontierSize = frontier.length - head;
    stats.nodesExpanded++;
    const { depth, used, payload } = load(state);

    if (depth === n) {
      if (verify(puzzle, digits)) {
        stats.solutions.push(Array.from(digits));
        if (stats.firstSolutionAt === null) stats.firstSolutionAt = stats.nodesExpanded;
        yield emit("goal");
        if (stopAtFirst) {
          stats.status = "done";
          return stats;
        }
      } else {
        stats.pruned++;
        yield emit("prune");
      }
      continue;
    }

    yield emit("expand");
    // emit() hands out the shared buffer; restore it in case a consumer touched it.
    load(state);

    const letter = order[depth];
    const children: number[] = [];
    for (let d = 0; d <= 9; d++) {
      if (used & (1 << d)) continue;
      if (algo === "column") {
        // Leading zeros and column arithmetic are checked as soon as the letter is placed.
        digits[letter] = d;
        const ok = !(d === 0 && puzzle.leading[letter]) && columnsConsistent(model, digits);
        if (!ok) {
          stats.pruned++;
          yield emit("prune");
          digits[letter] = -1;
          load(state);
          continue;
        }
        digits[letter] = -1;
      }
      children.push(pack(depth + 1, payload + d * POW10[depth]));
    }
    if (fifo) {
      for (const c of children) frontier.push(c);
    } else {
      // Push in reverse so the smallest digit is tried first.
      for (let i = children.length - 1; i >= 0; i--) frontier.push(children[i]);
    }
    stats.frontierSize = frontier.length - head;
    if (stats.frontierSize > stats.maxFrontier) stats.maxFrontier = stats.frontierSize;
    if (stats.frontierSize > cap) {
      stats.status = "cap";
      return stats;
    }
  }
  stats.status = "done";
  stats.frontierSize = 0;
  return stats;
}

/** Runs a search to completion synchronously. Use only off the UI thread or for small budgets. */
export function solve(puzzle: Puzzle, algo: Algorithm, opts: SearchOptions = {}): SearchStats {
  const s = createSearch(puzzle, algo, opts);
  let r = s.events.next();
  while (!r.done) r = s.events.next();
  return r.value;
}

/** Advances a search by at most `maxEvents` events or `maxMs` milliseconds. Returns the last event. */
export function advance(search: Search, maxEvents: number, maxMs = Infinity, now: () => number = () => Date.now()) {
  const start = maxMs === Infinity ? 0 : now();
  let last: SearchEvent | null = null;
  for (let i = 0; i < maxEvents; i++) {
    const r = search.events.next();
    if (r.done) return { last, done: true };
    last = r.value;
    if (maxMs !== Infinity && (i & 1023) === 1023 && now() - start > maxMs) break;
  }
  return { last, done: search.stats.status !== "running" };
}

export function formatSolution(puzzle: Puzzle, digits: ArrayLike<number>): string {
  const nums = puzzle.addends.map((w) => wordValue(puzzle, w, digits));
  return `${nums.join(" + ")} = ${wordValue(puzzle, puzzle.result, digits)}`;
}

export const EXAMPLES = ["SEND + MORE = MONEY", "TWO + TWO = FOUR", "BASE + BALL = GAMES", "CROSS + ROADS = DANGER"];
