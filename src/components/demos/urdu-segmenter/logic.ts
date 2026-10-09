/**
 * Port of the rule-based Urdu sentence segmenter from i21_1697.ipynb
 * (cells 19, 22 and 26). Framework-free so it can run in Node tests.
 *
 * Python semantics that matter here:
 * - `\s` and `str.split()` use Unicode whitespace (str.isspace()).
 * - `\d` in a str pattern matches any Unicode decimal digit (category Nd).
 * - CountVectorizer's default token pattern `(?u)\b\w\w+\b`, where `\w` is
 *   any character with str.isalnum() true, or underscore. Combining marks
 *   (category M) are NOT word characters, so they split tokens.
 */

/** Characters Python's str.isspace() treats as whitespace. */
const PY_SPACE_CLASS = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_WS_RUN = new RegExp(`[${PY_SPACE_CLASS}]+`, "gu");
const PY_WS_EDGE = new RegExp(`^[${PY_SPACE_CLASS}]+|[${PY_SPACE_CLASS}]+$`, "gu");

const PUNCT = new Set(["۔", "؟", "!"]);

function pyStrip(text: string): string {
  return text.replace(PY_WS_EDGE, "");
}

/** Python `str.split()` with no arguments. */
export function pySplit(text: string): string[] {
  const t = pyStrip(text);
  return t ? t.split(PY_WS_RUN) : [];
}

/** Cell 19: pre_processing. */
export function preProcess(text: string): string {
  let t = text.replace(/([۔؟!])([^ ١٢٣٤٥٦٧٨٩٠])/gu, "$1 $2");
  t = t.replace(/([^ ١٢٣٤٥٦٧٨٩٠])([۔؟!])/gu, "$1 $2");
  t = t.replace(/[‘’]/gu, " ");
  t = pyStrip(t.replace(PY_WS_RUN, " "));
  t = t.replace(/(\p{Nd})/gu, " $1 ");
  return t;
}

export type Trigger =
  | { kind: "punctuation"; mark: string }
  | { kind: "ending"; word: string }
  | { kind: "end-of-text" };

export type Guard = {
  /** Index of the ending word inside the sentence's word list. */
  wordIndex: number;
  word: string;
  reason: "previous-is-conjunction" | "word-is-conjunction" | "first-word";
  /** The conjunction that blocked the break, when there is one. */
  conjunction?: string;
};

export type Segment = {
  text: string;
  words: string[];
  trigger: Trigger;
  guards: Guard[];
};

/** Cell 22: improved_custom_sentence_tokenizer (rule part), with a trace of why each break happened. */
export function segmentDetailed(input: string, conjunctions: Iterable<string>, endings: Iterable<string>): Segment[] {
  const conj = new Set(conjunctions);
  const ends = new Set(endings);
  let text = input.replace(/([۔؟!])/gu, " $1 ");
  text = pyStrip(text.replace(PY_WS_RUN, " "));

  const out: Segment[] = [];
  let current: string[] = [];
  let guards: Guard[] = [];

  const flush = (trigger: Trigger) => {
    // ' '.join(current).strip(): words never carry whitespace, so strip is a no-op.
    out.push({ text: current.join(" "), words: current, trigger, guards });
    current = [];
    guards = [];
  };

  for (const raw of pySplit(text)) {
    const word = pyStrip(raw);
    if (PUNCT.has(word)) {
      if (current.length) flush({ kind: "punctuation", mark: word });
      continue;
    }
    current.push(word);
    if (ends.has(word)) {
      const prev = current.length > 1 ? current[current.length - 2] : undefined;
      const prevOk = current.length > 1 && !conj.has(prev as string);
      const selfOk = !conj.has(word);
      if (prevOk && selfOk) {
        flush({ kind: "ending", word });
      } else {
        const wordIndex = current.length - 1;
        if (current.length <= 1) guards.push({ wordIndex, word, reason: "first-word" });
        else if (!prevOk) guards.push({ wordIndex, word, reason: "previous-is-conjunction", conjunction: prev });
        else guards.push({ wordIndex, word, reason: "word-is-conjunction", conjunction: word });
      }
    }
  }
  if (current.length) flush({ kind: "end-of-text" });
  return out;
}

export function segment(input: string, conjunctions: Iterable<string>, endings: Iterable<string>): string[] {
  return segmentDetailed(input, conjunctions, endings).map((s) => s.text);
}

/* ---------------- Scoring (cell 26) ---------------- */

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** sklearn CountVectorizer default analyzer: lowercase, then `(?u)\b\w\w+\b`. */
export function countVectorizerTokens(doc: string): string[] {
  const s = doc.toLowerCase();
  const tokens: string[] = [];
  let run = "";
  for (const ch of s) {
    if (WORD_CHAR.test(ch)) run += ch;
    else {
      if ([...run].length >= 2) tokens.push(run);
      run = "";
    }
  }
  if ([...run].length >= 2) tokens.push(run);
  return tokens;
}

function countMap(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>, na: number, nb: number): number {
  if (na === 0 || nb === 0) return 0; // sklearn's normalize leaves zero rows at zero
  let dot = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const w = big.get(k);
    if (w) dot += v * w;
  }
  return dot / (na * nb);
}

const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));

/** For each own sentence, the best cosine similarity against any reference sentence. */
export function similarityScores(own: string[], reference: string[]): number[] {
  const ref = reference.map((r) => r.replace(/ /g, " "));
  const ownM = own.map((s) => countMap(countVectorizerTokens(s)));
  const refM = ref.map((s) => countMap(countVectorizerTokens(s)));
  const refN = refM.map(norm);
  return ownM.map((m) => {
    const n = norm(m);
    let best = -Infinity;
    refM.forEach((r, j) => {
      best = Math.max(best, cosine(m, r, n, refN[j]));
    });
    return best === -Infinity ? 0 : best;
  });
}

/** numpy round(x, 2): round half to even on x * 100. */
export function roundHalfEven2(x: number): number {
  const y = x * 100;
  const f = Math.floor(y);
  const diff = y - f;
  let r: number;
  if (diff > 0.5) r = f + 1;
  else if (diff < 0.5) r = f;
  else r = f % 2 === 0 ? f : f + 1;
  return r / 100;
}

/** Notebook accuracy: round(mean(scores) * 100, 2). */
export function averageScore(own: string[], reference: string[]): number {
  const s = similarityScores(own, reference);
  if (!s.length) return 0;
  return roundHalfEven2((s.reduce((a, b) => a + b, 0) / s.length) * 100);
}

/* ---------------- Boundary precision / recall ---------------- */

/**
 * Boundaries are compared on a letters-and-digits-only character stream, so
 * spacing, digit splitting and punctuation differences between the two
 * segmentations do not matter. A boundary is the stream offset where a
 * sentence ends; the final end of text is excluded. Returns null when the
 * two streams differ (the texts are not the same passage).
 */
const STREAM_CHAR = /[\p{L}\p{N}\p{M}]/u;

function boundaryOffsets(sentences: string[]): { stream: string; offsets: number[] } {
  let stream = "";
  const offsets: number[] = [];
  for (const s of sentences) {
    for (const ch of s) if (STREAM_CHAR.test(ch)) stream += ch;
    offsets.push(stream.length);
  }
  const total = stream.length;
  return { stream, offsets: [...new Set(offsets)].filter((o) => o > 0 && o < total) };
}

export type BoundaryScore = { precision: number; recall: number; f1: number; truePositives: number; predicted: number; actual: number };

export function boundaryScore(own: string[], reference: string[]): BoundaryScore | null {
  const a = boundaryOffsets(own);
  const b = boundaryOffsets(reference);
  if (a.stream !== b.stream) return null;
  const refSet = new Set(b.offsets);
  const tp = a.offsets.filter((o) => refSet.has(o)).length;
  const precision = a.offsets.length ? tp / a.offsets.length : 0;
  const recall = b.offsets.length ? tp / b.offsets.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, truePositives: tp, predicted: a.offsets.length, actual: b.offsets.length };
}
