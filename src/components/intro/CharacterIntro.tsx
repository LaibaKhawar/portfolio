"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import { profile } from "@/content/profile";
import { Character, MOUTH, VIEW, type CharacterMotion } from "./Character";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const FACE_MAX = 2.4; // keep the raster illustration sharp; the vector mouth does the rest
const PUPIL_RANGE = { x: 8, y: 6 }; // image px

/**
 * Opening scene: Laiba's illustration on a royal-blue field. Her eyes follow the
 * pointer and blink; clicking makes her wink. Scrolling widens her "o" mouth, zooms
 * in, and grows the mouth until it fills the screen in navy, handing over to the
 * navy section below. Reduced motion: a still portrait.
 */
export function CharacterIntro() {
  const reduce = useReducedMotionSafe();
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);

  const { scrollYProgress: p } = useScroll({ target: track, offset: ["start start", "end end"] });

  const pupilXRaw = useMotionValue(0);
  const pupilYRaw = useMotionValue(0);
  const pupilX = useSpring(pupilXRaw, { stiffness: 170, damping: 18 });
  const pupilY = useSpring(pupilYRaw, { stiffness: 170, damping: 18 });
  const blink = useMotionValue(1);
  const winkLeft = useMotionValue(1);
  const headTilt = useMotionValue(0);

  const zoomT = useTransform(p, [0.1, 0.84], [0, 1], { clamp: true });
  const faceScale = useTransform(zoomT, (t) => 1 + (FACE_MAX - 1) * Math.pow(t, 1.6));
  const mouthScale = useTransform([p, zoomT], ([pv, t]: number[]) => {
    const open = 1 + 0.5 * clamp(pv / 0.12, 0, 1); // the "o" widens first
    if (typeof window === "undefined") return open;
    // Rendered image px per viewBox unit at scale 1 (offsetHeight ignores transforms).
    const k = (figure.current?.offsetHeight ?? window.innerHeight * 0.88) / VIEW;
    const need = (Math.hypot(window.innerWidth, window.innerHeight) / 2) * 1.15;
    const end = need / (MOUTH.ry * k * FACE_MAX);
    return open + Math.max(0, end - open) * Math.pow(t, 2.3);
  });
  const mouthColor = useTransform(zoomT, [0.08, 0.4], ["#c94d43", "#14204a"]);
  const chromeOpacity = useTransform(p, [0.02, 0.14], [1, 0]);
  const cover = useTransform(p, [0.88, 0.92], [0, 1]);

  // Reduced motion: a still portrait that ignores scroll.
  const still = useMotionValue(1);
  const stillColor = useMotionValue("#c94d43");

  const m: CharacterMotion = {
    pupilX,
    pupilY,
    blink,
    winkLeft,
    headTilt,
    mouthScale: reduce ? still : mouthScale,
    mouthColor: reduce ? stillColor : mouthColor,
  };

  // Idle life: blinking at irregular intervals and a slight head sway.
  useEffect(() => {
    if (reduce) return;
    const sway = animate(headTilt, [0, 0.9, 0, -0.9, 0], { duration: 8, repeat: Infinity, ease: "easeInOut" });
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        animate(blink, [1, 0.08, 1], { duration: 0.2, ease: "easeInOut" });
        loop();
      }, 2200 + Math.random() * 3400);
    };
    loop();
    return () => {
      sway.stop();
      clearTimeout(t);
    };
  }, [reduce, headTilt, blink]);

  // Pupils follow the pointer within the lenses.
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      const r = figure.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width * (600 / VIEW));
      const dy = e.clientY - (r.top + r.height * (540 / VIEW));
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d / 280, 0, 1);
      pupilXRaw.set((dx / d) * PUPIL_RANGE.x * k);
      pupilYRaw.set((dy / d) * PUPIL_RANGE.y * k);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, pupilXRaw, pupilYRaw]);

  // Hide the site navigation while the intro fills the screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        document.documentElement.dataset.intro = e.intersectionRatio > 0.6 ? "on" : "off";
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.intro;
    };
  }, []);

  const wink = () => {
    if (reduce) return;
    animate(winkLeft, [1, 0.08, 1], { duration: 0.34, times: [0, 0.35, 1] });
  };

  return (
    <section ref={track} aria-label="Introduction" className={reduce ? "relative bg-royal" : "relative h-[240vh] bg-ink"}>
      <div ref={stage} className="sticky top-0 h-[100dvh] overflow-hidden bg-royal text-cream">
        <motion.p
          style={{ opacity: reduce ? 1 : chromeOpacity }}
          className="font-display absolute top-5 left-5 z-10 text-4xl leading-none tracking-tight sm:top-8 sm:left-10 sm:text-6xl"
        >
          {profile.name}
        </motion.p>
        <motion.p
          style={{ opacity: reduce ? 1 : chromeOpacity }}
          className="font-organic absolute right-5 bottom-6 z-10 text-5xl leading-none sm:right-10 sm:bottom-8 sm:text-7xl"
        >
          {profile.role}
        </motion.p>

        {/* scroll cue: "scroll" with a pointer, "swipe up" on touch screens */}
        <motion.p
          aria-hidden
          style={{ opacity: reduce ? 1 : chromeOpacity }}
          className="font-organic absolute top-16 left-5 z-10 flex items-center gap-2 text-3xl leading-none sm:top-auto sm:bottom-8 sm:left-10 sm:text-4xl"
        >
          <span className="pointer-coarse:hidden">scroll</span>
          <span className="hidden pointer-coarse:inline">swipe up</span>
          <motion.span
            animate={reduce ? undefined : { y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex"
          >
            <ArrowDown size={26} weight="bold" className="pointer-coarse:hidden" />
            <ArrowUp size={26} weight="bold" className="hidden pointer-coarse:inline" />
          </motion.span>
        </motion.p>

        <div className="absolute inset-0 flex items-end justify-center">
          <motion.div
            ref={figure}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.1 }}
            style={{
              scale: reduce ? 1 : faceScale,
              transformOrigin: `${(MOUTH.cx / VIEW) * 100}% ${(MOUTH.cy / VIEW) * 100}%`,
            }}
            className="relative aspect-square h-[min(88dvh,118vw)] cursor-pointer"
            onClick={wink}
          >
            <Character m={m} title={`Illustrated portrait of ${profile.name}`} />
          </motion.div>
        </div>

        {/* guarantees a solid hand-off colour at the end of the zoom */}
        {!reduce ? <motion.div aria-hidden style={{ opacity: cover }} className="pointer-events-none absolute inset-0 bg-ink" /> : null}
      </div>
    </section>
  );
}
