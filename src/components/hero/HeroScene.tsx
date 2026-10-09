"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { setGlassSource } from "@/components/glass/LiquidGlass";
import { stages } from "./stages";

const PACKET = new THREE.Color("#fffabd"); // cream data packets
const LIT = new THREE.Color("#6f8ff0"); // royal blue, lightened for the navy band
const DIM = new THREE.Color("#2f4590");
const STAGE_COUNT = stages.length;
const NODES_PER_STAGE = 9;
const PARTICLES = 520;
const CURVE_SAMPLES = 40;

// Deterministic PRNG so the network looks the same on every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Graph = {
  nodes: THREE.Vector3[];
  stageOf: number[];
  stageCenters: THREE.Vector3[];
  curves: { from: number; to: number; pts: THREE.Vector3[] }[];
};

function buildGraph(): Graph {
  const rand = mulberry32(7);
  const nodes: THREE.Vector3[] = [];
  const stageOf: number[] = [];
  const stageCenters: THREE.Vector3[] = [];
  for (let s = 0; s < STAGE_COUNT; s++) {
    const x = -5 + (10 * s) / (STAGE_COUNT - 1);
    const z = -Math.cos(((s / (STAGE_COUNT - 1)) * 2 - 1) * 1.1) * 1.6 + 1.2; // gentle arc toward the viewer
    stageCenters.push(new THREE.Vector3(x, 0, z));
    for (let i = 0; i < NODES_PER_STAGE; i++) {
      const a = (i / NODES_PER_STAGE) * Math.PI * 2 + rand() * 0.4;
      const r = 0.55 + rand() * 0.75;
      nodes.push(new THREE.Vector3(x + (rand() - 0.5) * 0.35, Math.sin(a) * r * 1.35, z + Math.cos(a) * r * 0.9));
      stageOf.push(s);
    }
  }
  const curves: Graph["curves"] = [];
  for (let s = 0; s < STAGE_COUNT - 1; s++) {
    for (let i = 0; i < NODES_PER_STAGE; i++) {
      const fanout = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < fanout; k++) {
        const from = s * NODES_PER_STAGE + i;
        const to = (s + 1) * NODES_PER_STAGE + Math.floor(rand() * NODES_PER_STAGE);
        const a = nodes[from], b = nodes[to];
        const mid = a.clone().lerp(b, 0.5);
        mid.y += (rand() - 0.5) * 0.9;
        mid.z += 0.4 + rand() * 0.6;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        curves.push({ from, to, pts: curve.getSpacedPoints(CURVE_SAMPLES) });
      }
    }
  }
  return { nodes, stageOf, stageCenters, curves };
}

class ParticleFlow {
  geo = new THREE.BufferGeometry();
  private state: { curve: number; t: number; speed: number }[];
  private outgoing = new Map<number, number[]>();
  private rand = mulberry32(11);
  constructor(private graph: Graph) {
    graph.curves.forEach((c, i) => this.outgoing.set(c.from, [...(this.outgoing.get(c.from) ?? []), i]));
    this.state = Array.from({ length: PARTICLES }, () => ({
      curve: Math.floor(this.rand() * graph.curves.length),
      t: this.rand(),
      speed: 0.18 + this.rand() * 0.3,
    }));
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(PARTICLES).map(() => 0.6 + this.rand() * 0.9), 1));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(PARTICLES).fill(0.9), 1));
    this.step(0, null); // place packets in flight so a still frame shows the flow
  }
  step(dt: number, active: number | null) {
    const { graph } = this;
    const pos = this.geo.getAttribute("position") as THREE.BufferAttribute;
    const alpha = this.geo.getAttribute("aAlpha") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      const p = this.state[i];
      p.t += dt * p.speed;
      if (p.t >= 1) {
        const next = this.outgoing.get(graph.curves[p.curve].to);
        p.curve = next ? next[Math.floor(this.rand() * next.length)] : Math.floor(this.rand() * NODES_PER_STAGE * 2.5);
        p.t = 0;
      }
      const pts = graph.curves[p.curve].pts;
      const f = p.t * (pts.length - 1);
      const k = Math.min(Math.floor(f), pts.length - 2);
      const u = f - k;
      const a = pts[k], b = pts[k + 1];
      pos.setXYZ(i, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
      const s = graph.stageOf[graph.curves[p.curve].from];
      const lit = active === null ? 0.9 : s === active || s === active - 1 ? 1 : 0.18;
      alpha.setX(i, lit * Math.sin(Math.PI * p.t) * 0.9 + 0.1);
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
  }
}

const pointVertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
  vAlpha = aAlpha;
}
`;
const pointFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * core * vAlpha, core * vAlpha);
}
`;

function Network({ active, reduced }: { active: number | null; reduced: boolean }) {
  const graph = useMemo(() => buildGraph(), []);
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  // Edges as one LineSegments geometry; per-vertex colour lets a hovered stage light up.
  const edges = useMemo(() => {
    const positions: number[] = [];
    const stageIdx: number[] = [];
    for (const c of graph.curves) {
      for (let i = 0; i < c.pts.length - 1; i++) {
        positions.push(c.pts[i].x, c.pts[i].y, c.pts[i].z, c.pts[i + 1].x, c.pts[i + 1].y, c.pts[i + 1].z);
        stageIdx.push(graph.stageOf[c.from], graph.stageOf[c.from]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
    return { geo, stageIdx };
  }, [graph]);

  useEffect(() => {
    const col = edges.geo.getAttribute("color") as THREE.BufferAttribute;
    const tmp = new THREE.Color();
    for (let i = 0; i < edges.stageIdx.length; i++) {
      const s = edges.stageIdx[i];
      const lit = active === null ? 0.18 : s === active || s === active - 1 ? 0.75 : 0.08;
      tmp.copy(DIM).lerp(LIT, lit);
      col.setXYZ(i, tmp.r * (0.35 + lit), tmp.g * (0.35 + lit), tmp.b * (0.35 + lit));
    }
    col.needsUpdate = true;
  }, [active, edges]);

  // Nodes
  const nodeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(graph.nodes);
    const size = new Float32Array(graph.nodes.length).map(() => 1.6);
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(graph.nodes.length).fill(0.7), 1));
    return geo;
  }, [graph]);

  useEffect(() => {
    const a = nodeGeo.getAttribute("aAlpha") as THREE.BufferAttribute;
    const s = nodeGeo.getAttribute("aSize") as THREE.BufferAttribute;
    for (let i = 0; i < graph.nodes.length; i++) {
      const on = active === null || graph.stageOf[i] === active;
      a.setX(i, on ? 0.85 : 0.25);
      s.setX(i, active !== null && graph.stageOf[i] === active ? 2.6 : 1.6);
    }
    a.needsUpdate = true;
    s.needsUpdate = true;
  }, [active, nodeGeo, graph]);

  // Flowing particles: each rides one curve, then hops to a curve leaving its end node.
  const particles = useMemo(() => new ParticleFlow(graph), [graph]);

  // Re-light particles when the highlighted stage changes, even when frames are on demand.
  useEffect(() => {
    particles.step(0, active);
  }, [particles, active]);


  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: { uColor: { value: PACKET } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const nodeMaterial = useMemo(() => {
    const m = material.clone();
    m.uniforms = { uColor: { value: new THREE.Color("#d9534f") } };
    m.blending = THREE.NormalBlending;
    return m;
  }, [material]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (!reduced) particles.step(dt, active);
    if (group.current) {
      const targetY = pointer.x * 0.18;
      const targetX = -pointer.y * 0.08;
      group.current.rotation.y += (targetY - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
      if (!reduced) group.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.06;
    }
  });

  return (
    <group ref={group}>
      <lineSegments geometry={edges.geo}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={nodeGeo} material={nodeMaterial} />
      <points geometry={particles.geo} material={material} />
    </group>
  );
}

function RegisterGlassSource() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setGlassSource(gl.domElement);
    return () => setGlassSource(null);
  }, [gl]);
  return null;
}

export default function HeroScene({ active, visible, reduced }: { active: number | null; visible: boolean; reduced: boolean }) {
  return (
    <Canvas
      frameloop={visible ? (reduced ? "demand" : "always") : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.3, 9.5], fov: 42 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <RegisterGlassSource />
      <Network active={active} reduced={reduced} />
    </Canvas>
  );
}
