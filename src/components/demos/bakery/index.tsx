"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, Pause, Play, SkipForward } from "@phosphor-icons/react";
import { Button, Chip, DemoFrame, Stat, cx, inputClass } from "@/components/ui/primitives";
import { initState, inCriticalSection, phaseLabel, step, type Config, type Scheduler, type State, type Thread } from "./logic";

const SCHEDULERS: { id: Scheduler; label: string }[] = [
  { id: "round-robin", label: "Round-robin" },
  { id: "random", label: "Random (seeded)" },
  { id: "adversarial", label: "Adversarial" },
];

const SPEEDS = [
  { id: "1", label: "1 op/s", perSec: 1 },
  { id: "4", label: "4 op/s", perSec: 4 },
  { id: "12", label: "12 op/s", perSec: 12 },
  { id: "40", label: "40 op/s", perSec: 40 },
  { id: "200", label: "200 op/s", perSec: 200 },
];

const DEFAULT_CONFIG: Config = { n: 3, scheduler: "random", broken: false, csSteps: 3, remSteps: 2, seed: 17 };

function phaseTone(t: Thread) {
  if (t.pc === "critical") return "border-accent bg-accent-soft text-accent";
  if (t.pc === "waitChoosing" || t.pc === "waitNumber") return "border-line-strong text-fg";
  if (t.pc === "remainder") return "border-line text-fg-faint";
  return "border-line-strong text-fg-muted";
}

export default function BakeryDemo() {
  const reduce = useReducedMotion();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [sim, setSim] = useState<State>(() => initState(DEFAULT_CONFIG));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState("4");

  const simRef = useRef(sim);
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(4);

  useEffect(() => {
    speedRef.current = SPEEDS.find((s) => s.id === speed)?.perSec ?? 4;
  }, [speed]);

  const commit = useCallback((s: State) => {
    simRef.current = s;
    setSim(s);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  /** Advances n operations, stopping early at a mutual-exclusion violation. */
  const advance = useCallback(
    (n: number) => {
      let s = simRef.current;
      for (let i = 0; i < n; i++) {
        s = step(s);
        if (s.violationNow) break;
      }
      commit(s);
      return s.violationNow;
    },
    [commit],
  );

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let budget = 0;
    const frame = (now: number) => {
      budget += (Math.min(250, now - last) * speedRef.current) / 1000;
      last = now;
      const n = Math.floor(budget);
      budget -= n;
      if (n > 0 && advance(n)) {
        rafRef.current = null;
        setRunning(false);
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    // A first step right away so Play responds immediately.
    if (advance(1)) {
      queueMicrotask(() => setRunning(false));
      return;
    }
    rafRef.current = requestAnimationFrame(frame);
    return stopLoop;
  }, [running, advance, stopLoop]);

  const reset = (next: Config = config) => {
    setRunning(false);
    stopLoop();
    setConfig(next);
    commit(initState(next));
  };

  const setScheduler = (scheduler: Scheduler) => {
    const next = { ...config, scheduler };
    setConfig(next);
    // The scheduler can change mid-run without resetting memory.
    commit({ ...simRef.current, config: { ...simRef.current.config, scheduler } });
  };

  const inCs = inCriticalSection(sim);
  const last = sim.lastOp;
  const violation = sim.violationNow;
  const n = sim.config.n;

  const status = violation
    ? `Mutual exclusion violated at step ${sim.steps}: ${inCs.map((i) => `T${i}`).join(" and ")} are both in the critical section.`
    : last
      ? `Step ${sim.steps}: ${last.text}.`
      : "Ready. Press Play or Step.";

  const cellTone = (array: "choosing" | "number", i: number) => {
    if (!last || last.array !== array || last.index !== i) return "border-line";
    return last.kind === "write" ? "border-accent bg-accent-soft text-accent" : "border-fg-muted bg-fg/[0.06] text-fg";
  };

  return (
    <DemoFrame
      title="Bakery lock, one memory operation per step"
      note={
        <>
          Runs in your browser: a step-by-step model of the canonical Lamport Bakery algorithm, where each step is one
          shared read or write by one thread. The original Q1.cpp re-took its ticket inside the wait loop, incremented the
          ticket on unlock instead of clearing it, and used relaxed atomics; this model implements the textbook version
          instead. &quot;Break it&quot; removes the choosing flag so you can watch the race the flag prevents.
        </>
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause simulation" : "Play simulation"}>
            {running ? <Pause weight="bold" aria-hidden /> : <Play weight="bold" aria-hidden />}
            {running ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" onClick={() => advance(1)} disabled={running} aria-label="Execute one operation">
            <SkipForward aria-hidden />
            Step
          </Button>
          <Button variant="quiet" onClick={() => reset()} aria-label="Reset simulation">
            <ArrowCounterClockwise aria-hidden />
            Reset
          </Button>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Speed
            <select className={cx(inputClass, "w-auto py-1.5")} value={speed} onChange={(e) => setSpeed(e.target.value)}>
              {SPEEDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Threads
            <select
              className={cx(inputClass, "w-auto py-1.5")}
              value={config.n}
              onChange={(e) => reset({ ...config, n: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-faint" id="bakery-sched">
            Scheduler
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="bakery-sched">
            {SCHEDULERS.map((s) => (
              <Chip key={s.id} active={config.scheduler === s.id} onClick={() => setScheduler(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.broken}
            onClick={() => reset({ ...config, broken: !config.broken, scheduler: !config.broken ? "adversarial" : config.scheduler })}
            className={cx(
              "ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
              config.broken ? "border-accent text-accent" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
            )}
          >
            <span className={cx("relative h-3.5 w-6 rounded-full", config.broken ? "bg-accent" : "bg-fg/15")} aria-hidden>
              <span
                className={cx(
                  "absolute top-0.5 size-2.5 rounded-full bg-bg transition-[left]",
                  config.broken ? "left-3" : "left-0.5",
                )}
              />
            </span>
            Break it: remove choosing[]
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-2" aria-label="Threads">
            {sim.threads.map((t) => {
              const active = last?.thread === t.id;
              return (
                <div
                  key={t.id}
                  className={cx(
                    "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-input border px-3 py-2 transition-colors",
                    active ? "border-line-strong bg-fg/[0.04]" : "border-line bg-bg",
                  )}
                >
                  <span className={cx("font-mono text-sm", active ? "text-fg" : "text-fg-muted")}>T{t.id}</span>
                  <div className="min-w-0">
                    <span className={cx("inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-xs", phaseTone(t))}>
                      {phaseLabel(t)}
                    </span>
                    <div className="mt-1 font-mono text-[11px] text-fg-faint tabular-nums">
                      {t.pc === "readMax" ? `reading number[${t.j}], max so far ${t.max}` : t.pc === "writeNumber" ? `will write ticket ${t.max + 1}` : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                    <span className={sim.choosing[t.id] ? "text-fg" : "text-fg-faint"} title="choosing flag">
                      ch {sim.choosing[t.id] ? "T" : "F"}
                    </span>
                    <span className="text-fg" title="ticket number">
                      #{sim.number[t.id]}
                    </span>
                    <span className="text-fg-faint" title="critical section entries">
                      {sim.csEntries[t.id]}x
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid content-start gap-4">
            <div className="rounded-input border border-line bg-bg p-3">
              <div className="mb-2 text-xs text-fg-faint">Shared memory</div>
              {(["choosing", "number"] as const).map((arr) => (
                <div key={arr} className="mb-2 flex items-center gap-2 last:mb-0">
                  <span className="w-16 shrink-0 font-mono text-xs text-fg-muted">{arr}[]</span>
                  <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                    {Array.from({ length: n }, (_, i) => (
                      <div
                        key={i}
                        className={cx("rounded-[6px] border px-1 py-1 text-center font-mono text-xs tabular-nums transition-colors", cellTone(arr, i))}
                      >
                        <div className="text-[9px] text-fg-faint">{i}</div>
                        {arr === "choosing" ? (sim.choosing[i] ? "T" : "F") : sim.number[i]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-2 flex gap-3 text-[11px] text-fg-faint">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm border border-accent bg-accent-soft" aria-hidden /> written this step
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm border border-fg-muted bg-fg/[0.06]" aria-hidden /> read this step
                </span>
              </div>
            </div>

            <div
              className={cx(
                "rounded-input border p-3",
                violation ? "border-danger/60 bg-danger/10" : inCs.length ? "border-accent/50 bg-accent-soft" : "border-line bg-bg",
              )}
            >
              <div className="text-xs text-fg-faint">Critical section</div>
              <div className="mt-1 flex min-h-7 items-center gap-2">
                {inCs.length === 0 ? <span className="text-sm text-fg-faint">empty</span> : null}
                {inCs.map((id) => (
                  <motion.span
                    key={id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cx("rounded-full px-2.5 py-0.5 font-mono text-sm", violation ? "bg-danger/20 text-danger" : "bg-accent text-accent-ink")}
                  >
                    T{id}
                  </motion.span>
                ))}
              </div>
              {violation ? (
                <p className="mt-2 text-sm text-danger" role="alert">
                  Violation: two threads are inside at once. Paused.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p aria-live="polite" className="text-sm text-fg-muted">
          {status}
        </p>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ol className="min-h-[13.5rem] rounded-input border border-line bg-bg p-3 font-mono text-[11px] leading-5 text-fg-muted" aria-label="Last operations">
            {sim.log.length === 0 ? <li className="text-fg-faint">No operations yet.</li> : null}
            {sim.log.map((op, i) => (
              <li key={op.step} className={cx("truncate tabular-nums", i === sim.log.length - 1 && "text-fg")}>
                <span className="mr-2 text-fg-faint">{String(op.step).padStart(5, " ")}</span>
                {op.text}
              </li>
            ))}
          </ol>
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Steps" value={sim.steps} />
              <Stat label="CS entries" value={sim.csEntries.reduce((a, b) => a + b, 0)} />
              <Stat
                label="Violations"
                value={<span className={sim.violations > 0 ? "text-danger" : undefined}>{sim.violations}</span>}
                hint={sim.firstViolationStep !== null ? `first at step ${sim.firstViolationStep}` : undefined}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs text-fg-faint">CS entries per thread (fairness)</div>
              <div className="grid gap-1">
                {sim.csEntries.map((c, i) => {
                  const max = Math.max(1, ...sim.csEntries);
                  return (
                    <div key={i} className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="w-6 text-fg-muted">T{i}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-fg/[0.06]">
                        <div className="h-full rounded-full bg-fg/50" style={{ width: `${(c / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right text-fg-muted">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
