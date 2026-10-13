// Every fact in this file comes from Laiba_Khawar_Resume.pdf (public/Laiba_Khawar_Resume.pdf).
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
    "AI Engineer building and deploying production LLM and NLP systems, including retrieval-augmented generation, automated model evaluation, graph-based memory, and semantic search. I take models from integration and fine-tuning through to scalable Python services, data pipelines, and cloud deployment.",
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
      "Building and optimizing PVS-LLM, a production AI/NLP platform that converts unstructured veterinary and public-health reports into structured, validated insights.",
    points: [
      "Production LLM pipelines for summarization, question answering, concept extraction, semantic mapping, and learning-needs analysis.",
      "Automated model-evaluation and QA frameworks combining semantic similarity, NLI, BERT-based metrics, and LLM-as-a-judge scoring.",
      "Throughput work through batching, parallelism, model preloading, and resumable checkpointed workflows.",
      "Multilingual FastAPI and Streamlit applications for conversational AI, evaluation, reporting, and human review.",
    ],
    stack: ["Mistral", "Ollama", "Azure AI", "Sentence Transformers", "FastAPI", "Streamlit", "PostgreSQL", "SQL Server", "Docker"],
  },
  {
    company: "Dataspecc",
    title: "AI Backend Engineer",
    start: "Jan 2025",
    end: "Jan 2026",
    location: "Islamabad, Pakistan",
    summary:
      "Built Hyperengage's Customer Memory Graph, an AI infrastructure layer modelling accounts, contacts, commitments, risks, deals, and time-bounded customer relationships.",
    points: [
      "Hybrid retrieval combining pgvector semantic search with graph traversal.",
      "LLM-powered services that generated and maintained contextual memory summaries for customer accounts.",
      "Data pipelines integrating HubSpot, Salesforce, Segment, Intercom, and Zendesk into a unified graph model.",
      "Backend functionality for the Signals Engine and Copilot Q&A: real-time pattern detection and natural-language querying.",
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
      "Contributed to development, testing, and deployment of ML solutions across data collection, cleaning, preprocessing, exploratory analysis, model development, and evaluation.",
    points: [
      "Used Python, Pandas, NumPy, Scikit-learn, and Matplotlib to surface patterns and data-quality issues, and reported results through visualizations.",
    ],
    stack: ["Python", "Pandas", "NumPy", "Scikit-learn", "Matplotlib", "Git"],
  },
];

export type SkillGroup = { name: string; blurb: string; items: string[] };

export const skillGroups: SkillGroup[] = [
  {
    name: "LLM systems",
    blurb: "Pipelines, evaluation, and the parts that make model output dependable.",
    items: ["LLM pipelines", "Fine-tuning", "Summarization", "Concept extraction", "NLI", "LLM-as-a-judge", "Multilingual NLP"],
  },
  {
    name: "Retrieval and memory",
    blurb: "Getting the right context to the model, from vectors and from graphs.",
    items: ["RAG", "Semantic search", "Embeddings", "FAISS", "pgvector", "Neo4j", "Memgraph"],
  },
  {
    name: "Models and frameworks",
    blurb: "The modelling toolkit used across work and projects.",
    items: ["LangChain", "Hugging Face", "PyTorch", "Sentence Transformers", "Ollama", "Mistral", "LLaMA", "Scikit-learn"],
  },
  {
    name: "Backend and data",
    blurb: "Services and pipelines that carry models into production.",
    items: ["Python", "FastAPI", "Flask", "REST APIs", "Streamlit", "ETL pipelines", "Pandas", "NumPy", "Spark"],
  },
  {
    name: "Databases",
    blurb: "Relational, document, vector, and graph stores.",
    items: ["PostgreSQL", "SQL Server", "MySQL", "MongoDB", "pgvector", "Neo4j", "Memgraph"],
  },
  {
    name: "Cloud and delivery",
    blurb: "Where the services run.",
    items: ["Azure AI", "AWS EC2", "AWS S3", "AWS Lambda", "AWS Glue", "AWS Redshift", "API Gateway", "Docker", "Git"],
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
