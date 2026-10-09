"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, startTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fragmentSource, vertexSource } from "./shader";

type Rect = { x: number; y: number; w: number; h: number };
type FlowApi = { navigate: (href: string, origin?: Rect | null) => void; active: boolean };

const FlowContext = createContext<FlowApi | null>(null);

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside <FlowTransitionProvider>");
  return ctx;
}

const COVER_MS = 720;
const REVEAL_MS = 680;
const MAX_WAIT_MS = 2500;

type Renderer = {
  draw: (u: { origin: [number, number]; originR: number; t: number; p: number; mode: 0 | 1 }) => void;
  resize: () => void;
  dispose: () => void;
};

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uOrigin = U("uOrigin"), uOriginR = U("uOriginR"), uT = U("uT"), uP = U("uP"), uMode = U("uMode");
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const r = dpr();
      canvas.width = Math.round(window.innerWidth * r);
      canvas.height = Math.round(window.innerHeight * r);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    return {
      resize,
      draw({ origin, originR, t, p, mode }) {
        const r = dpr();
        gl.uniform2f(uRes, canvas.width, canvas.height);
        // DOM y grows downward, GL y grows upward
        gl.uniform2f(uOrigin, origin[0] * r, canvas.height - origin[1] * r);
        gl.uniform1f(uOriginR, originR * r);
        gl.uniform1f(uT, t);
        gl.uniform1f(uP, p);
        gl.uniform1f(uMode, mode);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose() {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  } catch {
    return null;
  }
}

type Phase = "idle" | "cover" | "waiting" | "reveal";

export function FlowTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null | undefined>(undefined);
  const phaseRef = useRef<Phase>("idle");
  const [active, setActive] = useState(false);
  const run = useRef({ raf: 0, start: 0, t0: 0, origin: [0, 0] as [number, number], originR: 0, target: "", waitTimer: 0 });

  const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getRenderer = () => {
    if (rendererRef.current === undefined && canvasRef.current) rendererRef.current = createRenderer(canvasRef.current);
    return rendererRef.current ?? null;
  };

  const stop = useCallback(() => {
    cancelAnimationFrame(run.current.raf);
    window.clearTimeout(run.current.waitTimer);
    phaseRef.current = "idle";
    setActive(false);
    const c = canvasRef.current;
    if (c) c.style.opacity = "0";
    const f = fallbackRef.current;
    if (f) f.style.clipPath = "circle(0px at 50% 50%)";
    document.documentElement.removeAttribute("data-flow");
  }, []);

  const frame = useCallback(
    (mode: 0 | 1, duration: number, onDone: () => void) => {
      const r = getRenderer();
      const begin = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - begin) / duration);
        const t = (now - run.current.t0) / 1000;
        if (r) {
          r.draw({ origin: run.current.origin, originR: run.current.originR, t, p, mode });
        } else if (fallbackRef.current) {
          // CSS fallback when WebGL is unavailable
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          const maxR = Math.hypot(window.innerWidth, window.innerHeight);
          const [ox, oy] = mode === 0 ? run.current.origin : [window.innerWidth / 2, window.innerHeight / 2];
          const radius = mode === 0 ? run.current.originR + (maxR - run.current.originR) * e : maxR * (1 - e);
          fallbackRef.current.style.clipPath = `circle(${radius}px at ${ox}px ${oy}px)`;
        }
        if (p < 1) run.current.raf = requestAnimationFrame(tick);
        else onDone();
      };
      run.current.raf = requestAnimationFrame(tick);
    },
    [],
  );

  const reveal = useCallback(() => {
    if (phaseRef.current !== "waiting") return;
    window.clearTimeout(run.current.waitTimer);
    phaseRef.current = "reveal";
    frame(1, REVEAL_MS, stop);
  }, [frame, stop]);

  const navigate = useCallback(
    (href: string, origin?: Rect | null) => {
      const url = new URL(href, window.location.href);
      const samePage = url.pathname === window.location.pathname;
      if (phaseRef.current !== "idle" || samePage || reducedMotion()) {
        startTransition(() => router.push(href));
        return;
      }
      const o = origin ?? { x: window.innerWidth / 2 - 40, y: window.innerHeight / 2 - 40, w: 80, h: 80 };
      run.current.origin = [o.x + o.w / 2, o.y + o.h / 2];
      run.current.originR = Math.max(12, Math.min(o.w, o.h) / 2);
      run.current.target = url.pathname;
      run.current.t0 = performance.now();
      phaseRef.current = "cover";
      setActive(true);
      document.documentElement.setAttribute("data-flow", "active");
      const r = getRenderer();
      if (r) {
        r.resize();
        canvasRef.current!.style.opacity = "1";
      }
      router.prefetch(href);
      frame(0, COVER_MS, () => {
        phaseRef.current = "waiting";
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        startTransition(() => router.push(href));
        // Safety net: never leave the cover up if navigation is slow or fails.
        run.current.waitTimer = window.setTimeout(reveal, MAX_WAIT_MS);
      });
    },
    [router, frame, reveal],
  );

  // The new route has committed: resolve the transition into the new page.
  useEffect(() => {
    if (phaseRef.current === "waiting" && pathname === run.current.target) {
      const id = requestAnimationFrame(() => requestAnimationFrame(reveal));
      return () => cancelAnimationFrame(id);
    }
  }, [pathname, reveal]);

  // Cancellation: Escape, or browser back/forward while covering.
  useEffect(() => {
    const cancel = () => {
      if (phaseRef.current === "idle") return;
      cancelAnimationFrame(run.current.raf);
      phaseRef.current = "waiting";
      reveal();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", cancel);
    const onResize = () => rendererRef.current?.resize();
    const state = run.current;
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(state.raf);
    };
  }, [reveal]);

  return (
    <FlowContext.Provider value={{ navigate, active }}>
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[80] h-full w-full opacity-0"
        style={{ pointerEvents: active ? "auto" : "none" }}
      />
      <div
        ref={fallbackRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[79]"
        style={{
          clipPath: "circle(0px at 50% 50%)",
          background: "radial-gradient(circle at 50% 50%, rgba(242,181,68,0.18), #0a0a0b 55%)",
        }}
      />
      <div aria-live="polite" className="sr-only">
        {active ? "Loading page" : ""}
      </div>
    </FlowContext.Provider>
  );
}
