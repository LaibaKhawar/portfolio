"use client";

import { motion, type MotionValue } from "motion/react";

/*
  Flat, geometric portrait of Laiba, drawn from her illustrated avatar: long
  side-parted dark-brown hair over the shoulders, red rectangular glasses, brown
  eyes, a wide smile, a pearl earring, and a charcoal sweater.

  The mouth is a circle revealed through a clip rectangle: a low clip edge reads as
  a smile, raising it opens the mouth into a round "o", which the intro then zooms
  into. Mouth geometry is exported so the zoom can be centred on it.
*/

export const VIEW = { w: 600, h: 720 };
export const MOUTH = { cx: 300, cy: 392, r: 34 };

export const C = {
  skin: "#f5cba9",
  skinShade: "#e8b48f",
  hair: "#3b2519",
  hairLight: "#6e4a32",
  hairGlow: "#8a6448",
  sweater: "#262b3a",
  sweaterLight: "#323849",
  frame: "#d9534f",
  lens: "rgba(255, 250, 189, 0.22)",
  eye: "#2a170f",
  ink: "#14204a",
  teeth: "#fffdf2",
  pearl: "#fffaf0",
  blush: "#d9534f",
};

export type CharacterMotion = {
  pupilX: MotionValue<number>;
  pupilY: MotionValue<number>;
  blink: MotionValue<number>; // eye scaleY: 1 open, ~0.08 closed
  winkLeft: MotionValue<number>;
  mouthClipY: MotionValue<number>; // y of the clip edge; MOUTH.cy - MOUTH.r * k
  mouthR: MotionValue<number>;
  teethOpacity: MotionValue<number>;
  smileScale: MotionValue<number>; // load-in pop
  browLift: MotionValue<number>;
  blushOpacity: MotionValue<number>;
  hairSway: MotionValue<number>; // degrees
};

function Eye({ cx, cy, m, wink }: { cx: number; cy: number; m: CharacterMotion; wink?: boolean }) {
  return (
    <motion.g style={{ scaleY: wink ? m.winkLeft : m.blink, transformBox: "fill-box", transformOrigin: "center" }}>
      <motion.g style={{ x: m.pupilX, y: m.pupilY }}>
        <circle cx={cx} cy={cy} r={13.5} fill={C.eye} />
        <circle cx={cx - 4} cy={cy - 4.5} r={3.6} fill="#fff" />
        <circle cx={cx + 4.5} cy={cy + 3.5} r={1.6} fill="#fff" opacity={0.7} />
      </motion.g>
      {/* upper lash line with an outer flick */}
      <path
        d={`M ${cx - 19} ${cy - 9} Q ${cx} ${cy - 23} ${cx + 19} ${cy - 10} L ${cx + 25} ${cy - 15}`}
        fill="none"
        stroke={C.eye}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={cx < 300 ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}
      />
    </motion.g>
  );
}

export function Character({ m, title }: { m: CharacterMotion; title: string }) {
  const { cx, cy } = MOUTH;
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label={title} className="block h-full w-full overflow-visible">
      <defs>
        <clipPath id="mouth-clip">
          <motion.rect x={0} width={VIEW.w} height={VIEW.h} y={m.mouthClipY} />
        </clipPath>
      </defs>

      {/* back hair: long, falls past the shoulders */}
      <motion.g style={{ rotate: m.hairSway, transformBox: "view-box", transformOrigin: "300px 120px" }}>
        <path
          d="M300 78 C 178 78 112 160 106 290 C 100 400 92 470 78 560 C 70 615 84 668 120 700 L 480 700 C 516 668 530 615 522 560 C 508 470 500 400 494 290 C 488 160 422 78 300 78 Z"
          fill={C.hair}
        />
        <path d="M150 380 C 140 460 128 540 132 640" stroke={C.hairLight} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.6} />
        <path d="M458 360 C 470 450 478 540 470 650" stroke={C.hairLight} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.6} />
      </motion.g>

      {/* sweater and neck */}
      <path d="M70 720 C 78 600 170 530 300 526 C 430 530 522 600 530 720 Z" fill={C.sweater} />
      <path d="M246 530 C 262 550 338 550 354 530 L 352 548 C 332 566 268 566 248 548 Z" fill={C.sweaterLight} />
      <path d="M266 452 L 266 534 C 284 548 316 548 334 534 L 334 452 Z" fill={C.skinShade} />

      {/* ears and pearl earring */}
      <circle cx={180} cy={340} r={22} fill={C.skinShade} />
      <circle cx={420} cy={340} r={22} fill={C.skinShade} />
      <circle cx={424} cy={366} r={7.5} fill={C.pearl} stroke="#e9dfc4" strokeWidth={1.5} />

      {/* face */}
      <ellipse cx={300} cy={330} rx={124} ry={140} fill={C.skin} />

      {/* cheeks */}
      <motion.g style={{ opacity: m.blushOpacity }}>
        <ellipse cx={236} cy={372} rx={22} ry={14} fill={C.blush} />
        <ellipse cx={364} cy={372} rx={22} ry={14} fill={C.blush} />
      </motion.g>

      {/* front hair: side part with a sweep across the forehead */}
      <motion.g style={{ rotate: m.hairSway, transformBox: "view-box", transformOrigin: "300px 120px" }}>
        <path
          d="M176 330 C 166 228 220 170 300 168 C 380 166 432 222 424 318 C 414 262 392 230 352 212 C 328 232 286 238 240 240 C 206 244 184 272 176 322 Z"
          fill={C.hair}
        />
        <path d="M352 212 C 360 190 352 176 340 170" stroke={C.hairLight} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* locks falling in front of the shoulders */}
        <path d="M178 320 C 168 420 150 520 160 640 C 166 690 190 712 214 716 C 196 640 200 520 208 430 C 212 380 200 340 178 320 Z" fill={C.hair} />
        <path d="M422 312 C 434 420 450 520 440 640 C 434 690 410 712 386 716 C 404 640 400 520 392 430 C 388 380 400 336 422 312 Z" fill={C.hair} />
        <path d="M190 360 C 182 450 172 540 184 650" stroke={C.hairGlow} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.75} />
        <path d="M410 350 C 420 450 428 540 418 650" stroke={C.hairGlow} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.75} />
        <path d="M262 186 C 300 176 336 182 360 200" stroke={C.hairGlow} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
      </motion.g>

      {/* hand on cheek, as in her portrait */}
      <path d="M540 720 C 520 640 470 560 430 500 L 372 532 C 404 600 430 660 446 720 Z" fill={C.sweater} />
      <path d="M432 498 C 418 488 380 504 368 520 L 378 540 C 392 524 424 514 438 518 Z" fill={C.sweaterLight} />
      <path d="M352 470 C 344 440 360 420 384 418 C 410 416 430 432 432 458 C 434 484 418 504 394 510 C 370 514 356 496 352 470 Z" fill={C.skin} />
      <path d="M368 440 C 380 432 398 432 410 440 M366 456 C 380 448 400 448 414 456 M370 472 C 382 466 400 466 412 472" stroke={C.skinShade} strokeWidth={3.5} fill="none" strokeLinecap="round" />

      {/* brows */}
      <motion.g style={{ y: m.browLift }}>
        <path d="M222 262 Q 248 246 284 256" stroke={C.hair} strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d="M316 256 Q 352 246 378 262" stroke={C.hair} strokeWidth={8} fill="none" strokeLinecap="round" />
      </motion.g>

      {/* eyes */}
      <Eye cx={256} cy={306} m={m} wink />
      <Eye cx={344} cy={306} m={m} />

      {/* glasses */}
      <g fill={C.lens} stroke={C.frame} strokeWidth={7} strokeLinejoin="round">
        <rect x={214} y={276} width={82} height={60} rx={20} />
        <rect x={304} y={276} width={82} height={60} rx={20} />
      </g>
      <path d="M296 296 Q 300 289 304 296" stroke={C.frame} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M214 292 L 178 284" stroke={C.frame} strokeWidth={6} strokeLinecap="round" />
      <path d="M386 292 L 422 284" stroke={C.frame} strokeWidth={6} strokeLinecap="round" />
      <path d="M222 284 Q 228 280 236 280" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.6} fill="none" />

      {/* nose */}
      <path d="M302 330 Q 294 354 300 360 Q 306 363 312 358" stroke={C.skinShade} strokeWidth={4} fill="none" strokeLinecap="round" />

      {/* mouth: smile that opens into a round "o" */}
      <motion.g style={{ scale: m.smileScale, transformBox: "fill-box", transformOrigin: "center" }}>
        <g clipPath="url(#mouth-clip)">
          <motion.circle cx={cx} cy={cy} r={m.mouthR} fill={C.ink} stroke="#d97a6c" strokeWidth={5} />
          <motion.rect x={cx - 40} y={cy - 6} width={80} height={13} rx={4} fill={C.teeth} style={{ opacity: m.teethOpacity }} />
        </g>
      </motion.g>
    </svg>
  );
}
