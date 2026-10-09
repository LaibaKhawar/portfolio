"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowCounterClockwise, Pause, Play, Shuffle, SkipForward } from "@phosphor-icons/react";
import { Button, Chip, DemoFrame, Stat, cx, inputClass } from "@/components/ui/primitives";
import {
  POLICIES,
  PRESETS,
  activeVehicles,
  initState,
  onBridge,
  presetArrivals,
  stats,
  tick,
  type Config,
  type Policy,
  type Preset,
  type State,
  type Vehicle,
} from "./logic";

const SPEEDS = [
  { id: "2", label: "2 ticks/s", perSec: 2 },
  { id: "5", label: "5 ticks/s", perSec: 5 },
  { id: "12", label: "12 ticks/s", perSec: 12 },
  { id: "40", label: "40 ticks/s", perSec: 40 },
];

const CROSS_TICKS = 6;

type Setup = { policy: Policy; preset: Preset; seed: number; rate: number; busShare: number };

const DEFAULT_SETUP: Setup = { policy: "original", preset: "bus-after-cars", seed: 3, rate: 0.35, busShare: 0.3 };

function build(setup: Setup): State {
  const config: Config = { policy: setup.policy, crossTicks: CROSS_TICKS, seed: setup.seed, carBatch: 4 };
  return initState(config, presetArrivals(setup.preset, setup.seed, setup.rate, setup.busShare));
}

function VehicleChip({ v, dim, title }: { v: Vehicle; dim?: boolean; title?: string }) {
  const bus = v.kind === "bus";
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-5 items-center justify-center rounded-[5px] font-mono text-[9px] leading-none",
        bus ? "w-12 border border-accent bg-accent-soft text-accent" : "w-7 bg-fg/80 text-bg",
        dim && (bus ? "border-dashed opacity-80" : "bg-fg/35"),
      )}
    >
      {v.label}
    </span>
  );
}

function stateLabel(v: Vehicle): string {
  switch (v.pc) {
    case "lock":
      return "waiting for the mutex";
    case "relock":
      return "woken, waiting for the mutex";
    case "check":
      return "holds the mutex, checking";
    case "waiting":
      return v.kind === "car" ? "blocked on canCrossBridge" : "blocked on canCrossBridgeForBus";
    default:
      return v.pc;
  }
}

export default function BridgeDemo() {
  const reduce = useReducedMotion();
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [sim, setSim] = useState<State>(() => build(DEFAULT_SETUP));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState("5");

  const simRef = useRef(sim);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const commit = useCallback((s: State) => {
    simRef.current = s;
    setSim(s);
  }, []);

  const advance = useCallback(() => {
    const s = tick(simRef.current);
    commit(s);
    return s.stalled || s.finished || s.violations > 0;
  }, [commit]);

  useEffect(() => {
    if (!running) return;
    const perSec = SPEEDS.find((s) => s.id === speed)?.perSec ?? 5;
    timerRef.current = setInterval(() => {
      if (advance()) {
        if (timerRef.current !== null) clearInterval(timerRef.current);
        timerRef.current = null;
        setRunning(false);
      }
    }, 1000 / perSec);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, speed, advance]);

  const reset = (next: Setup = setup) => {
    setRunning(false);
    setSetup(next);
    commit(build(next));
  };

  const st = stats(sim);
  const bridge = onBridge(sim);
  const active = activeVehicles(sim);
  const queued = active.filter((v) => !bridge.includes(v) && v.pc !== "unlockExit");
  const done = sim.vehicles.filter((v) => v.pc === "done");
  const waitingCount = active.filter((v) => v.pc === "waiting").length;
  const holder = sim.mutex !== null ? sim.vehicles[sim.mutex] : null;
  const ended = sim.stalled || sim.finished;
  const randomPreset = setup.preset !== "bus-after-cars";

  const status = sim.violation
    ? `Invariant violated: ${sim.violation}.`
    : sim.stalled
      ? `Stalled: ${waitingCount} vehicle${waitingCount === 1 ? "" : "s"} waiting with nobody left to wake them.`
      : sim.finished
        ? `All ${sim.vehicles.length} vehicles crossed in ${sim.tick} ticks.`
        : sim.tick === 0
          ? "Ready. Press Play or Step."
          : `Tick ${sim.tick}: ${bridge.length} on the bridge, ${queued.length} at the entrance.`;

  // Lane slot for each car on the bridge so two cars side by side do not overlap.
  const carRow = new Map<number, number>();
  bridge
    .filter((v) => v.kind === "car")
    .sort((a, b) => a.id - b.id)
    .forEach((v, i) => carRow.set(v.id, i % 2));

  return (
    <DemoFrame
      title="Single-lane bridge: mutex and condition variables"
      note={
        <>
          Runs in your browser: a tick-based model of Q2.cpp with an explicit mutex (granted in request order) and two
          condition variables with Mesa semantics. &quot;Original&quot; copies Q2.cpp exactly: a leaving bus signals only
          canCrossBridgeForBus and a leaving car broadcasts only canCrossBridge, so a bus waiting behind cars is never
          woken. &quot;Fixed&quot; wakes both kinds when the bridge empties and one car when a car slot frees.
          &quot;Fixed + fairness&quot; also stops admitting cars after a batch of 4 while a bus waits.
        </>
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setRunning((r) => !r)}
            disabled={ended}
            aria-label={running ? "Pause simulation" : "Play simulation"}
          >
            {running ? <Pause weight="bold" aria-hidden /> : <Play weight="bold" aria-hidden />}
            {running ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" onClick={() => advance()} disabled={running || ended} aria-label="Advance one tick">
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
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs text-fg-faint" id="bridge-policy">
              Policy
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="bridge-policy">
              {POLICIES.map((p) => (
                <Chip key={p.id} active={setup.policy === p.id} onClick={() => reset({ ...setup, policy: p.id })}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs text-fg-faint" id="bridge-preset">
              Arrivals
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="bridge-preset">
              {PRESETS.map((p) => (
                <Chip key={p.id} active={setup.preset === p.id} onClick={() => reset({ ...setup, preset: p.id })}>
                  {p.label}
                </Chip>
              ))}
            </div>
            {randomPreset ? (
              <Button variant="quiet" onClick={() => reset({ ...setup, seed: (setup.seed * 7919 + 13) % 100003 })} aria-label="New random arrivals">
                <Shuffle aria-hidden />
                New seed
              </Button>
            ) : null}
          </div>
          {randomPreset ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Arrival rate
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.05}
                  value={setup.rate}
                  onChange={(e) => reset({ ...setup, rate: Number(e.target.value) })}
                  className="w-28 accent-[var(--accent)]"
                />
                <span className="w-16 font-mono tabular-nums">{setup.rate.toFixed(2)}/tick</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Bus share
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.05}
                  value={setup.busShare}
                  onChange={(e) => reset({ ...setup, busShare: Number(e.target.value) })}
                  className="w-28 accent-[var(--accent)]"
                />
                <span className="w-10 font-mono tabular-nums">{Math.round(setup.busShare * 100)}%</span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_5rem]" aria-label="Bridge scene">
          <div className="rounded-input border border-line bg-bg p-2">
            <div className="mb-1.5 text-[11px] text-fg-faint">Entrance ({queued.length})</div>
            <div className="flex min-h-12 flex-wrap content-start gap-1">
              {queued.map((v) => (
                <VehicleChip key={v.id} v={v} dim={v.pc === "waiting"} title={`${v.label}: ${stateLabel(v)}`} />
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-snug text-fg-faint">Solid: after the mutex. Faded: blocked on a condvar.</div>
          </div>
          <div className="relative min-h-24 overflow-hidden rounded-input border border-line-strong bg-surface">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-fg/10" aria-hidden />
            <div className="absolute left-2 top-1.5 text-[11px] text-fg-faint">
              Bridge: {sim.cars} car{sim.cars === 1 ? "" : "s"}, {sim.buses} bus{sim.buses === 1 ? "" : "es"}
            </div>
            {bridge.map((v) => {
              const progress = v.pc === "crossing" ? (CROSS_TICKS - v.left) / CROSS_TICKS : v.pc === "unlockEnter" ? 0 : 1;
              const top = v.kind === "bus" ? "calc(50% - 10px)" : carRow.get(v.id) === 0 ? "calc(50% - 24px)" : "calc(50% + 4px)";
              return (
                <span
                  key={v.id}
                  className={cx("absolute", !reduce && "transition-[left] duration-300 ease-linear")}
                  style={{ left: `calc(${progress * 100}% * 0.82 + 4px)`, top }}
                >
                  <VehicleChip v={v} title={`${v.label}: on the bridge`} />
                </span>
              );
            })}
          </div>
          <div className="rounded-input border border-line bg-bg p-2">
            <div className="mb-1.5 text-[11px] text-fg-faint">Crossed</div>
            <div className="font-mono text-sm tabular-nums text-fg">
              {done.length}/{sim.vehicles.length}
            </div>
          </div>
        </div>

        <p
          aria-live="polite"
          className={cx("text-sm", sim.stalled || sim.violation ? "text-danger" : sim.finished ? "text-ok" : "text-fg-muted")}
        >
          {status}
        </p>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid content-start gap-2 rounded-input border border-line bg-bg p-3 font-mono text-xs">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-44 shrink-0 text-fg-faint">mutex holder</span>
              <span className={holder ? "text-accent" : "text-fg-faint"}>{holder ? holder.label : "free"}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-44 shrink-0 text-fg-faint">mutex queue</span>
              <span className="min-w-0 break-words text-fg-muted">
                {sim.mutexQueue.length ? sim.mutexQueue.map((id) => sim.vehicles[id].label).join(" ") : "empty"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-44 shrink-0 text-fg-faint">canCrossBridge</span>
              <span className="min-w-0 break-words text-fg">
                {sim.cvQueues.cars.length ? sim.cvQueues.cars.map((id) => sim.vehicles[id].label).join(" ") : "no waiters"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-44 shrink-0 text-fg-faint">canCrossBridgeForBus</span>
              <span className="min-w-0 break-words text-fg">
                {sim.cvQueues.buses.length ? sim.cvQueues.buses.map((id) => sim.vehicles[id].label).join(" ") : "no waiters"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-44 shrink-0 text-fg-faint">invariant violations</span>
              <span className={sim.violations ? "text-danger" : "text-fg-muted"}>{sim.violations}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Tick" value={sim.tick} />
            <Stat label="Cars crossed" value={st.crossedCars} />
            <Stat label="Buses crossed" value={st.crossedBuses} />
            <Stat label="Avg wait" value={st.avgWait.toFixed(1)} hint="ticks" />
            <Stat label="Max wait" value={st.maxWait} hint="ticks" />
            <Stat label="Max bus wait" value={st.maxBusWait} hint="ticks" />
          </div>
        </div>

        <ol className="min-h-[11.5rem] rounded-input border border-line bg-bg p-3 font-mono text-[11px] leading-5 text-fg-muted" aria-label="Recent events">
          {sim.log.length === 0 ? <li className="text-fg-faint">No events yet.</li> : null}
          {sim.log.map((e, i) => (
            <li key={`${e.tick}-${i}-${e.text}`} className={cx("truncate tabular-nums", i === sim.log.length - 1 && "text-fg")}>
              <span className="mr-2 text-fg-faint">{String(e.tick).padStart(4, " ")}</span>
              {e.text}
            </li>
          ))}
        </ol>
      </div>
    </DemoFrame>
  );
}
