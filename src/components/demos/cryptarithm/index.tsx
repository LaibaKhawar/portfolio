"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, Pause, Play, SkipForward } from "@phosphor-icons/react";
import { Button, Chip, DemoFrame, ErrorNote, Field, Stat, cx, inputClass } from "@/components/ui/primitives";
import {
  ALGORITHMS,
  DEFAULT_BUDGET,
  DEFAULT_FRONTIER_CAP,
  EXAMPLES,
  advance,
  columnCarries,
  createSearch,
  formatSolution,
  parsePuzzle,
  type Algorithm,
  type Puzzle,
  type Search,
  type SearchEvent,
  type SearchStats,
} from "./logic";

type RunState = "idle" | "running" | "paused" | "done";

type Speed = "slow" | "medium" | "fast" | "max";
const SPEEDS: { id: Speed; label: string; perSec: number }[] = [
  { id: "slow", label: "Slow", perSec: 4 },
  { id: "medium", label: "Medium", perSec: 40 },
  { id: "fast", label: "Fast", perSec: 2000 },
  { id: "max", label: "Max", perSec: Infinity },
];

type View = {
  digits: number[];
  type: SearchEvent["type"] | null;
  stats: SearchStats;
  elapsedMs: number;
};

type CompareEntry = { state: "pending" | "running" } | { state: "done"; stats: SearchStats };

const nf = new Intl.NumberFormat("en-US");

function emptyStats(): SearchStats {
  return { status: "running", nodesExpanded: 0, pruned: 0, frontierSize: 1, maxFrontier: 1, solutions: [], firstSolutionAt: null };
}

function copyStats(s: SearchStats): SearchStats {
  return { ...s, solutions: s.solutions.slice(0, 50) };
}

function initialPuzzle(): Puzzle {
  const r = parsePuzzle(EXAMPLES[0]);
  if (!r.ok) throw new Error("default puzzle must parse");
  return r.puzzle;
}

function outcome(s: SearchStats): string {
  switch (s.status) {
    case "done":
      return "complete";
    case "budget":
      return `stopped at node budget (${nf.format(DEFAULT_BUDGET)})`;
    case "cap":
      return `stopped at frontier cap (${nf.format(DEFAULT_FRONTIER_CAP)} states)`;
    default:
      return "running";
  }
}

export default function CryptarithmDemo() {
  const reduce = useReducedMotion();
  const [text, setText] = useState(EXAMPLES[0]);
  const [puzzle, setPuzzle] = useState<Puzzle>(initialPuzzle);
  const [error, setError] = useState<string | null>(null);
  const [algo, setAlgo] = useState<Algorithm>("column");
  const [speed, setSpeed] = useState<Speed>("medium");
  const [run, setRun] = useState<RunState>("idle");
  const [view, setView] = useState<View>(() => ({
    digits: Array(initialPuzzle().letters.length).fill(-1),
    type: null,
    stats: emptyStats(),
    elapsedMs: 0,
  }));
  const [compare, setCompare] = useState<Partial<Record<Algorithm, CompareEntry>>>({});

  const searchRef = useRef<Search | null>(null);
  const rafRef = useRef<number | null>(null);
  const bgRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const speedRef = useRef<Speed>(speed);
  const carryRef = useRef(0);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stopBackground = useCallback(() => {
    if (bgRef.current !== null) clearTimeout(bgRef.current);
    bgRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopLoop();
      stopBackground();
    },
    [stopLoop, stopBackground],
  );

  const publish = useCallback((search: Search, ev: SearchEvent | null) => {
    setView((prev) => ({
      digits: ev ? Array.from(ev.assignment) : prev.digits,
      type: ev ? ev.type : prev.type,
      stats: copyStats(search.stats),
      elapsedMs: elapsedRef.current,
    }));
  }, []);

  /** Runs the other algorithms to completion in small time slices so the page stays responsive. */
  const startComparison = useCallback(
    (p: Puzzle, main: Algorithm, mainStats: SearchStats) => {
      stopBackground();
      const others = ALGORITHMS.map((a) => a.id).filter((a) => a !== main);
      setCompare({
        [main]: { state: "done", stats: copyStats(mainStats) },
        ...Object.fromEntries(others.map((a) => [a, { state: "pending" }])),
      });
      let i = 0;
      let current: Search | null = null;
      const slice = () => {
        if (i >= others.length) {
          bgRef.current = null;
          return;
        }
        const id = others[i];
        if (!current) {
          current = createSearch(p, id);
          setCompare((c) => ({ ...c, [id]: { state: "running" } }));
        }
        const r = advance(current, 5_000_000, 8, () => performance.now());
        if (r.done) {
          const stats = copyStats(current.stats);
          setCompare((c) => ({ ...c, [id]: { state: "done", stats } }));
          current = null;
          i++;
        }
        bgRef.current = setTimeout(slice, 0);
      };
      bgRef.current = setTimeout(slice, 0);
    },
    [stopBackground],
  );

  const finish = useCallback(
    (search: Search) => {
      stopLoop();
      setRun("done");
      publish(search, null);
      startComparison(puzzle, algo, search.stats);
    },
    [algo, puzzle, publish, startComparison, stopLoop],
  );

  const ensureSearch = useCallback(() => {
    if (!searchRef.current) {
      searchRef.current = createSearch(puzzle, algo);
      elapsedRef.current = 0;
    }
    return searchRef.current;
  }, [algo, puzzle]);

  const loop = useCallback(() => {
    let last = performance.now();
    carryRef.current = 0;
    const frame = (now: number) => {
      const search = searchRef.current;
      if (!search) return;
      const dt = Math.min(100, now - last);
      last = now;
      const sp = SPEEDS.find((s) => s.id === speedRef.current) ?? SPEEDS[1];
      const t0 = performance.now();
      let r: { last: SearchEvent | null; done: boolean };
      if (sp.perSec === Infinity) {
        r = advance(search, 50_000_000, 12, () => performance.now());
      } else {
        carryRef.current += (sp.perSec * dt) / 1000;
        const n = Math.floor(carryRef.current);
        carryRef.current -= n;
        r = n > 0 ? advance(search, n, 12, () => performance.now()) : { last: null, done: false };
      }
      elapsedRef.current += performance.now() - t0;
      if (r.last || r.done) publish(search, r.last);
      if (r.done) {
        finish(search);
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [finish, publish]);

  const reset = useCallback(
    (p: Puzzle = puzzle) => {
      stopLoop();
      stopBackground();
      searchRef.current = null;
      elapsedRef.current = 0;
      setRun("idle");
      setCompare({});
      setView({ digits: Array(p.letters.length).fill(-1), type: null, stats: emptyStats(), elapsedMs: 0 });
    },
    [puzzle, stopBackground, stopLoop],
  );

  const onRun = () => {
    if (run === "running") {
      stopLoop();
      setRun("paused");
      return;
    }
    if (run === "done") return;
    ensureSearch();
    setRun("running");
    loop();
  };

  const onStep = () => {
    if (run === "running" || run === "done") return;
    const search = ensureSearch();
    const t0 = performance.now();
    const r = advance(search, 1);
    elapsedRef.current += performance.now() - t0;
    publish(search, r.last);
    if (r.done) finish(search);
    else setRun("paused");
  };

  const applyPuzzle = (value: string) => {
    const r = parsePuzzle(value);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setText(r.puzzle.text);
    setPuzzle(r.puzzle);
    reset(r.puzzle);
  };

  const chooseAlgo = (a: Algorithm) => {
    setAlgo(a);
    reset();
  };

  const stats = view.stats;
  const carries = columnCarries(puzzle, view.digits);
  const width = puzzle.result.length;
  const statusText =
    run === "idle"
      ? "Ready. Press Run or Step."
      : run === "done"
        ? `${ALGORITHMS.find((a) => a.id === algo)?.label}: ${outcome(stats)}, ${nf.format(stats.nodesExpanded)} nodes expanded, ${stats.solutions.length} solution${stats.solutions.length === 1 ? "" : "s"}.`
        : `${run === "running" ? "Searching" : "Paused"}. Last node: ${view.type ?? "none"}.`;

  return (
    <DemoFrame
      title="Cryptarithm search"
      note={
        <>
          Runs in your browser. The three searches are TypeScript ports of the notebook in the original repo. Its
          &quot;A*&quot; uses priority len(assignment) + #unassigned, which is constant, so it behaves as breadth-first
          search by insertion order. Its DFS checked only the arithmetic and returned M = 0; here leading zeros are
          rejected at the goal test. The column-wise search with carry pruning is a new addition.
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyPuzzle(text);
            }}
          >
            <div className="min-w-0 flex-1 basis-56">
              <Field label="Puzzle" htmlFor="crypt-puzzle" hint="Letters only, 2 to 5 words added, at most 10 distinct letters.">
                <input
                  id="crypt-puzzle"
                  className={cx(inputClass, "font-mono uppercase")}
                  value={text}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => setText(e.target.value)}
                  aria-invalid={error ? true : undefined}
                />
              </Field>
            </div>
            <Button type="submit" variant="ghost" className="mb-6">
              Load
            </Button>
          </form>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Example puzzles">
            {EXAMPLES.map((ex) => (
              <Chip key={ex} active={puzzle.text === ex} onClick={() => applyPuzzle(ex)}>
                {ex.replace(/ /g, "")}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Search algorithm">
            {ALGORITHMS.map((a) => (
              <Chip key={a.id} active={algo === a.id} onClick={() => chooseAlgo(a.id)}>
                {a.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={onRun} disabled={run === "done"} aria-label={run === "running" ? "Pause search" : "Run search"}>
              {run === "running" ? <Pause weight="bold" aria-hidden /> : <Play weight="bold" aria-hidden />}
              {run === "running" ? "Pause" : run === "paused" ? "Resume" : "Run"}
            </Button>
            <Button variant="ghost" onClick={onStep} disabled={run === "running" || run === "done"} aria-label="Step one node">
              <SkipForward aria-hidden />
              Step
            </Button>
            <Button variant="quiet" onClick={() => reset()} aria-label="Reset search">
              <ArrowCounterClockwise aria-hidden />
              Reset
            </Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
              Speed
              <select
                className={cx(inputClass, "w-auto py-1.5")}
                value={speed}
                onChange={(e) => setSpeed(e.target.value as Speed)}
              >
                {SPEEDS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.perSec !== Infinity ? ` (${s.perSec}/s)` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto rounded-input border border-line bg-bg p-4">
            <div
              className="mx-auto grid w-max gap-x-1 gap-y-1 font-mono"
              style={{ gridTemplateColumns: `1.25rem repeat(${width}, minmax(1.9rem, 2.4rem))` }}
              role="table"
              aria-label="Column addition with the current partial assignment"
            >
              <div role="row" className="contents">
                <span role="cell" className="text-[10px] text-fg-faint" />
                {Array.from({ length: width }, (_, k) => {
                  const col = width - 1 - k;
                  const c = col > 0 ? carries[col] : null;
                  return (
                    <span role="cell" key={k} className="h-4 text-center text-[11px] tabular-nums text-fg-faint" title="carry into this column">
                      {col > 0 && c !== null && c > 0 ? c : ""}
                    </span>
                  );
                })}
              </div>
              {[...puzzle.addends, puzzle.result].map((word, row) => {
                const isResult = row === puzzle.addends.length;
                const isLastAddend = row === puzzle.addends.length - 1;
                return (
                  <div role="row" className="contents" key={row}>
                    <span role="cell" className={cx("self-center text-sm text-fg-muted", isResult && "border-t border-line-strong pt-1")}>
                      {isLastAddend ? "+" : isResult ? "=" : ""}
                    </span>
                    {Array.from({ length: width }, (_, k) => {
                      const pos = word.length - width + k;
                      const ch = pos >= 0 ? word[pos] : null;
                      const idx = ch ? puzzle.letters.indexOf(ch) : -1;
                      const d = idx >= 0 ? view.digits[idx] : -1;
                      return (
                        <span
                          role="cell"
                          key={k}
                          className={cx(
                            "flex flex-col items-center rounded-[6px] py-1",
                            isResult && "mt-1 border-t border-line-strong pt-2",
                            ch && "bg-white/[0.03]",
                          )}
                        >
                          <span className="text-xs text-fg-muted">{ch ?? ""}</span>
                          <motion.span
                            key={`${d}`}
                            initial={reduce ? false : { opacity: 0.2, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={cx(
                              "text-lg leading-tight tabular-nums",
                              d < 0 ? "text-fg-faint" : view.type === "goal" ? "text-accent" : "text-fg",
                            )}
                          >
                            {ch ? (d < 0 ? "·" : d) : ""}
                          </motion.span>
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 font-mono text-xs" aria-label="Letter assignments">
              {puzzle.letters.map((l, i) => (
                <span
                  key={l}
                  className={cx(
                    "rounded-full border px-2 py-0.5 tabular-nums",
                    view.digits[i] >= 0 ? "border-line-strong text-fg" : "border-line text-fg-faint",
                  )}
                >
                  {l}={view.digits[i] >= 0 ? view.digits[i] : "?"}
                </span>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-fg-faint">
              Last node:{" "}
              <span className={cx("font-mono", view.type === "goal" ? "text-accent" : view.type === "prune" ? "text-fg-muted line-through" : "text-fg-muted")}>
                {view.type ?? "none yet"}
              </span>
            </p>
          </div>

          <div className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Nodes expanded" value={nf.format(stats.nodesExpanded)} />
              <Stat label="Frontier size" value={nf.format(stats.frontierSize)} hint={`peak ${nf.format(stats.maxFrontier)}`} />
              <Stat label="Pruned" value={nf.format(stats.pruned)} />
              <Stat label="Solutions" value={stats.solutions.length} />
              <Stat label="Search time" value={`${(view.elapsedMs / 1000).toFixed(2)} s`} />
              <Stat label="Status" value={<span className="text-sm">{run === "done" ? outcome(stats) : run}</span>} />
            </div>
            <p aria-live="polite" className="text-sm text-fg-muted">
              {statusText}
            </p>
            {run === "done" && stats.solutions.length > 0 ? (
              <div className="rounded-input border border-line bg-bg px-3 py-2 font-mono text-sm tabular-nums">
                {stats.solutions.slice(0, 6).map((s, i) => (
                  <div key={i} className={i === 0 ? "text-accent" : "text-fg-muted"}>
                    {formatSolution(puzzle, s)}
                  </div>
                ))}
                {stats.solutions.length > 6 ? <div className="text-fg-faint">and {stats.solutions.length - 6} more</div> : null}
              </div>
            ) : null}
            {run === "done" && stats.solutions.length === 0 && stats.status === "done" ? (
              <p className="text-sm text-fg-muted">No assignment satisfies this puzzle.</p>
            ) : null}
          </div>
        </div>

        {run === "done" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="mb-2 text-left text-xs text-fg-faint">
                Same puzzle, all three searches run to completion (the other two run in the background).
              </caption>
              <thead className="text-xs text-fg-faint">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-normal">Algorithm</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Nodes expanded</th>
                  <th scope="col" className="py-2 pr-3 font-normal">First solution at node</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Solutions</th>
                  <th scope="col" className="py-2 font-normal">Outcome</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {ALGORITHMS.map((a) => {
                  const e = compare[a.id];
                  const s = e && e.state === "done" ? e.stats : null;
                  return (
                    <tr key={a.id} className={cx("border-b border-line", a.id === algo && "text-fg")}>
                      <th scope="row" className="py-2 pr-3 font-sans font-normal text-fg-muted">
                        {a.label}
                      </th>
                      <td className="py-2 pr-3">{s ? nf.format(s.nodesExpanded) : e?.state === "running" ? "running" : "queued"}</td>
                      <td className="py-2 pr-3">{s ? (s.firstSolutionAt !== null ? nf.format(s.firstSolutionAt) : "none") : ""}</td>
                      <td className="py-2 pr-3">{s ? s.solutions.length : ""}</td>
                      <td className="py-2 font-sans text-xs text-fg-muted">{s ? outcome(s) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DemoFrame>
  );
}
