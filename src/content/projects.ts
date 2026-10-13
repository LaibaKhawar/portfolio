/*
  Curated project metadata. Rules for editing:
  - Results must be traceable to a README or a recorded notebook output; put the
    location in `source`. Do not add numbers that are not recorded somewhere.
  - `demo` points at a real, working interactive component. If a project has no
    working demo, leave it out rather than linking to a placeholder.
  - `liveUrl` is only for deployments that have been checked and respond.
  To add a project: append an entry, pick a tier, and (optionally) register a demo
  in src/components/demos/registry.tsx. Gallery, case study pages, sitemap, and
  the systems explorer pick it up automatically.
*/

export type Category =
  | "Agentic AI"
  | "Generative AI"
  | "RAG and Knowledge"
  | "NLP"
  | "Computer Vision"
  | "Machine Learning"
  | "Data Engineering"
  | "Systems"
  | "Full-Stack";

export type Tier = "case-study" | "card" | "archive";

export type DemoKey =
  | "lazy-snapping"
  | "face-knn"
  | "perceptron"
  | "convolution"
  | "cryptarithm"
  | "bakery"
  | "bridge"
  | "btc-forecast"
  | "urdu-segmenter";

export type ArchNode = {
  id: string;
  label: string;
  detail: string;
  stage: number; // column index, left to right
  kind?: "input" | "model" | "store" | "logic" | "output" | "human";
};
export type ArchEdge = { from: string; to: string; label?: string };

export type Result = { label: string; value: string; context: string; source: string };

export type Project = {
  slug: string;
  title: string;
  repo?: string; // repository name under github.com/LaibaKhawar
  repoNote?: string; // shown when there is no public repo
  tagline: string;
  categories: Category[];
  tech: string[];
  tier: Tier;
  year?: string;
  status: string;
  liveUrl?: string;
  demo?: DemoKey;
  demoNote?: string;
  cover?: { src: string; alt: string };
  gallery?: { src: string; alt: string; caption?: string }[];
  video?: { src: string; poster: string; label: string };
  overview?: string;
  problem?: string;
  solution?: string;
  features?: string[];
  challenges?: string[];
  decisions?: string[];
  results?: Result[];
  limitations?: string[];
  architecture?: { nodes: ArchNode[]; edges: ArchEdge[] };
};

export const GITHUB = "https://github.com/LaibaKhawar";
export const repoUrl = (p: Project) => (p.repo ? `${GITHUB}/${p.repo}` : undefined);

export const projects: Project[] = [
  // ───────────────────────────── Case studies ─────────────────────────────
  {
    slug: "analystos",
    title: "AnalystOS",
    repo: "AnalystOS",
    tagline: "An autonomous data analyst that shows its work: every number in an answer traces back to the query that produced it.",
    categories: ["Agentic AI", "Generative AI", "Data Engineering", "Full-Stack"],
    tech: ["FastAPI", "Celery", "Redis", "PostgreSQL", "pgvector", "DuckDB", "sqlglot", "Docker sandbox", "Ollama", "Qwen3 8B", "React", "OpenTelemetry"],
    tier: "case-study",
    year: "2026",
    status: "Complete, with a public read-only replay of real analyses; asking new questions needs the backend (Docker Compose).",
    liveUrl: "https://laibakhawar.github.io/AnalystOS/",
    cover: { src: "/projects/analystos-workspace.jpg", alt: "AnalystOS workspace: an anomaly analysis with each fact marked verified and its evidence count" },
    gallery: [{ src: "/projects/analystos-evidence.jpg", alt: "Evidence drawer showing the SQL and rows behind one claim", caption: "One click shows the SQL, formula, and rows behind a claim." }],
    overview:
      "Upload a CSV or Excel workbook, or connect PostgreSQL, MySQL, or SQLite, and ask a business question. AnalystOS plans a multi-step analysis, runs validated read-only SQL and sandboxed Python, detects anomalies, breaks changes down into their drivers, draws charts, and writes a report.",
    problem:
      "Chat-with-your-data tools let a language model do arithmetic and state numbers it never computed. For business decisions, a confident wrong number is worse than no answer, and generated SQL and code are a safety risk in their own right.",
    solution:
      "The model plans; deterministic tools compute. Tools emit findings with values, formulas, entities, and periods, and the drafted answer is verified sentence by sentence against them: numbers that do not trace to a finding are removed. SQL is validated on its syntax tree and run in read-only sessions, and generated Python runs in an isolated container with no network.",
    features: [
      "Agent loop of plan, execute, observe, and revise over 18 typed tools, with conversation memory and clarifying questions.",
      "Scope check that catches plans adding filters nobody asked for or dropping a period the question named.",
      "SQL validation with sqlglot (single read statement, no DML or DDL, allowlists, PII columns count-only) plus read-only database sessions.",
      "Sandboxed Python in an ephemeral Docker container: no network, read-only filesystem, non-root, CPU, memory, and time limits.",
      "Statistics, anomaly detection (z-score, IQR, seasonal baselines, Isolation Forest), contribution analysis, charts, and HTML, PDF, and Excel reports.",
      "Scheduled analyses with alerts, team roles and sharing, and OpenTelemetry traces, Prometheus metrics, and a Grafana dashboard.",
    ],
    challenges: [
      "Ollama's default 4,096-token context silently truncated prompts, so the 8B model invented column names until the context was raised to 16K.",
      "The benchmark exposed real bugs, each fixed with a regression test: dropped periods, a number computed over all years accepted for a one-year sentence, and NaN values breaking JSON storage.",
    ],
    decisions: [
      "The language model never does arithmetic; trust comes from deterministic findings and verification, not from the model.",
      "Measure, don't estimate: a 67-case benchmark on five datasets, run repeatedly, with every failure listed and explained.",
      "One OpenAI-compatible interface, so local models (Ollama), hosted GPUs (vLLM on Modal), and commercial APIs are interchangeable.",
    ],
    results: [
      { label: "Benchmark pass rate", value: "93.3%", context: "67 cases on five datasets, mean of 2 runs, Qwen3 8B running locally", source: "AnalystOS/README.md, Evaluation results" },
      { label: "Unsupported numbers in final answers", value: "0%", context: "Down from 2.4% in model first drafts; 0% across all four models compared", source: "AnalystOS/README.md, Evaluation results" },
      { label: "Unsafe SQL executed", value: "0", context: "Safety cases passed 5 / 5 in both runs", source: "AnalystOS/README.md, Evaluation results" },
      { label: "Automated tests", value: "369 passed", context: "195 backend unit, 52 integration, 122 frontend unit, plus end-to-end", source: "AnalystOS/README.md, Test report" },
    ],
    limitations: [
      "Model quality drives answer quality: verification guarantees shown numbers are traceable, not that the agent asked the best question of the data.",
      "Analyses take one to four minutes with an 8B model on a laptop GPU; hosted models are much faster.",
      "Verification is lexical, so a correct number paired with a misleading description can slip through, though it stays auditable.",
    ],
    architecture: {
      nodes: [
        { id: "ui", label: "React app", detail: "Question, plan, live steps, verified answer, evidence drawer.", stage: 0, kind: "input" },
        { id: "api", label: "FastAPI", detail: "REST plus server-sent events; enqueues analyses.", stage: 1, kind: "logic" },
        { id: "worker", label: "Celery worker", detail: "Runs the orchestrator off the request path.", stage: 2, kind: "logic" },
        { id: "orc", label: "Orchestrator", detail: "Plan, execute, revise, and verify.", stage: 3, kind: "model" },
        { id: "llm", label: "LLM", detail: "Any OpenAI-compatible model; Qwen3 8B by default.", stage: 4, kind: "model" },
        { id: "sql", label: "SQL validator", detail: "sqlglot syntax-tree checks, read-only sessions.", stage: 4, kind: "logic" },
        { id: "box", label: "Python sandbox", detail: "Docker container with no network, or Modal.", stage: 4, kind: "logic" },
        { id: "pg", label: "PostgreSQL", detail: "Plans, findings, claims, and evidence provenance.", stage: 5, kind: "store" },
        { id: "answer", label: "Verified report", detail: "Every number traced to a finding.", stage: 6, kind: "output" },
      ],
      edges: [
        { from: "ui", to: "api" },
        { from: "api", to: "worker", label: "queue" },
        { from: "worker", to: "orc" },
        { from: "orc", to: "llm", label: "plan" },
        { from: "orc", to: "sql", label: "tools" },
        { from: "orc", to: "box" },
        { from: "sql", to: "pg" },
        { from: "box", to: "pg" },
        { from: "pg", to: "answer", label: "verify" },
      ],
    },
  },
  {
    slug: "voice-patient-registration",
    title: "Voice AI Patient Registration",
    repo: "voice-ai-patient-registration",
    tagline: "Call a phone number and register as a new patient by talking to an AI intake agent.",
    categories: ["Agentic AI", "Generative AI", "Full-Stack"],
    tech: ["Vapi", "GPT-4.1", "Deepgram nova-3", "FastAPI", "Pydantic v2", "PostgreSQL", "SQLAlchemy 2", "Alembic", "Next.js", "Docker", "Render"],
    tier: "case-study",
    year: "2026",
    status: "Deployed on Render with a live U.S. phone number; the REST API documentation is public and patient data requires an access key.",
    liveUrl: "https://voice-ai-patient-registration-9cd2.onrender.com/docs",
    overview:
      "A voice agent that registers U.S. patients over the phone. It collects the standard demographic dataset conversationally, validates every answer, reads the record back, and saves to PostgreSQL only after the caller confirms. Staff see registrations and call transcripts through an authenticated REST API and an admin dashboard.",
    problem:
      "An LLM is good at conversation but cannot be trusted to keep a record correct: it can skip steps, mishear names, alter values, or claim a save that never happened. Patient intake needs every field valid and nothing written without explicit confirmation.",
    solution:
      "The model handles natural language; the server owns the conversation state. Every captured value goes through a tool that validates it with the same rules as the API and stores it in a per-call draft. A review tool reads the exact draft back and records its hash, and the save tool refuses to write unless the caller confirmed and the draft is unchanged since that read-back. Saves are idempotent per call, so a retried tool call cannot create a duplicate patient.",
    features: [
      "Phone intake through Vapi: Deepgram nova-3 speech recognition, GPT-4.1 with tool calling, text-to-speech, and barge-in.",
      "Server-side registration state machine: validate on capture, read back, confirm, then save.",
      "Returning-caller flow: a known phone number triggers date-of-birth verification before any name is revealed.",
      "Handles corrections, out-of-order answers, silence, dropped calls, and Spanish-speaking callers.",
      "REST API with filters, pagination, partial updates, and soft delete, plus a Next.js admin dashboard served by the same container.",
      "PII masked in logs by default; the webhook and the dashboard are authenticated separately.",
    ],
    challenges: [
      "Live calls showed the model skipping the optional-fields question while claiming it had asked. The server now enforces that step instead of trusting a flag set by the model.",
      "Speech recognition misheard surnames and cities, so the agent asks for spellings one at a time and questions implausible place names.",
      "The model once altered a spoken birth year; it is now told never to change values, with the read-back and confirmation as the backstop.",
    ],
    decisions: [
      "Keep correctness in code, not in the prompt: one validation module is shared by the API schemas and the voice tools.",
      "PostgreSQL CHECK constraints, enums, and partial indexes as a second line of validation behind Pydantic.",
      "One Docker image serving the API and the static dashboard, so the browser never holds the API key and there is no CORS surface.",
    ],
    results: [
      { label: "Automated tests", value: "98 passed", context: "Against real PostgreSQL, locally and in GitHub Actions CI", source: "voice-ai-patient-registration/README.md, Testing" },
      { label: "Live phone calls", value: "7 calls, 5 registrations", context: "To the production number on 2026-10-10, exercising validation, corrections, and redirects", source: "voice-ai-patient-registration/README.md, Testing" },
    ],
    limitations: [
      "Not HIPAA-compliant: Vapi and OpenAI process audio and text without a BAA in this setup.",
      "A single shared admin key rather than per-user accounts.",
      "Hosted on free tiers, so the first request after a long idle period can be slow.",
    ],
    architecture: {
      nodes: [
        { id: "caller", label: "Caller", detail: "A patient phoning the clinic number.", stage: 0, kind: "input" },
        { id: "stt", label: "Deepgram STT", detail: "nova-3, multilingual, inside Vapi.", stage: 1, kind: "model" },
        { id: "llm", label: "GPT-4.1 agent", detail: "System prompt plus tool calls, hosted by Vapi.", stage: 2, kind: "model" },
        { id: "hook", label: "FastAPI webhook", detail: "Authenticated with a shared secret; dispatches tool calls.", stage: 3, kind: "logic" },
        { id: "fsm", label: "Registration state", detail: "Per-call draft, validation, read-back hash, confirm-before-save.", stage: 4, kind: "logic" },
        { id: "db", label: "PostgreSQL", detail: "Patients and call sessions, with CHECK constraints.", stage: 5, kind: "store" },
        { id: "staff", label: "Staff dashboard", detail: "Registrations and transcripts via the REST API.", stage: 6, kind: "human" },
      ],
      edges: [
        { from: "caller", to: "stt", label: "speech" },
        { from: "stt", to: "llm" },
        { from: "llm", to: "hook", label: "tools" },
        { from: "hook", to: "fsm" },
        { from: "fsm", to: "db", label: "save" },
        { from: "db", to: "staff" },
      ],
    },
  },
  {
    slug: "veriflow",
    title: "Veriflow",
    repo: "AgenticAIPlatform",
    tagline: "An agent platform that has to prove every claim it makes before a human signs off.",
    categories: ["Agentic AI", "RAG and Knowledge", "Full-Stack"],
    tech: ["FastAPI", "Pydantic v2", "SQLAlchemy 2", "PostgreSQL 16", "pgvector", "Redis", "Celery", "Next.js", "TypeScript", "OpenTelemetry", "Docker Compose"],
    tier: "case-study",
    cover: { src: "/projects/veriflow-dashboard.jpg", alt: "Veriflow dashboard: live counts of investigations, verified claims, and unsupported claims" },
    gallery: [
      { src: "/projects/veriflow-run.jpg", alt: "A completed churn investigation showing each workflow stage, its timing, and the verification breakdown", caption: "A completed run: every stage, its timing, and how many claims the evidence supported." },
      { src: "/projects/veriflow-report.jpg", alt: "Report section for one account listing verified indicators, a contradicted claim that was excluded, and recommended interventions", caption: "The report keeps only verified claims; a contradicted one is listed as excluded with the reason." },
    ],
    status: "Complete backend and frontend with a documented test suite; runs locally with Docker Compose. No public deployment.",
    overview:
      "Veriflow takes an investigation objective, such as finding which B2B SaaS customers are at risk of churning and why, and returns a report in which every claim is tied to evidence and checked before it is shown. Any customer-facing action it proposes waits for a human approval.",
    problem:
      "LLM agents are good at producing fluent conclusions and bad at telling you which of those conclusions are supported. In an account-management setting, an unsupported claim that reaches a customer is worse than no claim at all.",
    solution:
      "A planner turns the objective into a task graph. Specialised agents gather usage data, retrieve documents with customer-scoped pgvector search, and score risk. Every claim the investigator writes then goes through three verification stages: ID validation, lexical rules, and a model verdict that the rules can cap. Only supported claims reach the report, and the single write tool in the registry creates an approval record instead of acting directly.",
    features: [
      "Planner that compiles an objective into a dependency graph of tasks, executed by Celery workers.",
      "Seven agents: four LLM-backed (Planner, Investigator, Verifier, Reporter) and three deterministic (Data, Risk, Retrieval).",
      "Customer-scoped retrieval over pgvector with an HNSW cosine index.",
      "Three-stage claim verification with evidence links on every claim in the final report.",
      "Twelve-tool registry with permissions; the only write tool proposes an action for human approval.",
      "Evaluation CLI covering ranking quality, retrieval scope, and verification outcomes.",
      "Next.js operator console: runs, live task events, reports, customers, approvals, evaluation, and system health.",
    ],
    challenges: [
      "Keeping a model verdict from overriding hard evidence: the rule stages cap what the model is allowed to mark as supported.",
      "Making runs observable while they execute, which meant persisting task events rather than only final state.",
      "Running the full system without paid keys: a deterministic fake LLM provider and a local hashed embedder keep the pipeline testable end to end.",
    ],
    decisions: [
      "An OpenAI-compatible HTTP client instead of a vendor SDK, so any compatible endpoint can be swapped in.",
      "Deterministic agents wherever a model is not needed (data access, risk scoring, retrieval) to keep cost and variance down.",
      "Synthetic data from 12 customer personas generated from templates, so the dataset is reproducible and contains no real customer information.",
    ],
    results: [
      { label: "Risk ranking ROC-AUC", value: "0.841", context: "Synthetic 3,000-customer dataset", source: "AgenticAIPlatform/README.md, Evaluation results" },
      { label: "Precision at 25", value: "0.96", context: "Top 25 accounts by risk score", source: "AgenticAIPlatform/README.md" },
      { label: "Claims supported after verification", value: "81.8%", context: "5-account run, 33 claims; 0 rejected claims reached the report", source: "AgenticAIPlatform/README.md" },
      { label: "Cost of that run", value: "$0.0074", context: "8 LLM calls, 26,553 tokens", source: "AgenticAIPlatform/README.md" },
    ],
    limitations: [
      "Evaluated on synthetic data only.",
      "Single tenant, with development-level API-key auth.",
      "The default local embedder is a hashed bag-of-features vector, not a semantic model; semantic retrieval needs an embedding API key.",
    ],
    architecture: {
      nodes: [
        { id: "obj", label: "Objective", detail: "A natural-language investigation goal submitted through the console or API.", stage: 0, kind: "input" },
        { id: "plan", label: "Planner", detail: "LLM agent that compiles the objective into a task DAG.", stage: 1, kind: "model" },
        { id: "data", label: "Data agent", detail: "Deterministic access to customer records and usage.", stage: 2, kind: "logic" },
        { id: "ret", label: "Retrieval", detail: "Customer-scoped pgvector search with an HNSW cosine index.", stage: 2, kind: "store" },
        { id: "risk", label: "Risk agent", detail: "Weighted heuristic risk score.", stage: 2, kind: "logic" },
        { id: "inv", label: "Investigator", detail: "LLM agent that writes claims and cites evidence IDs.", stage: 3, kind: "model" },
        { id: "ver", label: "Verifier", detail: "ID validation, lexical rules, then a model verdict capped by the rules.", stage: 4, kind: "model" },
        { id: "rep", label: "Report", detail: "Only supported claims, each linked to its evidence.", stage: 5, kind: "output" },
        { id: "appr", label: "Human approval", detail: "Proposed customer actions wait here.", stage: 6, kind: "human" },
      ],
      edges: [
        { from: "obj", to: "plan" },
        { from: "plan", to: "data", label: "tasks" },
        { from: "plan", to: "ret" },
        { from: "plan", to: "risk" },
        { from: "data", to: "inv" },
        { from: "ret", to: "inv", label: "evidence" },
        { from: "risk", to: "inv" },
        { from: "inv", to: "ver", label: "claims" },
        { from: "ver", to: "rep", label: "supported" },
        { from: "rep", to: "appr", label: "actions" },
      ],
    },
  },
  {
    slug: "ediconnect",
    title: "EDIConnect",
    repoNote: "Team final-year project; the repository is private.",
    tagline: "Hybrid rule-based and LLM-assisted mapping for B2B EDI documents.",
    categories: ["Generative AI", "Data Engineering"],
    tech: ["Python", "LLaMA 3.1", "Sentence embeddings", "FAISS", "FastAPI", "Docker"],
    tier: "case-study",
    year: "2024 to 2025",
    status: "Completed as a final-year project at FAST-NUCES. Walkthrough video below.",
    video: { src: "/media/ediconnect-demo.mp4", poster: "/media/ediconnect-poster.jpg", label: "EDIConnect walkthrough, 2 minutes 35 seconds" },
    cover: { src: "/media/ediconnect-poster.jpg", alt: "EDIConnect mapping interface" },
    overview:
      "EDIConnect maps Electronic Data Interchange documents between standards such as Tradacoms, X12, and HL7, and toward ERP-ready structures. Standard cases go through deterministic rules; the hard ones get help from an LLM; every output is validated.",
    problem:
      "EDI mapping is still largely manual. Each trading partner and standard has its own segments, delimiters, and loops, and a mapping mistake silently corrupts orders and invoices downstream.",
    solution:
      "A hybrid pipeline: parse and normalise the input, apply rule-based mappings for well-understood segments, and use LLaMA 3.1 assistance for complex or ambiguous ones. Segment meanings are embedded and semantically matched to target fields, and automated syntax and consistency checks validate the result before export.",
    features: [
      "Parsing of segments, delimiters, and loops across Tradacoms, X12, and HL7.",
      "Rule-based mapping for standard cases, so common documents are deterministic.",
      "LLM-assisted mapping for complex cases.",
      "Embedding-based semantic matching of EDI elements to target schema fields.",
      "Automated syntax and consistency validation of generated output.",
    ],
    decisions: [
      "Rules first, model second: deterministic mappings where the standard is unambiguous keeps output auditable and cheap.",
      "Validation as a separate stage, so LLM suggestions never reach the output unchecked.",
    ],
    limitations: ["Built as a team project; code is in a private repository and not linked here."],
    architecture: {
      nodes: [
        { id: "in", label: "EDI or custom file", detail: "Tradacoms, X12, HL7, or flat files.", stage: 0, kind: "input" },
        { id: "parse", label: "Parser", detail: "Normalises segments, delimiters, and loops.", stage: 1, kind: "logic" },
        { id: "rules", label: "Rule mapper", detail: "Deterministic mapping for standard cases.", stage: 2, kind: "logic" },
        { id: "llm", label: "LLaMA 3.1 assist", detail: "Suggests mappings for complex cases.", stage: 2, kind: "model" },
        { id: "emb", label: "Semantic match", detail: "Embeds element meanings and matches them to target fields.", stage: 2, kind: "store" },
        { id: "val", label: "Validation", detail: "Syntax and consistency checks.", stage: 3, kind: "logic" },
        { id: "out", label: "Mapped output", detail: "Target EDI format or ERP-ready structure.", stage: 4, kind: "output" },
      ],
      edges: [
        { from: "in", to: "parse" },
        { from: "parse", to: "rules", label: "standard" },
        { from: "parse", to: "llm", label: "complex" },
        { from: "parse", to: "emb" },
        { from: "rules", to: "val" },
        { from: "llm", to: "val" },
        { from: "emb", to: "llm" },
        { from: "val", to: "out" },
      ],
    },
  },
  {
    slug: "netflix-qa",
    title: "Netflix Q&A Assistant",
    repo: "Netflix-QA-ChatBot",
    tagline: "A RAG chatbot that knows when to look something up exactly instead of searching for it.",
    categories: ["RAG and Knowledge", "Generative AI"],
    tech: ["LangChain", "Chroma", "Sentence Transformers (all-MiniLM-L6-v2)", "Groq", "Llama 3.1 8B", "Streamlit", "pandas"],
    tier: "case-study",
    status: "Complete Streamlit app. Runs locally with a free Groq API key.",
    overview:
      "A conversational assistant over the Netflix titles catalogue. Questions about directors are answered by an exact lookup over the dataset; everything else goes through retrieval-augmented generation with conversation memory.",
    problem:
      "Pure vector search is unreliable for exact attributes: a question like 'what did this director make' wants every matching row, not the four most similar chunks.",
    solution:
      "Route the question. Director questions hit a deterministic pandas lookup that returns complete answers. Open questions go to a ConversationalRetrievalChain over a Chroma index of MiniLM embeddings, answered by Llama 3.1 8B on Groq at temperature 0.",
    features: [
      "Hybrid routing between exact lookup and semantic retrieval.",
      "Local sentence-transformer embeddings (all-MiniLM-L6-v2), so no embedding API is needed.",
      "Conversation memory for follow-up questions.",
      "Retrieved source titles shown under each answer, with a badge for which route answered.",
    ],
    challenges: ["Exact-match routing must not be triggered by short titles that happen to appear inside an unrelated question."],
    decisions: ["Temperature 0 and k=4 retrieval to keep answers grounded in retrieved rows."],
    limitations: ["Needs a Groq API key (free tier) for generation.", "The Chroma index is rebuilt in memory on cold start."],
    architecture: {
      nodes: [
        { id: "q", label: "Question", detail: "Natural-language question with chat history.", stage: 0, kind: "input" },
        { id: "route", label: "Router", detail: "Detects director questions for exact lookup.", stage: 1, kind: "logic" },
        { id: "exact", label: "Exact lookup", detail: "pandas filter over the catalogue.", stage: 2, kind: "logic" },
        { id: "vec", label: "Chroma + MiniLM", detail: "Top-4 similar title documents.", stage: 2, kind: "store" },
        { id: "llm", label: "Llama 3.1 8B", detail: "Groq, temperature 0, with memory.", stage: 3, kind: "model" },
        { id: "ans", label: "Answer + sources", detail: "Grounded answer with the titles it used.", stage: 4, kind: "output" },
      ],
      edges: [
        { from: "q", to: "route" },
        { from: "route", to: "exact", label: "director" },
        { from: "route", to: "vec", label: "open" },
        { from: "vec", to: "llm", label: "context" },
        { from: "exact", to: "ans" },
        { from: "llm", to: "ans" },
      ],
    },
  },
  {
    slug: "english-urdu-translation",
    title: "English to Urdu Translation",
    repo: "English-to-Urdu-Machine-Translation-",
    tagline: "A Transformer trained from scratch on a 24,525-pair parallel corpus.",
    categories: ["NLP", "Generative AI"],
    tech: ["PyTorch", "nn.Transformer", "SentencePiece", "Hugging Face tokenizers", "sacreBLEU", "mBART-50"],
    tier: "case-study",
    status: "Training and evaluation notebook with recorded results. No hosted model.",
    overview:
      "An encoder-decoder Transformer built with PyTorch and trained from scratch to translate short conversational English sentences into Urdu, alongside tokenizer and back-translation experiments.",
    problem:
      "Urdu is right-to-left, morphologically rich, and low-resource compared with European languages, so off-the-shelf tokenization and small datasets both work against you.",
    solution:
      "Separate SentencePiece tokenizers for English and Urdu (3,000 tokens each), a 4-layer encoder and 4-layer decoder Transformer (d_model 512, 8 heads), gradient clipping, and greedy decoding. mBART-50 was used to generate back-translated data for augmentation.",
    features: [
      "Subword tokenization trained per language with SentencePiece, compared with HF BPE tokenizers.",
      "Transformer encoder-decoder trained from scratch.",
      "Back-translation of 100 lines with facebook/mbart-large-50-many-to-many-mmt.",
      "sacreBLEU evaluation on held-out sentences.",
    ],
    challenges: ["Fine-tuning mBART-50 itself ran out of GPU memory on Colab, so it was used for back-translation only."],
    results: [
      { label: "sacreBLEU", value: "20.41", context: "50 held-out test sentences", source: "MT_EngtoUrdu.ipynb, cell 9" },
      { label: "Training loss", value: "4.16 to 0.73", context: "Epoch 1 to epoch 10", source: "MT_EngtoUrdu.ipynb" },
    ],
    limitations: [
      "The BLEU score is on a small 50-sentence sample.",
      "The encoder was trained with a causal mask, which limits how much source context it uses; fixing this is the first planned improvement.",
    ],
    architecture: {
      nodes: [
        { id: "en", label: "English text", detail: "Short conversational sentence.", stage: 0, kind: "input" },
        { id: "spe", label: "SentencePiece EN", detail: "3,000-token subword vocabulary.", stage: 1, kind: "logic" },
        { id: "enc", label: "Encoder x4", detail: "d_model 512, 8 heads.", stage: 2, kind: "model" },
        { id: "dec", label: "Decoder x4", detail: "Autoregressive, greedy decoding.", stage: 3, kind: "model" },
        { id: "spu", label: "SentencePiece UR", detail: "Detokenize to Urdu script.", stage: 4, kind: "logic" },
        { id: "ur", label: "Urdu text", detail: "Right-to-left output.", stage: 5, kind: "output" },
      ],
      edges: [
        { from: "en", to: "spe" },
        { from: "spe", to: "enc" },
        { from: "enc", to: "dec", label: "memory" },
        { from: "dec", to: "spu" },
        { from: "spu", to: "ur" },
      ],
    },
  },
  {
    slug: "video-understanding-pipeline",
    title: "Video Understanding Pipeline",
    repo: "Advanced-Video-Processing-Pipeline",
    tagline: "Speech, frames, and a language model, run in parallel to summarise a video.",
    categories: ["Generative AI", "Computer Vision", "NLP"],
    tech: ["Whisper small", "ViT-GPT2 captioning", "Phi-3 mini 128k", "Hugging Face Transformers", "moviepy", "OpenCV", "Python threading"],
    tier: "case-study",
    status: "Working Colab prototype with recorded output.",
    overview:
      "A multimodal pipeline that turns a video into a written summary. Audio is transcribed with Whisper, frames are sampled once per second and captioned, and Phi-3 writes the summary from both streams.",
    problem: "Neither the transcript nor the frames tell the whole story on their own, and running three large models one after another is slow.",
    solution:
      "Split the work into three concurrent stages on threads: extract and transcribe audio in 30-second chunks, caption one frame per second, then prompt Phi-3 mini with the captions and transcript together.",
    features: [
      "Audio extraction and chunked transcription with openai/whisper-small.",
      "One-frame-per-second sampling and captioning with nlpconnect/vit-gpt2-image-captioning.",
      "Summary generation with microsoft/Phi-3-mini-128k-instruct.",
      "Parallel execution of the stages with Python threads.",
    ],
    results: [{ label: "Output", value: "Qualitative", context: "Recorded summary of a wildlife clip; no automatic metric", source: "code.ipynb, cell 10" }],
    limitations: ["Runs on a Colab GPU; the input path is fixed to /content/video.mp4.", "No quantitative evaluation of summary quality."],
    architecture: {
      nodes: [
        { id: "v", label: "Video", detail: "MP4 input.", stage: 0, kind: "input" },
        { id: "a", label: "Audio track", detail: "Extracted with moviepy.", stage: 1, kind: "logic" },
        { id: "f", label: "Frames @1 fps", detail: "Sampled with OpenCV.", stage: 1, kind: "logic" },
        { id: "w", label: "Whisper small", detail: "30 s chunks to transcript.", stage: 2, kind: "model" },
        { id: "c", label: "ViT-GPT2", detail: "One caption per frame.", stage: 2, kind: "model" },
        { id: "p", label: "Phi-3 mini", detail: "Summarises transcript and captions.", stage: 3, kind: "model" },
        { id: "s", label: "Summary", detail: "Written description of the video.", stage: 4, kind: "output" },
      ],
      edges: [
        { from: "v", to: "a" },
        { from: "v", to: "f" },
        { from: "a", to: "w" },
        { from: "f", to: "c" },
        { from: "w", to: "p", label: "transcript" },
        { from: "c", to: "p", label: "captions" },
        { from: "p", to: "s" },
      ],
    },
  },
  {
    slug: "cnn-vs-vit",
    title: "CNN vs Vision Transformer",
    repo: "Comparison-between-CNN-and-Vision-Transformer",
    tagline: "What transfer learning buys on CIFAR-10: 69% from scratch, 97% fine-tuned.",
    categories: ["Computer Vision", "Machine Learning"],
    tech: ["PyTorch", "torchvision", "timm", "ViT-Tiny", "scikit-learn"],
    tier: "case-study",
    status: "Notebook with recorded results and confusion matrices.",
    cover: { src: "/projects/cnn-vs-vit-matrix.png", alt: "Confusion matrix of the fine-tuned ViT on CIFAR-10" },
    overview:
      "A controlled comparison on CIFAR-10 between a small convolutional network trained from scratch and a pretrained ViT-Tiny fine-tuned at 224 pixels. A from-scratch ViT (patch 4, depth 6, 8 heads) is also implemented.",
    problem: "Vision Transformers lack the locality bias of convolutions and are data hungry; the question is how much pretraining changes that on a small dataset.",
    solution:
      "Train both models for 10 epochs with matched evaluation: a two-block CNN with BatchNorm and dropout, and timm's vit_tiny_patch16_224 fine-tuned with AdamW at 1e-4 and a step learning-rate schedule.",
    results: [
      { label: "SimpleCNN validation accuracy", value: "69.28%", context: "10 epochs, from scratch", source: "Vit_Vs_CNN(CIFAR_10).ipynb, cell 12" },
      { label: "ViT-Tiny validation accuracy", value: "97.33%", context: "10 epochs, ImageNet-pretrained, fine-tuned", source: "Vit_Vs_CNN(CIFAR_10).ipynb, cell 13" },
    ],
    limitations: ["The validation split is the CIFAR-10 test set, so there is no separate held-out test.", "The from-scratch ViT is implemented but its training run is not recorded."],
    architecture: {
      nodes: [
        { id: "img", label: "CIFAR-10 image", detail: "32 x 32 RGB.", stage: 0, kind: "input" },
        { id: "cnn", label: "SimpleCNN", detail: "2 conv blocks, BatchNorm, FC 256.", stage: 1, kind: "model" },
        { id: "up", label: "Resize 224", detail: "Upsampled for the pretrained ViT.", stage: 1, kind: "logic" },
        { id: "vit", label: "ViT-Tiny", detail: "Patch 16, pretrained, fine-tuned.", stage: 2, kind: "model" },
        { id: "eval", label: "Evaluation", detail: "Accuracy, classification report, confusion matrix.", stage: 3, kind: "output" },
      ],
      edges: [
        { from: "img", to: "cnn" },
        { from: "img", to: "up" },
        { from: "up", to: "vit" },
        { from: "cnn", to: "eval" },
        { from: "vit", to: "eval" },
      ],
    },
  },

  // ───────────────────────────── Cards with interactive demos ─────────────────────────────
  {
    slug: "lazy-snapping",
    title: "Lazy Snapping Segmentation",
    repo: "Lazy-Snapping-with-image-clustering",
    tagline: "Paint a few strokes and let colour clusters separate foreground from background.",
    categories: ["Computer Vision", "Machine Learning"],
    tech: ["NumPy", "scikit-learn KMeans", "Pillow", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook complete. The demo is a TypeScript reimplementation of the same algorithm.",
    demo: "lazy-snapping",
    demoNote: "Runs in your browser with the notebook's settings: 64 k-means clusters per side, the same exp(-0.1 x distance) likelihood, and the same foreground rule. Two fixes: seeds are the image colours under each stroke (the notebook clustered the stroke colours themselves, which are pure red and blue), and the uint8 overflow in the output step is gone.",
    cover: { src: "/demos/lazy-snapping/mona-lisa.png", alt: "The Mona Lisa, one of the three test images used for segmentation" },
    overview:
      "Seed-based foreground segmentation in the spirit of Lazy Snapping. Red strokes mark foreground and blue strokes mark background; each stroke set is clustered into 64 colours with k-means, and every pixel goes to whichever side's clusters explain its colour better.",
    features: ["K-means colour models (64 clusters) per seed set.", "Per-pixel likelihood as a sum of exp(-0.1 x distance) over centroids.", "Face recognition with a from-scratch KNN in the same assignment (see Face KNN)."],
    limitations: ["No graph-cut smoothing step, so boundaries are pixel-wise.", "In the notebook, seed colours were read from the stroke image rather than the photo, so its segmentation reduced to comparing each pixel with pure red and pure blue. The demo corrects this."],
  },
  {
    slug: "face-knn",
    title: "Face Recognition with KNN",
    repo: "FaceRecognition_KNN",
    tagline: "A from-scratch nearest-neighbour classifier on 32 x 32 faces, compared with SVM and Naive Bayes.",
    cover: { src: "/projects/face-knn-demo.jpg", alt: "Face KNN demo: a test face beside its seven nearest training faces and their distances" },
    categories: ["Computer Vision", "Machine Learning"],
    tech: ["NumPy", "scikit-learn", "PCA", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook with recorded results; the demo runs KNN on the repository's dataset in your browser.",
    demo: "face-knn",
    demoNote: "Loads the repository's 1,700-face dataset and runs the same KNN (k=7, Euclidean, L2-normalised rows) in your browser.",
    results: [
      { label: "KNN accuracy", value: "0.96", context: "200 test faces, k = 7", source: "i211697_Q2.ipynb, cell 2" },
      { label: "SVM accuracy", value: "1.00", context: "Same split", source: "i211697_Q2.ipynb, cell 2" },
      { label: "Gaussian NB accuracy", value: "0.85", context: "Same split", source: "i211697_Q2.ipynb, cell 2" },
    ],
    overview: "Identification of 10 subjects from 1,700 grayscale 32 x 32 face images using a hand-written KNN, benchmarked against scikit-learn SVM and Gaussian Naive Bayes, with a 3D PCA view of the data.",
  },
  {
    slug: "perceptron",
    title: "Rosenblatt's Perceptron",
    repo: "Rosenblatt-s-Perceptron-from-Scratch",
    tagline: "The original learning rule, implemented from scratch and animated.",
    categories: ["Machine Learning"],
    tech: ["NumPy", "Matplotlib", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook with recorded result; the demo runs the same update rule live.",
    demo: "perceptron",
    demoNote: "Same data recipe (labels from sign(x1 + x2)), step activation, and update rule. The points come from a seeded JavaScript generator rather than NumPy, so error counts per epoch differ from the notebook. Add your own points, or switch to XOR to watch it fail to converge.",
    results: [{ label: "Accuracy", value: "0.96", context: "500 synthetic points, 20 epochs", source: "Rosenblatt's Perceptron.ipynb, cell 3" }],
    cover: { src: "/projects/perceptron-boundary.png", alt: "Perceptron decision boundary over two classes" },
    overview: "A single-layer perceptron with a step activation and the classic update rule, trained on linearly separable synthetic data with per-epoch error tracking and a decision-boundary plot.",
  },
  {
    slug: "convolution",
    title: "Convolution from Scratch",
    repo: "Convolution-Neural-Network-Implementation-from-Scratch",
    tagline: "The operation behind CNNs, written by hand and compared with SciPy.",
    categories: ["Computer Vision"],
    tech: ["NumPy", "OpenCV", "SciPy", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook complete; the demo runs the same convolution and correlation in your browser.",
    demo: "convolution",
    demoNote: "Stride, valid or same padding, and convolution versus correlation, as in the notebook. The Sobel and Prewitt presets use the standard kernels.",
    cover: { src: "/projects/convolution.png", alt: "Convolution versus correlation with an asymmetric kernel" },
    overview: "A manual 2D convolution and correlation implementation with stride and padding options, applied with edge, blur, and sharpen kernels and checked against scipy.signal.convolve2d.",
  },
  {
    slug: "cryptarithmetic",
    title: "Cryptarithmetic Search",
    repo: "Cryptarithmetic-puzzle-solver",
    tagline: "SEND + MORE = MONEY, solved by search, with the frontier on screen.",
    cover: { src: "/projects/cryptarithmetic-demo.jpg", alt: "Cryptarithmetic demo: column-wise search assigning digits to SEND + MORE = MONEY" },
    categories: ["Machine Learning"],
    tech: ["Python", "A*", "DFS", "BFS", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook (inside a zip in the repository) with recorded solutions; the demo runs the searches step by step.",
    demo: "cryptarithm",
    demoNote: "Breadth-first, depth-first backtracking, and a column-wise constraint search, each counting nodes expanded. Leading zeros are rejected, which the original DFS did not enforce.",
    results: [{ label: "A* solution", value: "9567 + 1085 = 10652", context: "SEND + MORE = MONEY", source: "i211697_Laibakhawar_N.ipynb, cell 1" }],
    overview: "An AI-course assignment that treats a cryptarithmetic puzzle as a search problem over letter-to-digit assignments, comparing A*, depth-first backtracking, and breadth-first search.",
  },
  {
    slug: "bakery-lock",
    title: "Bakery Lock Simulator",
    repo: "bakery-lock-algorithm-threads",
    tagline: "Lamport's mutual exclusion algorithm, one memory operation at a time.",
    cover: { src: "/projects/bakery-lock-demo.jpg", alt: "Bakery lock simulator: three threads, their choosing flags and ticket numbers" },
    categories: ["Systems"],
    tech: ["C++", "pthreads", "std::atomic", "TypeScript (demo)"],
    tier: "card",
    status: "C++ implementation; the demo simulates the canonical algorithm with a step-level scheduler.",
    demo: "bakery",
    demoNote: "Each thread is a state machine that yields after every shared read or write, so you can watch tickets being taken and compared. Turn off the choosing flags to see mutual exclusion break.",
    overview: "Lamport's Bakery algorithm for N threads using pthreads and atomics. Threads take a ticket one larger than any they can see, then wait for every thread with a smaller (ticket, id) pair.",
    limitations: [
      "The C++ version deviates from the canonical algorithm: it re-takes tickets inside the wait loop, increments the ticket on unlock instead of clearing it, and uses relaxed memory ordering.",
      "Built and run, the original program prints the first thread entering the critical section and then hangs, a consequence of the unlock step. The simulator implements the canonical form instead.",
    ],
  },
  {
    slug: "bridge-sync",
    title: "Single-Lane Bridge",
    repo: "bridge-traffic-synchronization-threads",
    tagline: "Cars, buses, a mutex, and two condition variables.",
    cover: { src: "/projects/bridge-sync-demo.jpg", alt: "Bridge simulator: vehicles queued at a single-lane bridge with condition-variable waiters" },
    categories: ["Systems"],
    tech: ["C++", "pthreads", "Condition variables", "TypeScript (demo)"],
    tier: "card",
    status: "C++ implementation; the demo simulates the same rules.",
    demo: "bridge",
    demoNote: "Up to two cars at a time, or one bus alone. Toggle the original wake-up logic to reproduce its lost-wake-up stall, then switch to the fixed version.",
    overview: "A pthreads simulation of a single-lane bridge where cars and buses are threads. At most two cars may cross together, a bus crosses alone, and the two never share the bridge.",
    limitations: ["On exit, a bus signals only the bus condition variable and a car broadcasts only to cars, so a bus waiting behind cars is never woken. The direction input is read but never used."],
  },
  {
    slug: "btc-forecasting",
    title: "Bitcoin Price Forecasting",
    repo: "Time-Series-Analysis",
    tagline: "Regression baselines, stationarity tests, and walk-forward evaluation on daily BTC prices.",
    cover: { src: "/projects/btc-forecasting-demo.jpg", alt: "Bitcoin forecasting demo: daily closing price with a chronological train and test split" },
    categories: ["Machine Learning"],
    tech: ["pandas", "scikit-learn", "statsmodels", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook with recorded results; the demo re-runs the models on the repository's dataset.",
    demo: "btc-forecast",
    demoNote: "Uses the repository's BTC-Daily.csv (2,651 days). Unlike the notebook's random split, the demo evaluates chronologically, which is the correct protocol for time series.",
    results: [
      { label: "Linear regression RMSE", value: "10,160.62", context: "Random 80/20 split", source: "i2112697_A4.ipynb, cell 7" },
      { label: "Polynomial (deg 2) RMSE", value: "7,444.31", context: "Random 80/20 split", source: "i2112697_A4.ipynb, cell 10" },
      { label: "ADF p-value, first difference", value: "1.05e-13", context: "Close price p = 0.32 (non-stationary)", source: "i2112697_A4.ipynb, cell 12" },
    ],
    overview: "Forecasting daily Bitcoin closing prices with linear and polynomial regression on time, Augmented Dickey-Fuller stationarity tests, ACF and PACF analysis, and rolling-window evaluation.",
  },
  {
    slug: "urdu-segmentation",
    title: "Urdu Sentence Segmentation",
    repo: "Urdu-Segmentation-and-Tokenization",
    tagline: "Rule-based sentence boundaries for Urdu, where punctuation alone is not enough.",
    cover: { src: "/projects/urdu-segmentation-demo.jpg", alt: "Urdu segmentation demo: an Urdu passage split into sentences with boundary triggers" },
    categories: ["NLP"],
    tech: ["Python", "regex", "urduhack", "SentencePiece", "TypeScript (demo)"],
    tier: "card",
    status: "Notebook complete; the demo runs the same rules on any Urdu text you paste.",
    demo: "urdu-segmenter",
    demoNote: "The rule set from the notebook: sentence-final punctuation plus Urdu verb and auxiliary endings, with conjunctions as guards.",
    results: [
      { label: "Sentence similarity, passage 3", value: "75.38%", context: "Cosine-similarity proxy, as recorded; not boundary F1", source: "i21_1697.ipynb, cell 26" },
      { label: "Passages 1 and 2", value: "66.37% / 67.96%", context: "Same metric, reproduced from the notebook code on its other two passages", source: "Reproduced from i21_1697.ipynb cells 19, 22, 25, 26" },
    ],
    overview: "A custom Urdu sentence tokenizer that combines punctuation with lists of sentence-final verbs and auxiliaries and guards on conjunctions, compared with Urduhack, plus SentencePiece subword training on an 11.5 MB Urdu corpus.",
  },

  // ───────────────────────────── Cards with recorded results ─────────────────────────────
  {
    slug: "grocery-detection",
    title: "Grocery Detection and Billing",
    repo: "YOLO-ObjectDetection",
    tagline: "Open-vocabulary detection turns a photo of produce into a bill.",
    categories: ["Computer Vision"],
    tech: ["YOLO-World L", "Roboflow inference", "supervision", "OpenCV", "Flask"],
    tier: "card",
    status: "Detection notebook with recorded output. The Flask front end depends on a hosted model endpoint that is no longer available.",
    cover: { src: "/projects/grocery-detection.png", alt: "Detected tomatoes and potatoes with bounding boxes" },
    results: [{ label: "Recorded run", value: "4 classes, bill 46.0", context: "Tomato, Potato, Cucumber, Green capsicum", source: "AI_project (1).ipynb, cells 10 and 11" }],
    overview: "Zero-shot detection with YOLO-World: set the class list to the menu items, detect them in a photo, and sum their prices into a bill.",
  },
  {
    slug: "cifar10-cnn",
    title: "CNN for CIFAR-10",
    repo: "CNN_for_CIFAR10",
    tagline: "A compact Keras CNN, augmentation, and a learning-rate ablation.",
    categories: ["Computer Vision", "Machine Learning"],
    tech: ["TensorFlow", "Keras", "scikit-learn"],
    tier: "card",
    status: "Notebook with recorded results.",
    cover: { src: "/projects/cifar10-curves.png", alt: "Training and validation curves for the CIFAR-10 CNN" },
    results: [
      { label: "Test accuracy", value: "0.741", context: "Baseline, 10 epochs", source: "CNN_for_CIFAR10.ipynb, cell 4" },
      { label: "With augmentation", value: "0.742", context: "Rotation, shift, flip, zoom", source: "CNN_for_CIFAR10.ipynb, cell 10" },
      { label: "Learning rate 0.01 / 0.1", value: "0.425 / 0.101", context: "Same model; higher rates diverge", source: "CNN_for_CIFAR10.ipynb, cell 15" },
    ],
    overview: "Three convolution blocks (32, 64, 128 filters) with max pooling, a dense layer, and dropout, plus experiments on augmentation and learning rate.",
  },
  {
    slug: "hyperparameter-search",
    title: "Hyperparameter Search for CNN and RNN",
    repo: "Hyperparameter-Search-for-CNN-and-RNN",
    tagline: "Random search over nine hyperparameters for an MNIST CNN and an IMDB BiLSTM.",
    categories: ["Machine Learning", "NLP"],
    tech: ["TensorFlow", "Keras", "scikit-learn ParameterSampler"],
    tier: "card",
    status: "Script-style notebook with recorded results.",
    results: [
      { label: "CNN test accuracy", value: "0.9904", context: "MNIST, best sampled configuration", source: "Hyperparametersearch_CNN_RNN.ipynb, cell 1" },
      { label: "BiLSTM test accuracy", value: "0.8470", context: "IMDB sentiment, best sampled configuration", source: "Hyperparametersearch_CNN_RNN.ipynb, cell 1" },
    ],
    overview: "Random search over learning rate, depth, width, batch size, optimizer, activation, dropout, kernel size, and initialisation, with the best configuration retrained for 10 epochs.",
  },
  {
    slug: "sp500-forecasting-app",
    title: "S&P 500 Forecasting App",
    repo: "Time-series-models---web-application",
    tagline: "Eight forecasting models behind one Streamlit interface.",
    categories: ["Machine Learning", "Full-Stack"],
    tech: ["Streamlit", "statsmodels", "Prophet", "pmdarima", "TensorFlow", "Plotly"],
    tier: "card",
    status: "Streamlit app and experiment notebook. Requires a user-supplied price CSV.",
    results: [{ label: "Rolling ARIMA(3,1,3) test MSE", value: "2,195.88", context: "S&P 500 closes, split at 2019", source: "maincode.ipynb, cell 70" }],
    overview: "Upload a price series and explore SMA, EMA, RSI, MACD, decomposition, and stationarity tests, then compare ARIMA, SARIMAX, ETS, Prophet, SVR, hybrid ARIMA-ANN, ANN, and LSTM forecasts.",
    limitations: ["Some neural baselines in the notebook use test data during training or prediction, so their errors are optimistic."],
  },
  {
    slug: "data-warehouse",
    title: "Electronica Data Warehouse",
    repo: "Analysis-of-Data-Warehouse",
    tagline: "A HYBRIDJOIN stream-relation join loading a star schema, then OLAP in SQL.",
    categories: ["Data Engineering"],
    tech: ["Java", "Maven", "MySQL", "SQL"],
    tier: "card",
    status: "ETL and query code; the source CSVs are not in the repository.",
    overview: "Streams transactions through a HYBRIDJOIN-style join against master data, loads product, date, and customer dimensions plus a sales fact table, and runs drill-down, slicing, pivot, z-score anomaly, and view-based queries.",
  },
  {
    slug: "amazon-data-integration",
    title: "Amazon Product Data Integration",
    repo: "Scraped-Amazon-Data-Integration-into-DB-and-Analysis",
    tagline: "From nested scraped JSON to a normalised SQLite database.",
    categories: ["Data Engineering", "NLP"],
    tech: ["pandas", "NLTK", "SQLite", "requests"],
    tier: "card",
    status: "Pipeline notebook with recorded outputs; raw scraped data is not in the repository.",
    results: [
      { label: "Reviews loaded", value: "87,398", context: "Exploded from nested review fields", source: "AmazonData.ipynb, cell 28" },
      { label: "Image rows loaded", value: "1,666", context: "Product images table", source: "AmazonData.ipynb, cell 27" },
    ],
    overview: "Cleans product, colour, price, and review fields, lemmatises text with NLTK, downloads product images, and loads Product, Images, and Review tables into SQLite.",
  },
  {
    slug: "common-voice-urdu-eda",
    title: "Common Voice Urdu EDA",
    repo: "EDA--Common-Voice-Data-Urdu-",
    tagline: "What is actually inside an Urdu speech dataset.",
    categories: ["NLP", "Data Engineering"],
    tech: ["pandas", "librosa", "pydub", "seaborn", "PCA"],
    tier: "card",
    status: "Exploratory notebook with recorded statistics.",
    results: [
      { label: "Validated clips", value: "52,144", context: "Plus 6,839 unvalidated", source: "i211697_laibakhwar_A2.ipynb" },
      { label: "Mean clip length", value: "4,246 ms", context: "Across 196,558 clip durations", source: "i211697_laibakhwar_A2.ipynb" },
    ],
    overview: "Metadata cleaning, demographic coverage, clip-duration statistics, and audio features (MFCC, chroma, spectral contrast, tonnetz) for Mozilla Common Voice Urdu.",
  },
  {
    slug: "audio-lsh",
    title: "Audio Similarity with LSH",
    repo: "Locality-Sensitive-Hashing-on-audio-data",
    tagline: "MFCC fingerprints and MinHash banding to find similar tracks.",
    categories: ["Machine Learning", "Data Engineering"],
    tech: ["librosa", "NumPy", "pandas", "MinHash LSH"],
    tier: "card",
    status: "Notebook; outputs are partial.",
    overview: "Extracts MFCC features from a music corpus, builds MinHash signatures with 8 permutations in 4 bands, and retrieves tracks that share buckets with a query clip.",
  },
  {
    slug: "instagram-kpis",
    title: "Instagram Engagement KPIs",
    repo: "Instagram_Visualisation",
    tagline: "Normalised engagement metrics and median baselines for fairer content comparison.",
    categories: ["Data Engineering"],
    tech: ["pandas", "NumPy", "Tableau"],
    tier: "card",
    status: "Dataset and Tableau workbook in the repository.",
    overview: "A KPI pipeline over a 29,999-post Instagram analytics dataset that compares posts against median baselines by media type and traffic source, feeding a Tableau workbook.",
  },

  // ───────────────────────────── Archive ─────────────────────────────
  { slug: "urdu-asr", title: "Urdu Speech-to-Text Prototype", repo: "-Speech2Text-model-for-Urdu-based-on-the-Conformer-architecture-with-MoE", tagline: "A convolution plus mixture-of-experts acoustic model prototype and a Whisper baseline for Urdu.", categories: ["NLP"], tech: ["PyTorch", "torchaudio", "CTC", "Whisper"], tier: "archive", status: "Early prototype; no word error rate recorded." },
  { slug: "vanilla-rnn", title: "Vanilla RNN Language Model", repo: "VanillaRNN", tagline: "Next-word prediction on Tiny Shakespeare with random versus Word2Vec embeddings.", categories: ["NLP"], tech: ["PyTorch", "gensim"], tier: "archive", status: "Code without saved outputs." },
  { slug: "meme-sentiment", title: "Meme Sentiment Classification", repo: "MemeSentiment-Classification", tagline: "Five-class sentiment from meme text with TF-IDF classifiers.", categories: ["NLP", "Machine Learning"], tech: ["scikit-learn", "NLTK"], tier: "archive", status: "Coursework." },
  { slug: "twitter-hate-speech", title: "Tweet Hate-Speech Detection", repo: "TWITTER-SENTIMENT-ANALYSIS", tagline: "Bag-of-words classifiers with requirements and design documents.", categories: ["NLP"], tech: ["scikit-learn", "NLTK", "XGBoost"], tier: "archive", status: "Software design coursework built around a public notebook." },
  { slug: "nltk-preprocessing", title: "Text Preprocessing with NLTK", repo: "Text-Preprocessing-using-NLTK", tagline: "Cleaning, stemming, lemmatisation, n-grams, and WordPiece on news text.", categories: ["NLP"], tech: ["NLTK", "Transformers"], tier: "archive", status: "Lab notebook." },
  { slug: "audio-features", title: "Audio Feature Extraction", repo: "Feature-Extraction-of-Audio-Files", tagline: "MFCC extraction for the audio LSH project.", categories: ["Machine Learning"], tech: ["librosa"], tier: "archive", status: "Companion to Audio Similarity with LSH." },
  { slug: "image-kmeans", title: "Image Segmentation with K-Means", repo: "Image-processing-KNN", tagline: "Stroke-seeded colour clustering (the Lazy Snapping Q1 notebook).", categories: ["Computer Vision"], tech: ["scikit-learn"], tier: "archive", status: "Same notebook as Lazy Snapping Segmentation." },
  { slug: "svm-scratch", title: "Linear SVM from Scratch", repo: "Image-Classification-using-SVM", tagline: "Hinge-loss SGD on raw pixels for cats versus dogs.", categories: ["Machine Learning"], tech: ["NumPy", "scikit-image"], tier: "archive", status: "Coursework." },
  { slug: "knn-diabetes", title: "KNN from Scratch", repo: "KNN", tagline: "Diabetes prediction with a hand-written KNN.", categories: ["Machine Learning"], tech: ["NumPy", "pandas"], tier: "archive", status: "Coursework." },
  { slug: "titanic-preprocessing", title: "Titanic Feature Engineering", repo: "KMeans-Clustering", tagline: "Imputation, encoding, and derived features on the Titanic dataset.", categories: ["Machine Learning"], tech: ["pandas", "scikit-learn"], tier: "archive", status: "Lab notebook." },
  { slug: "pm-database", title: "Project Management Database", repo: "Comprehensive-Project-Management-System-Database", tagline: "A Jira-like relational schema with a role-based Express front end.", categories: ["Data Engineering", "Full-Stack"], tech: ["MySQL", "Express", "EJS"], tier: "archive", status: "Coursework." },
  { slug: "kafka-producer-consumer", title: "Kafka Producer and Consumer", repo: "Producer-Consumer-Using-Kafka", tagline: "Simulated sales events streamed through a Kafka topic.", categories: ["Data Engineering"], tech: ["Kafka", "kafka-python"], tier: "archive", status: "Coursework." },
  { slug: "todo-api", title: "To-Do API", repo: "To-do-list-web-app-backend", tagline: "Express and MongoDB REST API with JWT auth and calendar sync.", categories: ["Full-Stack"], tech: ["Express", "MongoDB", "JWT", "Socket.io"], tier: "archive", status: "Source only; not currently deployed." },
  { slug: "todo-frontend", title: "To-Do Frontend", repo: "To-do-list-frontend", tagline: "React and MUI client for the To-Do API.", categories: ["Full-Stack"], tech: ["React", "Vite", "MUI"], tier: "archive", status: "Source only." },
  { slug: "outfit-planner", title: "Outfit Planner", repo: "Outfit-planner-web-application", tagline: "Weather-aware outfit suggestions.", categories: ["Full-Stack"], tech: ["React", "Express", "MongoDB", "OpenWeatherMap"], tier: "archive", status: "Incomplete prototype." },
  { slug: "image-rlc", title: "Image Processing and RLE in C++", repo: "-Image-Processing-RLC", tagline: "PGM statistics, negatives, and run-length coding with hand-built data structures.", categories: ["Systems"], tech: ["C++"], tier: "archive", status: "Coursework." },
  { slug: "parallel-nn", title: "Process-Parallel Network Training", repo: "-Parallel-Neural-Network-Training", tagline: "Layers as processes, neurons as threads, pipes between them.", categories: ["Systems"], tech: ["C++", "pthreads", "fork", "pipes"], tier: "archive", status: "Operating systems coursework." },
  { slug: "multiplayer-grid", title: "Threaded Grid Game", repo: "Multiplayer-game", tagline: "Two players on pthreads, coordinated through a message queue.", categories: ["Systems"], tech: ["C++", "pthreads"], tier: "archive", status: "Operating systems coursework." },
];

export const caseStudies = projects.filter((p) => p.tier === "case-study");
export const cards = projects.filter((p) => p.tier === "card");
export const archive = projects.filter((p) => p.tier === "archive");
export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
export const allCategories: Category[] = Array.from(new Set(projects.flatMap((p) => p.categories)));

// Additional resume projects whose code is not public. Shown without links.
export const resumeProjects = [
  {
    title: "Conversational RAG and Research Paper Agent",
    tech: ["FAISS", "Embeddings", "Reranking", "Tool calling"],
    text: "Document question answering with FAISS, embeddings, reranking, query rewriting, conversation memory, PDF parsing, summarization, and tool calling.",
  },
];
