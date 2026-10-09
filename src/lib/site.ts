// Canonical site URL. Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the
// production URL is provided automatically.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const siteTitle = "Laiba Khawar, AI Engineer";
export const siteDescription =
  "AI engineer building production LLM systems: retrieval-augmented generation, graph-based memory, agentic workflows, and automated evaluation.";
