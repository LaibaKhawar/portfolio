"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { buttonClass, cx, iconButtonClass } from "@/components/ui/primitives";
import { FlowLink } from "@/components/flow/FlowLink";

const links = [
  { href: "/#work", label: "Work" },
  { href: "/#experience", label: "Experience" },
  { href: "/lab", label: "Lab" },
  { href: "/#about", label: "About" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigation (adjust state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-nav fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <nav
        aria-label="Primary"
        className={cx(
          "mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full px-2 pl-5 transition-[background-color,border-color,box-shadow] duration-500",
          "glass",
        )}
      >
        <FlowLink href="/" className="font-display text-xl text-fg" aria-label="Laiba Khawar, home">
          Laiba Khawar<span className="text-red">.</span>
        </FlowLink>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const current = l.href === pathname;
            const Comp = l.href.startsWith("/#") ? Link : FlowLink;
            return (
              <li key={l.href}>
                <Comp href={l.href} aria-current={current ? "page" : undefined} className={cx(buttonClass("quiet"), current && "text-fg")}>
                  {l.label}
                </Comp>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/#contact" className={buttonClass("primary", "hidden px-4 py-2 sm:inline-flex")}>
            Get in touch
          </Link>
          <button
            type="button"
            className={iconButtonClass("quiet", "md:hidden")}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-menu" className="glass mx-auto mt-2 max-w-[1400px] rounded-card p-2 md:hidden">
          <ul className="grid">
            {[...links, { href: "/#contact", label: "Get in touch" }].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-input px-4 py-3 text-base text-fg hover:bg-fg/[0.05]" onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
