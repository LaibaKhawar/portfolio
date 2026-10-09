"use client";

import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { profile } from "@/content/profile";
import { Character, MOUTH, VIEW, type CharacterMotion } from "./Character";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Opening scene: the character on a royal-blue field. Scrolling opens her smile into
 * an "o" and zooms the view into her mouth until it fills the screen, which hands
 * over to the navy section that follows. Reduced motion: a static portrait.
 */
export function CharacterIntro() {
  const reduce = useReducedMotionSafe();
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);

  const { scrollYProgress: p } = useScroll({ target: track, offset: ["start start", "end end"] });

  // Idle and pointer-driven motion
  const pupilXRaw = useMotionValue(0);
  const pupilYRaw = useMotionValue(0);
  const pupilX = useSpring(pupilXRaw, { stiffness: 180, damping: 18 });
  const pupilY = useSpring(pupilYRaw, { stiffness: 180, damping: 18 });
  const blink = useMotionValue(1);
  const winkLeft = useMotionValue(1);
  const smileScale = useMotionValue(0);
  const browLiftRaw = useMotionValue(0);
  const browLift = useSpring(browLiftRaw, { stiffness: 220, damping: 16 });
  const blushRaw = useMotionValue(0.22);
  const blushOpacity = useSpring(blushRaw, { stiffness: 120, damping: 20 });
  const hairSway = useMotionValue(0);

  // Scroll-driven motion
  const open = useTransform(p, [0, 0.16], [0, 1]);
  const mouthClipY = useTransform(open, (k) => MOUTH.cy - MOUTH.r * (0.12 + 0.95 * k) - (k > 0.98 ? 6 : 0));
  const mouthR = useTransform(open, [0, 1], [MOUTH.r, MOUTH.r + 6]);
  const teethOpacity = useTransform(p, [0, 0.1], [1, 0]);
  const zoomT = useTransform(p, [0.12, 0.84], [0, 1], { clamp: true });
  const scale = useTransform(zoomT, (t) => {
    if (typeof window === "undefined") return 1;
    // Mouth radius in screen pixels at scale 1, and the scale needed to cover the viewport.
    const h = figure.current?.getBoundingClientRect().height ?? window.innerHeight * 0.78;
    const mouthPx = (MOUTH.r + 6) * (h / VIEW.h);
    const cover = (Math.hypot(window.innerWidth, window.innerHeight) / mouthPx) * 1.15;
    return 1 + (cover - 1) * Math.pow(t, 2.6);
  });
  const chromeOpacity = useTransform(p, [0.02, 0.14], [1, 0]);
  const cover = useTransform(p, [0.88, 0.92], [0, 1]);

  // Reduced motion: a still, smiling portrait that ignores scroll.
  const stillClip = useMotionValue(MOUTH.cy - MOUTH.r * 0.12);
  const stillR = useMotionValue(MOUTH.r);
  const stillTeeth = useMotionValue(1);

  const m: CharacterMotion = {
    pupilX,
    pupilY,
    blink,
    winkLeft,
    mouthClipY: reduce ? stillClip : mouthClipY,
    mouthR: reduce ? stillR : mouthR,
    teethOpacity: reduce ? stillTeeth : teethOpacity,
    smileScale,
    browLift,
    blushOpacity,
    hairSway,
  };

  // Load-in: smile pops, then idle blinking and a slow hair sway.
  useEffect(() => {
    if (reduce) {
      smileScale.set(1);
      return;
    }
    const pop = animate(smileScale, 1, { type: "spring", stiffness: 260, damping: 14, delay: 0.55 });
    const sway = animate(hairSway, [0, 1.2, 0, -1.2, 0], { duration: 7, repeat: Infinity, ease: "easeInOut" });
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        animate(blink, [1, 0.08, 1], { duration: 0.2, ease: "easeInOut" });
        loop();
      }, 2400 + Math.random() * 3200);
    };
    loop();
    return () => {
      pop.stop();
      sway.stop();
      clearTimeout(t);
    };
  }, [reduce, smileScale, hairSway, blink]);

  // Pupils follow the pointer.
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      const r = figure.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * (306 / VIEW.h));
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d / 260, 0, 1);
      pupilXRaw.set((dx / d) * 7 * k);
      pupilYRaw.set((dy / d) * 5 * k);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, pupilXRaw, pupilYRaw]);

  // Hide the site navigation while the intro fills the screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      document.documentElement.dataset.intro = e.intersectionRatio > 0.6 ? "on" : "off";
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.intro;
    };
  }, []);

  const wink = () => {
    if (reduce) return;
    animate(winkLeft, [1, 0.08, 1], { duration: 0.32, times: [0, 0.35, 1] });
    animate(blushRaw, [0.22, 0.5, 0.22], { duration: 1.1 });
  };

  return (
    <section ref={track} aria-label="Introduction" className={reduce ? "relative bg-royal" : "relative h-[240vh] bg-ink"}>
      <div ref={stage} className="sticky top-0 h-[100dvh] overflow-hidden bg-royal text-cream">
        <motion.p
          style={{ opacity: reduce ? 1 : chromeOpacity }}
          className="absolute top-5 left-5 z-10 text-3xl font-semibold tracking-tight sm:top-8 sm:left-10 sm:text-5xl"
        >
          {profile.name}
        </motion.p>
        <motion.p
          style={{ opacity: reduce ? 1 : chromeOpacity }}
          className="absolute right-5 bottom-6 z-10 text-2xl tracking-tight italic sm:right-10 sm:bottom-8 sm:text-5xl"
        >
          {profile.role}
        </motion.p>

        <div className="absolute inset-0 flex items-end justify-center">
          <motion.div
            ref={figure}
            initial={reduce ? false : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.1 }}
            style={{
              scale: reduce ? 1 : scale,
              transformOrigin: `50% ${(MOUTH.cy / VIEW.h) * 100}%`,
              aspectRatio: `${VIEW.w} / ${VIEW.h}`,
            }}
            className="relative h-[min(82dvh,130vw)] cursor-pointer"
            onPointerEnter={() => {
              browLiftRaw.set(-6);
              blushRaw.set(0.4);
            }}
            onPointerLeave={() => {
              browLiftRaw.set(0);
              blushRaw.set(0.22);
            }}
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
