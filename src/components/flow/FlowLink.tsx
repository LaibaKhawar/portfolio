"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, RefObject } from "react";
import { useFlow } from "./FlowTransition";

type Props = ComponentProps<typeof Link> & {
  /** Element whose rectangle the flow starts from. Defaults to the link itself. */
  originRef?: RefObject<HTMLElement | null>;
};

/** A Next.js link that plays the flowing-intelligence transition on plain left clicks. */
export function FlowLink({ originRef, onClick, href, ...rest }: Props) {
  const { navigate } = useFlow();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const url = typeof href === "string" ? href : href.pathname ?? "/";
    const external = /^https?:\/\//.test(url) && !url.startsWith(window.location.origin);
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank" || external) return;
    e.preventDefault();
    const el = originRef?.current ?? e.currentTarget;
    const r = el.getBoundingClientRect();
    navigate(url, { x: r.left, y: r.top, w: r.width, h: r.height });
  };
  return <Link href={href} onClick={handle} {...rest} />;
}
