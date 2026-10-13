"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Chip, DemoFrame, ErrorNote, Skeleton, Stat, cx, inputClass } from "@/components/ui/primitives";
import { averageScore, boundaryScore, preProcess, segmentDetailed, type Guard, type Segment } from "./logic";

type Passage = { raw: string; reference: string[]; pythonScore: number };
type Data = { conjunctions: string[]; endings: string[]; passages: Passage[] };

const URDU_FONT = { fontFamily: '"Noto Nastaliq Urdu", "Noto Naskh Arabic", "Geeza Pro", serif' } as const;

function guardText(g: Guard): string {
  if (g.reason === "first-word") return `No break at ${g.word}: it opens the sentence`;
  if (g.reason === "word-is-conjunction") return `No break at ${g.word}: the word is also in the conjunction list`;
  return `No break at ${g.word}: preceded by conjunction ${g.conjunction}`;
}

function triggerLabel(s: Segment): string {
  if (s.trigger.kind === "punctuation") return `Punctuation ${s.trigger.mark}`;
  if (s.trigger.kind === "ending") return `Ending word ${s.trigger.word}`;
  return "End of text";
}

function SentenceRow({ s, n }: { s: Segment; n: number }) {
  const guarded = new Map(s.guards.map((g) => [g.wordIndex, g]));
  const lastIsTrigger = s.trigger.kind === "ending";
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-2 border-b border-line py-2.5 last:border-b-0">
      <span className="pt-1 font-mono text-xs text-fg-faint tabular-nums">{n}</span>
      <div className="min-w-0">
        <p dir="rtl" lang="ur" style={URDU_FONT} className="text-base leading-[2.1] text-fg">
          {s.words.map((w, i) => {
            const g = guarded.get(i);
            const isTrigger = lastIsTrigger && i === s.words.length - 1;
            return (
              <span key={i}>
                <span
                  className={cx(
                    isTrigger && "rounded bg-accent-soft px-1 text-accent",
                    g && "underline decoration-fg-faint decoration-dashed underline-offset-8",
                  )}
                  title={g ? guardText(g) : undefined}
                >
                  {w}
                </span>
                {i < s.words.length - 1 ? " " : null}
                {s.trigger.kind === "punctuation" && i === s.words.length - 1 ? (
                  <span className="rounded bg-accent-soft px-1 text-accent">{s.trigger.mark}</span>
                ) : null}
              </span>
            );
          })}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-faint">
          <span className={s.trigger.kind === "end-of-text" ? undefined : "text-fg-muted"}>{triggerLabel(s)}</span>
          {s.guards.map((g, i) => (
            <span key={i}>{guardText(g)}</span>
          ))}
        </div>
      </div>
    </li>
  );
}

export default function UrduSegmenterDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const textId = useId();

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/demos/urdu/urdu-segmenter.json", { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Data>;
      })
      .then((d) => {
        setData(d);
        setText(d.passages[2]?.raw ?? "");
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError("Could not load the Urdu word lists and sample passages.");
      });
    return () => ctrl.abort();
  }, []);

  const deferred = useDeferredValue(text);
  const passageIndex = data ? data.passages.findIndex((p) => p.raw === deferred) : -1;
  const sample = passageIndex >= 0 && data ? data.passages[passageIndex] : null;

  const result = useMemo(() => {
    if (!data) return null;
    const segs = segmentDetailed(preProcess(deferred), data.conjunctions, data.endings);
    const own = segs.map((s) => s.text);
    const score = sample ? averageScore(own, sample.reference) : null;
    const boundaries = sample ? boundaryScore(own, sample.reference) : null;
    return { segs, score, boundaries, guards: segs.reduce((a, s) => a + s.guards.length, 0) };
  }, [data, deferred, sample]);

  const activeChip = data ? data.passages.findIndex((p) => p.raw === text) : -1;

  const controls = data ? (
    <div role="group" aria-label="Sample passage" className="flex flex-wrap gap-1.5">
      {data.passages.map((p, i) => (
        <Chip key={i} active={activeChip === i} onClick={() => setText(p.raw)}>
          Passage {i + 1}
        </Chip>
      ))}
      <Chip active={activeChip === -1} onClick={() => activeChip !== -1 && setText("")}>
        Your text
      </Chip>
    </div>
  ) : null;

  return (
    <DemoFrame
      title="Urdu sentence segmenter"
      controls={controls}
      note="Runs the notebook's rules in your browser: pre-processing, then a word-by-word pass that breaks on ۔ ؟ ! or on an ending word unless a conjunction guards it. The score is a cosine similarity proxy, as in the notebook, not boundary F1."
    >
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data || !result ? (
        <div className="grid gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <label htmlFor={textId} className="text-xs text-fg-muted">
              Urdu text
            </label>
            <textarea
              id={textId}
              dir="rtl"
              lang="ur"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="یہاں اردو متن لکھیں"
              style={URDU_FONT}
              className={cx(inputClass, "resize-y text-base leading-[2]")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sentences found" value={result.segs.length} hint={sample ? `Reference: ${sample.reference.length}` : undefined} />
            <Stat label="Breaks blocked by guard" value={result.guards} />
            <Stat
              label="Similarity score"
              value={result.score !== null ? `${result.score.toFixed(2)}%` : "n/a"}
              hint={sample ? `Python: ${sample.pythonScore.toFixed(2)}%` : "Pick a sample passage"}
            />
            <Stat
              label="Boundary P / R"
              value={result.boundaries ? `${Math.round(result.boundaries.precision * 100)}% / ${Math.round(result.boundaries.recall * 100)}%` : "n/a"}
              hint={result.boundaries ? `${result.boundaries.truePositives} of ${result.boundaries.actual} reference breaks hit` : undefined}
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {`${result.segs.length} sentences detected.`}
            {result.score !== null ? ` Similarity score ${result.score.toFixed(2)} percent.` : ""}
          </p>

          <div className={cx("grid gap-5", sample && "lg:grid-cols-2")}>
            <section aria-label="Detected sentences" className="min-w-0 rounded-card border border-line bg-bg p-3 sm:p-4">
              <h4 className="mb-1 text-xs font-medium text-fg-muted">Detected sentences</h4>
              {result.segs.length ? (
                <ol tabIndex={0} aria-label="Detected sentences list" data-lenis-prevent className="max-h-[32rem] overflow-y-auto pr-1">
                  {result.segs.map((s, i) => (
                    <SentenceRow key={i} s={s} n={i + 1} />
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-fg-faint">Type or paste Urdu text to segment it.</p>
              )}
            </section>
            {sample ? (
              <section aria-label="Reference segmentation" className="min-w-0 rounded-card border border-line bg-bg p-3 sm:p-4">
                <h4 className="mb-1 text-xs font-medium text-fg-muted">Reference segmentation</h4>
                <ol tabIndex={0} aria-label="Reference sentences list" data-lenis-prevent className="max-h-[32rem] overflow-y-auto pr-1">
                  {sample.reference.map((r, i) => (
                    <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 border-b border-line py-2.5 last:border-b-0">
                      <span className="pt-1 font-mono text-xs text-fg-faint tabular-nums">{i + 1}</span>
                      <p dir="rtl" lang="ur" style={URDU_FONT} className="text-base leading-[2.1] text-fg-muted">
                        {r.replace(/ /g, " ").trim()}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-fg-faint">
            Highlighted: the mark or ending word that closed each sentence. Dashed underline: an ending word where the break was blocked.
            Boundary precision and recall compare where sentences end, measured on the letters and digits only, so spacing and
            punctuation do not count.
          </p>
        </div>
      )}
    </DemoFrame>
  );
}
