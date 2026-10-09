import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  averageScore,
  boundaryScore,
  countVectorizerTokens,
  preProcess,
  pySplit,
  segment,
  segmentDetailed,
  similarityScores,
} from "./logic.ts";

type Data = { conjunctions: string[]; endings: string[]; passages: { raw: string; reference: string[]; pythonScore: number }[] };
const data: Data = JSON.parse(readFileSync(new URL("../../../../public/demos/urdu/urdu-segmenter.json", import.meta.url), "utf8"));

test("each passage reproduces the Python score exactly", () => {
  const expected = [66.37, 67.96, 75.38];
  data.passages.forEach((p, i) => {
    const own = segment(preProcess(p.raw), data.conjunctions, data.endings);
    const score = averageScore(own, p.reference);
    assert.equal(score, p.pythonScore, `passage ${i + 1}`);
    assert.equal(score, expected[i], `passage ${i + 1}`);
  });
});

test("pre_processing spaces punctuation and digits like Python re", () => {
  assert.equal(preProcess("ہے۔وہ"), "ہے ۔ وہ");
  assert.equal(preProcess("سال 1739"), "سال  1  7  3  9 ");
  // \d is Unicode-aware: Extended Arabic-Indic digits are split too
  assert.equal(preProcess("۱۲"), " ۱  ۲ ");
  assert.equal(preProcess("‘قبر’  ذرا"), "قبر ذرا");
});

test("python str.split semantics", () => {
  assert.deepEqual(pySplit("  a b c \n"), ["a", "b", "c"]);
  assert.deepEqual(pySplit("   "), []);
});

test("CountVectorizer token pattern: combining marks split, single chars dropped", () => {
  // U+0670 (superscript alef) is a combining mark, so وزیراعلیٰ -> وزیراعلی
  assert.deepEqual(countVectorizerTokens("وزیراعلیٰ خیبر و 12 a_b"), ["وزیراعلی", "خیبر", "12", "a_b"]);
  assert.deepEqual(countVectorizerTokens("AB ab"), ["ab", "ab"]);
});

test("cosine similarity takes the best reference match", () => {
  const s = similarityScores(["aa bb", "cc"], ["aa bb", "dd"]);
  assert.ok(Math.abs(s[0] - 1) < 1e-12);
  assert.equal(s[1], 0);
});

test("conjunction guard blocks a break and is reported", () => {
  const segs = segmentDetailed("وہ گیا اور کھانا تھا", ["وہ", "اور"], ["گیا", "تھا"]);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].trigger.kind, "ending");
  assert.equal(segs[0].guards[0].reason, "previous-is-conjunction");
  assert.equal(segs[0].guards[0].conjunction, "وہ");
});

test("boundary precision/recall on the same text", () => {
  const b = boundaryScore(["ab cd", "ef"], ["ab", "cd ef"]);
  assert.ok(b);
  assert.equal(b.precision, 0);
  assert.equal(b.recall, 0);
  const c = boundaryScore(["ab", "cd", "ef"], ["ab", "cd ef"]);
  assert.ok(c);
  assert.equal(c.precision, 0.5);
  assert.equal(c.recall, 1);
  assert.equal(boundaryScore(["ab"], ["xy"]), null);
});

test("boundary score is defined for all three passages", () => {
  for (const p of data.passages) {
    const own = segment(preProcess(p.raw), data.conjunctions, data.endings);
    const b = boundaryScore(own, p.reference);
    assert.ok(b, "streams should match");
  }
});
