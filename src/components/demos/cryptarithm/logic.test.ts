import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearch, parsePuzzle, solve, verify, formatSolution, type Puzzle } from "./logic.ts";

function mustParse(s: string): Puzzle {
  const r = parsePuzzle(s);
  assert.ok(r.ok, `expected ${s} to parse`);
  return (r as { ok: true; puzzle: Puzzle }).puzzle;
}

test("column search finds exactly the unique SEND + MORE = MONEY solution", () => {
  const p = mustParse("SEND + MORE = MONEY");
  const stats = solve(p, "column");
  assert.equal(stats.status, "done");
  assert.equal(stats.solutions.length, 1);
  assert.equal(formatSolution(p, stats.solutions[0]), "9567 + 1085 = 10652");
});

test("TWO + TWO = FOUR: all solutions verify and none has a leading zero", () => {
  const p = mustParse("TWO+TWO==FOUR");
  for (const algo of ["column", "dfs", "bfs"] as const) {
    const stats = solve(p, algo);
    assert.equal(stats.status, "done", algo);
    assert.ok(stats.solutions.length > 0, algo);
    for (const s of stats.solutions) {
      assert.ok(verify(p, s));
      const t = s[p.letters.indexOf("T")];
      const f = s[p.letters.indexOf("F")];
      assert.notEqual(t, 0);
      assert.notEqual(f, 0);
      const [a, , r] = formatSolution(p, s).split(" ");
      assert.equal(Number(a) * 2, Number(formatSolution(p, s).split(" = ")[1]));
      assert.ok(r !== undefined);
    }
  }
  // All three complete searches agree on the solution set.
  const key = (x: number[][]) => x.map((s) => s.join("")).sort().join("|");
  assert.equal(key(solve(p, "column").solutions), key(solve(p, "dfs").solutions));
  assert.equal(key(solve(p, "column").solutions), key(solve(p, "bfs").solutions));
});

test("DFS with the leading-zero rule never returns M = 0 for SEND + MORE = MONEY", () => {
  const p = mustParse("SEND + MORE = MONEY");
  const first = solve(p, "dfs", { stopAtFirst: true });
  assert.equal(first.solutions.length, 1);
  assert.notEqual(first.solutions[0][p.letters.indexOf("M")], 0);
  assert.equal(formatSolution(p, first.solutions[0]), "9567 + 1085 = 10652");
  const all = solve(p, "dfs");
  assert.equal(all.status, "done");
  assert.equal(all.solutions.length, 1);
  for (const s of all.solutions) assert.notEqual(s[p.letters.indexOf("M")], 0);
});

test("column search expands far fewer nodes than DFS", () => {
  const p = mustParse("SEND + MORE = MONEY");
  const col = solve(p, "column");
  const dfs = solve(p, "dfs");
  assert.ok(col.nodesExpanded * 100 < dfs.nodesExpanded, `${col.nodesExpanded} vs ${dfs.nodesExpanded}`);
});

test("BFS on SEND + MORE stops at the frontier cap instead of exhausting memory", () => {
  const p = mustParse("SEND + MORE = MONEY");
  const stats = solve(p, "bfs", { frontierCap: 300_000 });
  assert.equal(stats.status, "cap");
  assert.ok(stats.maxFrontier > 300_000);
  assert.equal(stats.solutions.length, 0);
});

test("node budget is respected", () => {
  const p = mustParse("SEND + MORE = MONEY");
  const stats = solve(p, "dfs", { budget: 1000 });
  assert.equal(stats.status, "budget");
  assert.equal(stats.nodesExpanded, 1000);
});

test("events carry counters and goal events carry the solution", () => {
  const p = mustParse("TWO + TWO = FOUR");
  const s = createSearch(p, "column");
  let goals = 0;
  let lastNodes = 0;
  for (let r = s.events.next(); !r.done; r = s.events.next()) {
    assert.ok(r.value.nodesExpanded >= lastNodes);
    lastNodes = r.value.nodesExpanded;
    if (r.value.type === "goal") {
      goals++;
      assert.ok(verify(p, r.value.assignment));
    }
  }
  assert.equal(goals, s.stats.solutions.length);
});

test("invalid inputs are rejected", () => {
  const bad = [
    "",
    "SEND + MORE",
    "SEND + MORE = MONEY = X",
    "SEND1 + MORE = MONEY",
    "SEND = MONEY",
    "A+B+C+D+E+F = G",
    "SEND + = MONEY",
    "ABCDE + FGHIJ = KLMNOP",
    "LONGWORD + B = AB",
  ];
  for (const s of bad) assert.equal(parsePuzzle(s).ok, false, s);
  assert.equal(parsePuzzle("a + b + c = d").ok, true);
});
