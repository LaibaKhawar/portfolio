import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "ghost" | "quiet";

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent px-5 py-2.5 text-accent-ink hover:bg-accent-hover",
  ghost: "border border-line-strong px-5 py-2.5 text-fg hover:border-fg-muted hover:bg-fg/[0.04]",
  quiet: "px-3 py-1.5 text-fg-muted hover:text-fg hover:bg-fg/[0.05]",
};

export function buttonClass(variant: ButtonVariant = "ghost", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({ variant = "ghost", className, ...rest }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type="button" className={buttonClass(variant, className)} {...rest} />;
}

export function Chip({ children, active, className, ...rest }: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-fg-muted">{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-fg-faint">{label}</div>
      <div className="mt-1 font-mono text-lg text-fg tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-fg-faint">{hint}</div> : null}
    </div>
  );
}

/** Frame every interactive demo sits in. Keeps demos visually consistent. */
export function DemoFrame({
  title,
  note,
  controls,
  children,
  footer,
}: {
  title: string;
  note?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section aria-label={`${title} interactive demo`} className="overflow-hidden rounded-card border border-line bg-bg-raised">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          <h3 className="text-sm font-medium text-fg">{title}</h3>
        </div>
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
      {note || footer ? (
        <footer className="border-t border-line px-4 py-3 text-xs leading-relaxed text-fg-faint sm:px-5">
          {footer}
          {note}
        </footer>
      ) : null}
    </section>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-xs text-fg-muted">
        {label}
      </label>
      {children}
      {hint ? <div className="text-xs text-fg-faint">{hint}</div> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-input border border-line-strong bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-input bg-fg/[0.05]", className)} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-input border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </div>
  );
}
