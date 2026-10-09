"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { Copy, Graph, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { experience } from "@/content/profile";
import { projects } from "@/content/projects";
import { FlowLink } from "@/components/flow/FlowLink";
import { Button, Chip, DemoFrame, ErrorNote, Stat, cx, inputClass } from "@/components/ui/primitives";
import { bm25Index, bm25Scores, buildChunks, cosineScores, estimateTokens, expand, fuse, rankOf, tokenize, topK, type Entity } from "./retrieval";

const EXAMPLES = [
  "How are LLM claims checked before a report?",
  "graph-based customer memory",
  "translating English into Urdu",
  "evaluate model output with an LLM judge",
  "semantic search over a movie catalogue",
];

type ModelState = { kind: "off" } | { kind: "loading"; pct: number } | { kind: "embedding"; done: number; total: number } | { kind: "ready" } | { kind: "error"; message: string };

function highlight(text: string, terms: Set<string>) {
  return text.split(/(\s+)/).map((w, i) => {
    const t = tokenize(w)[0];
    return t && terms.has(t) ? (
      <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-accent">
        {w}
      </mark>
    ) : (
      <span key={i}>{w}</span>
    );
  });
}

export function RetrievalLab() {
  const chunks = useMemo(() => buildChunks(projects.filter((p) => p.tier !== "archive"), experience), []);
  const index = useMemo(() => bm25Index(chunks.map((c) => c.text)), [chunks]);
  const entities = useMemo<Entity[]>(
    () => [
      ...projects.filter((p) => p.tier !== "archive").map((p) => ({ id: p.slug, title: p.title, kind: "project" as const, href: `/work/${p.slug}`, entities: [...p.tech, ...p.categories] })),
      ...experience.map((r) => ({ id: r.company, title: `${r.title}, ${r.company}`, kind: "role" as const, href: "/#experience", entities: r.stack })),
    ],
    [],
  );

  const [query, setQuery] = useState(EXAMPLES[0]);
  const deferred = useDeferredValue(query);
  const [k, setK] = useState(5);
  const [weight, setWeight] = useState(0.5);
  const [useGraph, setUseGraph] = useState(true);
  const [model, setModel] = useState<ModelState>({ kind: "off" });
  const [chunkVecs, setChunkVecs] = useState<Float32Array[] | null>(null);
  const [queryVec, setQueryVec] = useState<{ q: string; v: Float32Array } | null>(null);
  const [copied, setCopied] = useState(false);
  const worker = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const pending = useRef(new Map<number, (v: Float32Array[]) => void>());

  useEffect(() => () => worker.current?.terminate(), []);

  const embed = useCallback((texts: string[]) => {
    const id = ++reqId.current;
    return new Promise<Float32Array[]>((resolve) => {
      pending.current.set(id, resolve);
      worker.current!.postMessage({ type: "embed", id, texts });
    });
  }, []);

  const loadModel = useCallback(() => {
    if (worker.current) return;
    setModel({ kind: "loading", pct: 0 });
    const w = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = async (e) => {
      const m = e.data;
      if (m.type === "progress") setModel({ kind: "loading", pct: m.total ? Math.round((m.loaded / m.total) * 100) : 0 });
      else if (m.type === "error") {
        setModel({ kind: "error", message: m.message });
        w.terminate();
        worker.current = null;
      } else if (m.type === "vectors") {
        const out: Float32Array[] = [];
        for (let i = 0; i < m.data.length; i += m.dim) out.push(m.data.slice(i, i + m.dim));
        pending.current.get(m.id)?.(out);
        pending.current.delete(m.id);
      } else if (m.type === "ready") {
        const all: Float32Array[] = [];
        const batch = 24;
        for (let i = 0; i < chunks.length; i += batch) {
          setModel({ kind: "embedding", done: i, total: chunks.length });
          all.push(...(await embed(chunks.slice(i, i + batch).map((c) => c.text))));
        }
        setChunkVecs(all);
        setModel({ kind: "ready" });
      }
    };
    w.onerror = () => {
      setModel({ kind: "error", message: "The embedding worker failed to start." });
      worker.current = null;
    };
    w.postMessage({ type: "load" });
  }, [chunks, embed]);

  // Embed the query whenever it settles and the model is ready.
  useEffect(() => {
    if (model.kind !== "ready" || !deferred.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const [v] = await embed([deferred]);
      if (!cancelled) setQueryVec({ q: deferred, v });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deferred, model.kind, embed]);

  const result = useMemo(() => {
    const q = deferred.trim();
    if (!q) return null;
    const lex = bm25Scores(index, q);
    const dense = chunkVecs && queryVec?.q === q ? cosineScores(queryVec.v, chunkVecs) : null;
    const fused = fuse(lex, dense, dense ? weight : 0);
    const lexRank = rankOf(lex);
    const denseRank = dense ? rankOf(dense) : null;
    const hits = topK(fused, k).map(({ i, s }) => ({ chunk: chunks[i], fused: s, lex: lex[i], lexRank: lex[i] > 0 ? lexRank[i] : null, dense: dense?.[i] ?? null, denseRank: denseRank?.[i] ?? null }));
    const seedIds = [...new Set(hits.map((h) => h.chunk.source.id))];
    const seeds = entities.filter((e) => seedIds.includes(e.id));
    const expansion = useGraph ? expand(seeds, entities, 2, 4) : [];
    return { hits, seeds, expansion, denseUsed: !!dense, terms: new Set(tokenize(q)) };
  }, [deferred, index, chunkVecs, queryVec, weight, k, chunks, entities, useGraph]);

  const context = useMemo(() => {
    if (!result) return "";
    const parts = result.hits.map((h, n) => `[${n + 1}] (${h.chunk.source.title}, ${h.chunk.field})\n${h.chunk.text}`);
    if (result.expansion.length) parts.push(`Related via shared entities: ${result.expansion.map((e) => `${e.item.title} (${e.via.join(", ")})`).join("; ")}`);
    return `Answer using only the context below. Cite sources by number.\n\nQuestion: ${deferred.trim()}\n\nContext:\n${parts.join("\n\n")}`;
  }, [result, deferred]);

  const modelLabel =
    model.kind === "off" ? "Lexical only" : model.kind === "loading" ? `Downloading model ${model.pct}%` : model.kind === "embedding" ? `Embedding ${model.done}/${model.total} chunks` : model.kind === "ready" ? "Hybrid: BM25 + MiniLM" : "Model unavailable";

  return (
    <DemoFrame
      title="Hybrid retrieval over this portfolio"
      controls={<span className="font-mono text-[11px] text-fg-faint">{chunks.length} chunks · {modelLabel}</span>}
      note={
        <>
          Everything runs in your browser. BM25 is computed locally; dense search uses all-MiniLM-L6-v2 (quantized ONNX, about 23 MB, downloaded from Hugging Face only when you load it). Ranks are fused with weighted reciprocal-rank fusion (k = 60). No language model is called: the right-hand panel shows the context a RAG system would send to one.
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-3">
          <label htmlFor="lab-q" className="sr-only">
            Question
          </label>
          <div className="relative">
            <MagnifyingGlass size={16} aria-hidden className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint" />
            <input id="lab-q" value={query} onChange={(e) => setQuery(e.target.value)} className={cx(inputClass, "py-3 pl-9 text-base")} placeholder="Ask about any project or role" />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Chip key={ex} active={query === ex} onClick={() => setQuery(ex)}>
                {ex}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 rounded-input border border-line p-4 md:grid-cols-[auto_1fr_auto_auto] md:items-center md:gap-6">
          {model.kind === "off" || model.kind === "error" ? (
            <Button variant="primary" onClick={loadModel}>
              <Sparkle size={16} aria-hidden /> Load embedding model
            </Button>
          ) : (
            <div className="min-w-44">
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{ width: model.kind === "ready" ? "100%" : model.kind === "loading" ? `${model.pct}%` : `${Math.round((model.done / model.total) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-fg-faint">{modelLabel}</div>
            </div>
          )}
          <label className="grid gap-1.5 text-xs text-fg-muted">
            <span className="flex justify-between">
              <span>Lexical</span>
              <span className="font-mono text-fg">dense weight {weight.toFixed(2)}</span>
              <span>Semantic</span>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={weight} disabled={model.kind !== "ready"} onChange={(e) => setWeight(+e.target.value)} className="accent-[var(--accent)] disabled:opacity-40" aria-label="Weight of dense retrieval in fusion" />
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Top
            <select value={k} onChange={(e) => setK(+e.target.value)} className={cx(inputClass, "w-auto py-1")}>
              {[3, 5, 8].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input type="checkbox" checked={useGraph} onChange={(e) => setUseGraph(e.target.checked)} className="accent-[var(--accent)]" /> Graph expansion
          </label>
        </div>
        {model.kind === "error" ? <ErrorNote>Could not load the embedding model ({model.message}). Lexical retrieval still works.</ErrorNote> : null}

        {!result ? (
          <p className="text-sm text-fg-muted">Type a question to retrieve context.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="grid content-start gap-3" aria-live="polite">
              {result.hits.length === 0 ? (
                <p className="rounded-input border border-line p-4 text-sm text-fg-muted">
                  No keyword matches. {model.kind === "ready" ? "Try rephrasing." : "Load the embedding model to search by meaning instead of exact words."}
                </p>
              ) : (
                result.hits.map((h, n) => (
                  <article key={h.chunk.id} className="rounded-input border border-line bg-bg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-accent">[{n + 1}]</span>
                        {h.chunk.source.href ? (
                          <FlowLink href={h.chunk.source.href} className="text-sm text-fg hover:text-accent">
                            {h.chunk.source.title}
                          </FlowLink>
                        ) : (
                          <span className="text-sm text-fg">{h.chunk.source.title}</span>
                        )}
                        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-fg-faint">{h.chunk.field}</span>
                      </div>
                      <div className="flex gap-3 font-mono text-[11px] text-fg-faint tabular-nums">
                        <span title="BM25 rank">lex {h.lexRank ? `#${h.lexRank}` : "none"}</span>
                        {result.denseUsed ? <span title="Dense rank and cosine similarity">dense #{h.denseRank} ({h.dense?.toFixed(2)})</span> : null}
                        <span title="Fused score">rrf {(h.fused * 1000).toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">{highlight(h.chunk.text, result.terms)}</p>
                  </article>
                ))
              )}
            </div>

            <div className="grid content-start gap-5">
              {useGraph ? (
                <div className="rounded-input border border-line p-4">
                  <div className="flex items-center gap-2 text-sm text-fg">
                    <Graph size={16} className="text-accent" aria-hidden /> Graph expansion
                  </div>
                  {result.expansion.length ? (
                    <ul className="mt-3 grid gap-2.5">
                      {result.expansion.map((e) => (
                        <li key={e.item.id} className="text-sm">
                          <FlowLink href={e.item.href ?? "/"} className="text-fg hover:text-accent">
                            {e.item.title}
                          </FlowLink>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {e.via.map((v) => (
                              <span key={v} className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">
                                {v}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-fg-muted">No other item shares two or more uncommon entities with the retrieved sources.</p>
                  )}
                  <p className="mt-3 text-xs text-fg-faint">Items not retrieved directly but linked to the results through at least two shared technologies or categories. Shared entities are weighted by rarity, and ones attached to more than a quarter of items (like Python) are ignored.</p>
                </div>
              ) : null}

              <div className="rounded-input border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-fg">Context window</div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(context);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        /* clipboard blocked */
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
                  >
                    <Copy size={14} aria-hidden /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Chunks" value={result.hits.length} />
                  <Stat label="Approx. tokens" value={estimateTokens(context)} />
                </div>
                <pre data-lenis-prevent className="mt-3 max-h-64 overflow-auto rounded-input bg-bg p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted">
                  {context}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoFrame>
  );
}
