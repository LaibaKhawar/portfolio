import { z } from "zod";
import { contactSchema } from "@/lib/contact";
import { profile } from "@/content/profile";

// Best-effort, per-instance rate limit: 5 messages per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return Response.json({ ok: false, error: "Too many messages. Please try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const { name, email, message, company } = parsed.data;
  if (company) return Response.json({ ok: true }); // honeypot tripped: accept silently, send nothing

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No delivery service configured: tell the client so it can fall back to the visitor's email app.
    return Response.json({ ok: false, configured: false }, { status: 503 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM ?? "Portfolio <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO ?? profile.email],
      reply_to: email,
      subject: `Portfolio message from ${name}`,
      html: `<p><strong>${escape(name)}</strong> (${escape(email)}) wrote:</p><p>${escape(message).replace(/\n/g, "<br>")}</p>`,
    }),
  });
  if (!res.ok) return Response.json({ ok: false, error: "The message could not be delivered. Please email directly." }, { status: 502 });
  return Response.json({ ok: true });
}
