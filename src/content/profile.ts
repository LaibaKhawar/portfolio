// Every fact in this file comes from the resume at public/Laiba_Khawar_Resume.pdf (updated ATS CV, October 2026).
// When the resume changes, update this file and replace the PDF; nothing else needs to change.

export const profile = {
  name: "Laiba Khawar",
  role: "AI Engineer",
  focus: ["Generative AI", "LLM Systems", "RAG", "Agentic AI"],
  location: "Islamabad, Pakistan",
  email: "laibakhawar7@gmail.com",
  linkedin: "https://www.linkedin.com/in/laibakhawar/",
  github: "https://github.com/LaibaKhawar",
  resume: "/Laiba_Khawar_Resume.pdf",
  summary:
    "AI Engineer building LLM applications, autonomous agents, graph-based retrieval, and scalable Python services. I deliver evidence-backed outputs and reliable workflows with FastAPI, PostgreSQL, and Docker, with experience in model evaluation, data pipelines, source-code auditing, and technical handover.",
} as const;

export type Role = {
  company: string;
  title: string;
  start: string;
  end: string;
  location: string;
  summary: string;
  points: string[];
  stack: string[];
};

export const experience: Role[] = [
  {
    company: "SysReforms International",
    title: "AI Engineer",
    start: "Feb 2026",
    end: "Present",
    location: "Islamabad, Pakistan",
    summary:
      "Developing PVS-LLM pipelines for summarization, question answering, concept extraction, and semantic mapping, and the multilingual applications and evaluation around them.",
    points: [
      "Build multilingual FastAPI and Streamlit applications using Mistral, Azure AI, PostgreSQL, and Docker.",
      "Build evaluation combining semantic similarity, NLI, BERT-based metrics, and LLM-as-a-judge, and speed up execution through batching, parallel processing, and resumable workflows.",
      "Completed 719 V9 review requirements and 65 V12 corrections across 4 system areas, with source-traceable documentation and audit registers.",
      "Reviewed 392 PDF pages and audited database operations and security risks.",
    ],
    stack: ["Mistral", "Azure AI", "FastAPI", "Streamlit", "PostgreSQL", "Docker", "Sentence Transformers", "NLI"],
  },
  {
    company: "Dataspecc",
    title: "AI Backend Engineer",
    start: "Jan 2025",
    end: "Jan 2026",
    location: "Islamabad, Pakistan",
    summary:
      "Built Hyperengage's Customer Memory Graph with Neo4j and Memgraph, modelling accounts, contacts, commitments, risks, deals, and time-bounded relationships.",
    points: [
      "Combined pgvector retrieval with graph traversal and LLM-generated account memory.",
      "Integrated HubSpot, Salesforce, Segment, Intercom, and Zendesk data into the graph.",
      "Contributed to the Signals Engine and Copilot Q&A.",
    ],
    stack: ["Neo4j", "Memgraph", "pgvector", "PostgreSQL", "Python", "LLMs"],
  },
  {
    company: "FAST-NUCES",
    title: "Teaching Assistant, NLP and Database Systems",
    start: "Feb 2025",
    end: "Jun 2025",
    location: "Islamabad, Pakistan",
    summary: "Supported lectures, lab sessions, and assessment for undergraduate NLP and Database Systems courses.",
    points: [],
    stack: ["NLP", "SQL", "Database Systems"],
  },
  {
    company: "Devsort",
    title: "Machine Learning Intern",
    start: "Jun 2024",
    end: "Aug 2024",
    location: "Islamabad, Pakistan",
    summary:
      "Supported data collection, preprocessing, exploratory analysis, model development, and testing.",
    points: [
    ],
    stack: ["Python", "Pandas", "NumPy", "Scikit-learn", "Matplotlib", "Git"],
  },
];

export type SkillGroup = { name: string; blurb: string; items: string[] };

export const skillGroups: SkillGroup[] = [
  {
    name: "LLM systems and agents",
    blurb: "Agents, pipelines, and evaluation that make model output dependable.",
    items: ["LLM agents", "RAG", "Fine-tuning", "Summarization", "NLI", "LLM-as-a-judge", "Multilingual NLP", "Vapi"],
  },
  {
    name: "Retrieval and memory",
    blurb: "Getting the right context to the model, from vectors and from graphs.",
    items: ["Embeddings", "Semantic search", "FAISS", "pgvector", "Neo4j", "Memgraph"],
  },
  {
    name: "Models and frameworks",
    blurb: "The modelling toolkit used across work and projects.",
    items: ["LangChain", "Hugging Face", "PyTorch", "Sentence Transformers", "Ollama", "Scikit-learn"],
  },
  {
    name: "Backend and data",
    blurb: "Services and pipelines that carry models into production.",
    items: ["Python", "FastAPI", "Flask", "Pydantic", "REST APIs", "Celery", "Redis", "SQL", "Pandas", "NumPy", "ETL", "Spark"],
  },
  {
    name: "Databases",
    blurb: "Relational, document, vector, and graph stores.",
    items: ["PostgreSQL", "SQL Server", "MySQL", "MongoDB", "pgvector", "Neo4j", "Memgraph"],
  },
  {
    name: "Cloud, frontend, and delivery",
    blurb: "Where the services run, the interfaces on top, and the handover.",
    items: ["Azure AI", "AWS", "Docker", "Git", "Next.js", "React", "TypeScript", "Streamlit", "Source-code review", "Technical documentation"],
  },
];

export const education = [
  {
    title: "BS Data Science",
    place: "FAST-NUCES, Islamabad",
    period: "2021 to 2025",
    note: "Dean's List: Spring 2023, Fall 2024",
  },
  {
    title: "A Levels (Engineering)",
    place: "Beaconhouse Margalla Campus, Islamabad",
    period: "",
    note: "",
  },
];

export const certifications = [
  { name: "LangChain: Chat with Your Data", issuer: "" },
  { name: "AWS Web Application Builder", issuer: "AWS" },
  { name: "AWS Data Pipeline Builder", issuer: "AWS" },
  { name: "Understanding Data Visualization", issuer: "DataCamp" },
  { name: "Intro to Data Science in Python", issuer: "DataCamp" },
];
