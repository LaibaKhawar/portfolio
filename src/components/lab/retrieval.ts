// Retrieval core for the lab: knowledge-base chunking, BM25, dense cosine search,
// reciprocal-rank fusion, and one-hop graph expansion over shared entities.
// Framework-free so it can be unit-tested with `node --test`.

export type SourceRef = { kind: "project" | "role"; id: string; title: string; href?: string };
export type Chunk = { id: string; source: SourceRef; field: string; text: string };

export type ProjectLike = {
  slug: string;
  title: string;
  tier: string;
  tagline: string;
  tech: string[];
  categories: string[];
  overview?: string;
  problem?: string;
  solution?: string;
  features?: string[];
  decisions?: string[];
  challenges?: string[];
  results?: { label: string; value: string; context: string }[];
  demoNote?: string;
};
export type RoleLike = { company: string; title: string; summary: string; points: string[]; stack: string[] };

export function buildChunks(projects: ProjectLike[], roles: RoleLike[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const p of projects) {
    const src: SourceRef = { kind: "project", id: p.slug, title: p.title, href: `/work/${p.slug}` };
    const add = (field: string, text?: string) => {
      if (text && text.trim().length > 20) chunks.push({ id: `${p.slug}:${field}:${chunks.length}`, source: src, field, text: text.trim() });
    };
    add("summary", `${p.title}. ${p.tagline} Built with ${p.tech.join(", ")}.`);
    add("overview", p.overview);
    add("problem", p.problem);
    add("approach", p.solution);
    add("demo", p.demoNote);
    p.features?.forEach((f) => add("feature", f));
    p.decisions?.forEach((f) => add("decision", f));
    p.challenges?.forEach((f) => add("challenge", f));
    p.results?.forEach((r) => add("result", `${r.label}: ${r.value} (${r.context}).`));
  }
  for (const r of roles) {
    const src: SourceRef = { kind: "role", id: r.company, title: `${r.title}, ${r.company}`, href: "/#experience" };
    chunks.push({ id: `${r.company}:summary`, source: src, field: "role", text: `${r.title} at ${r.company}. ${r.summary}` });
    r.points.forEach((pt, i) => chunks.push({ id: `${r.company}:point:${i}`, source: src, field: "role", text: pt }));
  }
  return chunks;
}

// ─────────────── Lexical: BM25 ───────────────

const STOP = new Set(
  "a an and are as at be by for from has have how i in into is it its of on or that the this to was what when where which who why with does do did can my me your you about over using use used".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

// Light suffix stripping so "embeddings" matches "embedding" and "graphs" matches "graph".
function stem(t: string) {
  if (t.length > 4 && t.endsWith("ies")) t = t.slice(0, -3) + "y";
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  return t;
}

export type Bm25Index = { docs: string[][]; df: Map<string, number>; avgdl: number; N: number };

export function bm25Index(texts: string[]): Bm25Index {
  const docs = texts.map(tokenize);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgdl, N: docs.length };
}

export function bm25Scores(index: Bm25Index, query: string, k1 = 1.2, b = 0.75): number[] {
  const q = tokenize(query);
  return index.docs.map((d) => {
    if (!d.length) return 0;
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / index.avgdl)));
    }
    return s;
  });
}

// ─────────────── Dense ───────────────

export function cosineScores(query: Float32Array | number[], vectors: (Float32Array | number[])[]): number[] {
  const qn = Math.hypot(...query) || 1;
  return vectors.map((v) => {
    let dot = 0, vn = 0;
    for (let i = 0; i < v.length; i++) {
      dot += v[i] * query[i];
      vn += v[i] * v[i];
    }
    return dot / (qn * (Math.sqrt(vn) || 1));
  });
}

// ─────────────── Fusion ───────────────

export function rankOf(scores: number[]): number[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const ranks = new Array<number>(scores.length);
  order.forEach(([, i], r) => (ranks[i] = r + 1));
  return ranks;
}

/** Weighted reciprocal-rank fusion. `w` is the dense weight in [0, 1]; lexical gets 1 - w. Zero-score docs get no lexical credit. */
export function fuse(lexical: number[], dense: number[] | null, w: number, k = 60): number[] {
  const lr = rankOf(lexical);
  const dr = dense ? rankOf(dense) : null;
  return lexical.map((s, i) => {
    const l = s > 0 ? (1 - (dr ? w : 0)) / (k + lr[i]) : 0;
    const d = dr ? w / (k + dr[i]) : 0;
    return l + d;
  });
}

export function topK(scores: number[], k: number, min = 1e-9) {
  return scores
    .map((s, i) => ({ i, s }))
    .filter((x) => x.s > min)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, k);
}

// ─────────────── Graph expansion ───────────────

export type Entity = { id: string; title: string; kind: "project" | "role"; href?: string; entities: string[] };
export type Expansion = { item: Entity; via: string[] };

const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Items not already retrieved that share informative entities with the retrieved set.
 * Entities are weighted by inverse frequency across all items, and entities attached to
 * more than `maxShare` of items (e.g. "Python") are ignored, so generic overlap does not count.
 */
export function expand(seeds: Entity[], all: Entity[], minShared = 2, limit = 5, maxShare = 0.25): Expansion[] {
  const df = new Map<string, number>();
  for (const item of all) for (const e of new Set(item.entities.map(canon))) df.set(e, (df.get(e) ?? 0) + 1);
  const N = all.length;
  const informative = (e: string) => (df.get(e) ?? 0) / N <= maxShare;
  const seedIds = new Set(seeds.map((s) => s.id));
  const seedEntities = new Map<string, string>();
  for (const s of seeds) for (const e of s.entities) if (informative(canon(e))) seedEntities.set(canon(e), e);
  const out: (Expansion & { score: number })[] = [];
  for (const item of all) {
    if (seedIds.has(item.id)) continue;
    const shared = [...new Set(item.entities.map(canon))].filter((e) => seedEntities.has(e));
    if (shared.length < minShared) continue;
    const score = shared.reduce((sum, e) => sum + Math.log(N / (df.get(e) ?? 1)), 0);
    out.push({ item, via: shared.map((e) => seedEntities.get(e)!), score });
  }
  return out
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item, via }) => ({ item, via }));
}

/** Rough token estimate (about 4 characters per token for English). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
