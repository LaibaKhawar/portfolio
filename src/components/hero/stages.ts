// The six stages shown in the hero network. Descriptions tie each stage to real work.
export const stages = [
  { id: "ingest", label: "Ingest", detail: "Reports, CRM events, EDI files, and documents become structured records." },
  { id: "embed", label: "Embed", detail: "Sentence-transformer embeddings for semantic search and mapping." },
  { id: "retrieve", label: "Retrieve", detail: "Hybrid retrieval: pgvector similarity plus graph traversal." },
  { id: "reason", label: "Reason", detail: "LLM pipelines and agents plan, extract, and summarise." },
  { id: "verify", label: "Verify", detail: "NLI, semantic similarity, rules, and LLM-as-a-judge checks." },
  { id: "respond", label: "Respond", detail: "Grounded answers, reports, and actions behind human review." },
] as const;

export type StageId = (typeof stages)[number]["id"];
