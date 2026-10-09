"use client";

import { motion, type MotionValue } from "motion/react";

/*
  Laiba's illustrated portrait, used as drawn, with animation layered on top.
  public/character/ holds layers cut from the original image (1254 x 1254):
  - base.png: the illustration with its background keyed out and the pupils
    painted over with the lens colour;
  - {left,right}-pupil.png and {left,right}-lash.png: the original eye pixels.
  Everything is positioned in the image's own pixel coordinates via the viewBox.
  The mouth is redrawn as a vector ellipse over the original so it can grow into
  the scroll portal.
*/

export const VIEW = 1254;
export const MOUTH = { cx: 582, cy: 669, rx: 23, ry: 25 };

const EYES = {
  left: { x: 444, y: 491, w: 86, h: 76, cx: 499, cy: 530 },
  right: { x: 669, y: 510, w: 89, h: 75, cx: 704, cy: 548 },
} as const;

export type CharacterMotion = {
  pupilX: MotionValue<number>; // image px
  pupilY: MotionValue<number>;
  blink: MotionValue<number>; // scaleY of both eyes: 1 open, ~0.08 closed
  winkLeft: MotionValue<number>; // scaleY of the left eye only
  mouthScale: MotionValue<number>;
  mouthColor: MotionValue<string>;
  headTilt: MotionValue<number>; // degrees
};

function Eye({ side, m }: { side: "left" | "right"; m: CharacterMotion }) {
  const e = EYES[side];
  const lid = side === "left" ? m.winkLeft : undefined;
  return (
    <motion.g style={{ scaleY: m.blink, transformBox: "fill-box", transformOrigin: "center" }}>
      <motion.g style={lid ? { scaleY: lid, transformBox: "fill-box", transformOrigin: "center" } : undefined}>
        {/* pupil and lash move together, so their shared edge never separates */}
        <motion.g style={{ x: m.pupilX, y: m.pupilY }}>
          <image href={`/character/${side}-pupil.png`} x={e.x} y={e.y} width={e.w} height={e.h} />
          <image href={`/character/${side}-lash.png`} x={e.x} y={e.y} width={e.w} height={e.h} />
        </motion.g>
      </motion.g>
    </motion.g>
  );
}

export function Character({ m, title }: { m: CharacterMotion; title: string }) {
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label={title} className="block h-full w-full overflow-visible">
      <motion.g style={{ rotate: m.headTilt, transformBox: "view-box", transformOrigin: "627px 1254px" }}>
        <image href="/character/base.png" x={0} y={0} width={VIEW} height={VIEW} />
        <Eye side="left" m={m} />
        <Eye side="right" m={m} />
        <motion.ellipse
          cx={MOUTH.cx}
          cy={MOUTH.cy}
          rx={MOUTH.rx}
          ry={MOUTH.ry}
          style={{ scale: m.mouthScale, fill: m.mouthColor, transformBox: "fill-box", transformOrigin: "center" }}
        />
      </motion.g>
    </svg>
  );
}
