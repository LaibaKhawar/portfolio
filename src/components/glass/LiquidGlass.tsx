"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import { glassDefaults, glassFragment, glassVertex } from "@/vendor/liquid-glass/refraction";

// Pages register the canvas that glass elements should refract (e.g. the hero scene).
let currentSource: HTMLCanvasElement | null = null;
export function setGlassSource(canvas: HTMLCanvasElement | null) {
  currentSource = canvas;
}

const MARGIN = 24; // css px captured around the element so edge refraction has data to bend in

type Props = { children: ReactNode; className?: string; radius?: number; warp?: boolean };

/**
 * WebGL liquid glass (refraction shader from liquid-glass-js) over a live source canvas.
 * Falls back to the CSS `.glass` surface when WebGL is unavailable, transparency is
 * reduced, or there is no source canvas to refract.
 */
export function LiquidGlass({ children, className, radius = 999, warp = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const maybeHost = hostRef.current;
    if (!maybeHost) return;
    const host: HTMLDivElement = maybeHost;
    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) {
      if (process.env.NODE_ENV !== "production") console.warn("LiquidGlass: reduced transparency, using CSS glass");
      return;
    }

    // A fresh canvas per effect run: reusing one whose context was lost in cleanup would fail.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "pointer-events-none absolute inset-0 -z-10 h-full w-full";
    canvas.style.borderRadius = `${radius}px`;
    canvas.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.12), 0 20px 40px -20px rgba(0,0,0,0.9)";
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
      if (process.env.NODE_ENV !== "production") console.warn("LiquidGlass shader:", gl.getShaderInfoLog(s));
      return null;
    };
    const vs = compile(gl.VERTEX_SHADER, glassVertex);
    const fs = compile(gl.FRAGMENT_SHADER, glassFragment);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const d = glassDefaults;
    gl.uniform1f(U("u_blurRadius"), d.blurRadius);
    gl.uniform1f(U("u_edgeIntensity"), d.edgeIntensity);
    gl.uniform1f(U("u_rimIntensity"), d.rimIntensity);
    gl.uniform1f(U("u_baseIntensity"), d.baseIntensity);
    gl.uniform1f(U("u_edgeDistance"), d.edgeDistance);
    gl.uniform1f(U("u_rimDistance"), d.rimDistance);
    gl.uniform1f(U("u_baseDistance"), d.baseDistance);
    gl.uniform1f(U("u_cornerBoost"), d.cornerBoost);
    gl.uniform1f(U("u_rippleEffect"), d.rippleEffect);
    gl.uniform1f(U("u_tintOpacity"), d.tintOpacity);
    gl.uniform1f(U("u_warp"), warp ? 1 : 0);
    gl.uniform1f(U("u_margin"), MARGIN);
    const uRes = U("u_resolution"), uTex = U("u_textureSize"), uRadius = U("u_borderRadius"), uScale = U("u_scale");

    host.prepend(canvas);
    const scratch = document.createElement("canvas");
    const ctx = scratch.getContext("2d", { willReadFrequently: false })!;
    host.classList.remove("glass"); // WebGL glass is live: drop the CSS fallback surface

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) raf = requestAnimationFrame(tick);
    });
    io.observe(host);

    function tick() {
      if (!visible) return;
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        gl!.viewport(0, 0, canvas.width, canvas.height);
      }
      const tw = w + MARGIN * 2;
      const th = h + MARGIN * 2;
      if (scratch.width !== tw || scratch.height !== th) {
        scratch.width = tw;
        scratch.height = th;
      }
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, tw, th);
      const src = currentSource;
      if (src && src.isConnected) {
        const s = src.getBoundingClientRect();
        const kx = src.width / s.width;
        const ky = src.height / s.height;
        try {
          ctx.drawImage(src, (rect.left - MARGIN - s.left) * kx, (rect.top - MARGIN - s.top) * ky, tw * kx, th * ky, 0, 0, tw, th);
        } catch {
          /* source not readable this frame */
        }
      }
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, scratch);
      gl!.uniform2f(uRes, w, h);
      gl!.uniform2f(uTex, tw, th);
      gl!.uniform1f(uRadius, Math.min(radius, h / 2, w / 2));
      gl!.uniform1f(uScale, window.innerWidth / tw);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
      host.classList.add("glass");
    };
  }, [radius, warp]);

  return (
    <div
      ref={hostRef}
      className={cx("glass relative isolate", className)}
      style={{ borderRadius: radius }}
    >
      {children}
    </div>
  );
}
