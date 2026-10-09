import { test } from "node:test";
import assert from "node:assert/strict";
import { bm25Index, bm25Scores, cosineScores, expand, fuse, rankOf, tokenize, topK } from "./retrieval.ts";

test("tokenize lowercases, drops stopwords, and stems plurals", () => {
  assert.deepEqual(tokenize("What are the Embeddings for graphs?"), ["embedd", "graph"]);
});

test("bm25 ranks the document containing the rare query term first", () => {
  const idx = bm25Index(["pgvector semantic search over embeddings", "graph traversal with neo4j", "semantic search with faiss"]);
  const s = bm25Scores(idx, "neo4j graph");
  assert.equal(topK(s, 1)[0].i, 1);
  assert.equal(s[0], 0);
});

test("bm25 prefers shorter documents at equal term frequency", () => {
  const idx = bm25Index(["retrieval", "retrieval plus a lot of other unrelated words here"]);
  const s = bm25Scores(idx, "retrieval");
  assert.ok(s[0] > s[1]);
});

test("cosine similarity of identical vectors is 1 and orthogonal is 0", () => {
  const s = cosineScores([1, 0], [[2, 0], [0, 3]]);
  assert.ok(Math.abs(s[0] - 1) < 1e-9);
  assert.ok(Math.abs(s[1]) < 1e-9);
});

test("rankOf assigns 1 to the highest score with stable ties", () => {
  assert.deepEqual(rankOf([0.2, 0.9, 0.2]), [2, 1, 3]);
});

test("fusion with w=0 follows lexical order; w=1 follows dense order", () => {
  const lex = [3, 2, 1];
  const den = [0.1, 0.5, 0.9];
  assert.equal(topK(fuse(lex, den, 0), 1)[0].i, 0);
  assert.equal(topK(fuse(lex, den, 1), 1)[0].i, 2);
  assert.equal(topK(fuse(lex, null, 0.7), 1)[0].i, 0);
});

test("graph expansion returns unseen items sharing enough entities", () => {
  const all = [
    { id: "a", title: "A", kind: "project" as const, entities: ["pgvector", "FastAPI", "RAG"] },
    { id: "b", title: "B", kind: "project" as const, entities: ["pgvector", "FastAPI"] },
    { id: "c", title: "C", kind: "role" as const, entities: ["PyTorch"] },
  ];
  const ex = expand([all[0]], all, 2, 5, 1);
  assert.deepEqual(ex.map((e) => e.item.id), ["b"]);
  assert.deepEqual(ex[0].via.sort(), ["FastAPI", "pgvector"]);
});

test("graph expansion ignores entities shared by most items", () => {
  const filler = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, title: `F${i}`, kind: "project" as const, entities: ["Python", "pandas"] }));
  const seed = { id: "s", title: "S", kind: "project" as const, entities: ["Python", "pandas", "Neo4j", "pgvector"] };
  const related = { id: "r", title: "R", kind: "role" as const, entities: ["Python", "Neo4j", "pgvector"] };
  const ex = expand([seed], [seed, related, ...filler]);
  assert.deepEqual(ex.map((e) => e.item.id), ["r"]);
  assert.deepEqual(ex[0].via.sort(), ["Neo4j", "pgvector"]);
});
