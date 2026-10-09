"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { contactSchema } from "@/lib/contact";
import { profile } from "@/content/profile";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui/primitives";

type Errors = Partial<Record<"name" | "email" | "message", string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "fallback"; href: string } | { kind: "error"; message: string };

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const parsed = contactSchema.safeParse(data);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Errors;
        if (k && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      const first = form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`);
      first?.focus();
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus({ kind: "sent" });
        form.reset();
      } else if (res.status === 503 && json.configured === false) {
        const href = `mailto:${profile.email}?subject=${encodeURIComponent(`Hello from ${parsed.data.name}`)}&body=${encodeURIComponent(`${parsed.data.message}\n\n${parsed.data.name} (${parsed.data.email})`)}`;
        setStatus({ kind: "fallback", href });
        window.location.href = href;
      } else if (res.status === 422 && json.fieldErrors) {
        const fe = json.fieldErrors as Record<string, string[]>;
        setErrors({ name: fe.name?.[0], email: fe.email?.[0], message: fe.message?.[0] });
        setStatus({ kind: "idle" });
      } else {
        setStatus({ kind: "error", message: json.error ?? "Something went wrong. Please email directly." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error. Please check your connection or email directly." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-card border border-line bg-bg-raised p-6">
        <CheckCircle size={22} className="mt-0.5 text-ok" aria-hidden />
        <div>
          <p className="text-fg">Message sent. Thank you.</p>
          <p className="mt-1 text-sm text-fg-muted">I will reply to the address you gave.</p>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 rounded-card border border-line bg-bg-raised p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name">
          <input id="c-name" name="name" autoComplete="name" className={inputClass} aria-invalid={!!errors.name} aria-describedby={errors.name ? "c-name-err" : undefined} />
          {errors.name ? <span id="c-name-err" className="text-xs text-danger">{errors.name}</span> : null}
        </Field>
        <Field label="Email" htmlFor="c-email">
          <input id="c-email" name="email" type="email" autoComplete="email" className={inputClass} aria-invalid={!!errors.email} aria-describedby={errors.email ? "c-email-err" : undefined} />
          {errors.email ? <span id="c-email-err" className="text-xs text-danger">{errors.email}</span> : null}
        </Field>
      </div>
      <Field label="Message" htmlFor="c-message">
        <textarea id="c-message" name="message" rows={5} className={inputClass} aria-invalid={!!errors.message} aria-describedby={errors.message ? "c-message-err" : undefined} />
        {errors.message ? <span id="c-message-err" className="text-xs text-danger">{errors.message}</span> : null}
      </Field>
      <div aria-hidden className="absolute left-[-9999px]">
        <label htmlFor="c-company">Company</label>
        <input id="c-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      {status.kind === "error" ? <ErrorNote>{status.message}</ErrorNote> : null}
      {status.kind === "fallback" ? (
        <p role="status" className="text-sm text-fg-muted">
          Direct sending is not set up on this site, so your email app should have opened with the message filled in.{" "}
          <a className="text-accent underline underline-offset-4" href={status.href}>
            Open it again
          </a>
          .
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-faint">
          Or email <a className="text-fg-muted underline underline-offset-4 hover:text-fg" href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
        <Button type="submit" variant="primary" disabled={status.kind === "sending"}>
          <PaperPlaneTilt size={16} aria-hidden /> {status.kind === "sending" ? "Sending" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
