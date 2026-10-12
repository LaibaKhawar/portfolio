/*
  Magazine corridor: a scrolling corridor of pages rendered as one instanced mesh.
  Adapted from the Originkit "Magazine Flip" component supplied by the site owner.
  Changes for this site:
  - pages are painted project pages (see pages.ts) instead of photos;
  - only horizontal wheel/trackpad input is captured, so vertical scrolling still
    scrolls the page; drag, arrow buttons, and keyboard move the corridor;
  - tapping a page brings it forward, then reports it through onOpen so the page
    can navigate to that project;
  - rendering pauses when off-screen or in a background tab;
  - reduced motion turns off drift and the speed wave.
*/
import * as THREE from "three";
import { paintAtlas, type PageProject } from "./pages";

const CAM_FOV = 75;
const CAM_Z = 6;
const VIEW_HEIGHT = 2 * CAM_Z * Math.tan((CAM_FOV * Math.PI) / 360);
const PAGE_SEGMENTS = 40;
const MAX_PAGES = 60;
const THICKNESS_RATIO = 0.005;
const CORRIDOR_DIM = 0.22;
const TAP_SLOP = 6;
const TAP_MS = 600;
const PICK_MAX = 1600;

export type CorridorOptions = {
  pageWidthPx: number;
  pageHeightPx: number;
  spacing: number; // 0..10
  tilt: number; // degrees
  turn: number; // degrees
  zoom: number; // 0..10, size of a page held up
  speed: number; // 0..10, speed of the hold-up animation
  drift: number; // -10..10, idle travel
  smoothing: number; // 0..10
  wave: number; // 0..10
  wheel: number; // 0..10
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const power2InOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const PAGE_VERTEX = /* glsl */ `
attribute float aIndex;
attribute vec4 aRect;
attribute float aAspect;

uniform float uPageThickness;
uniform float uPageWidth;
uniform float uPageHeight;
uniform float uMeshCount;
uniform float uPageSpacing;
uniform float uScrollY;
uniform float uSpeedY;
uniform float uWave;
uniform float uTilt;
uniform float uTurn;
uniform float uFocusIndex;
uniform float uFocusProgress;
uniform float uFocusScale;
uniform float uFocusZ;

varying vec2 vUv;
varying vec4 vRect;
varying float vAspect;
varying float vIndex;
varying float vDim;

mat3 rotY(float a) { return mat3(cos(a), 0.0, sin(a), 0.0, 1.0, 0.0, -sin(a), 0.0, cos(a)); }
mat3 rotX(float a) { return mat3(1.0, 0.0, 0.0, 0.0, cos(a), -sin(a), 0.0, sin(a), cos(a)); }

void main() {
  float PI = 3.14159265359;
  vec3 basePos = vec3(position.x * uPageWidth, position.y * uPageHeight, position.z * uPageThickness);
  vec3 rotationCenter = vec3(-uPageWidth * 0.5, 0.0, 0.0);
  float fromMiddle = aIndex - (uMeshCount - 1.0) * 0.5;
  float yAngle = -PI * 0.5 + uTurn;
  float xAngle = uTilt;
  float boxCenterZ = uPageSpacing * (-fromMiddle);
  float maxZ = uMeshCount * (uPageSpacing + uPageThickness) * 0.5;
  float bow = sin((position.y + 0.5) * 2.0) * uWave;
  float speed = clamp(uSpeedY / uPageWidth * 4.0, -2.0, 2.0);
  float zCorridor = mod(boxCenterZ - uScrollY + maxZ, 2.0 * maxZ) - maxZ - bow * speed;

  float focused = step(abs(aIndex - uFocusIndex), 0.5);
  float e = focused * uFocusProgress;
  float k = mix(1.0, uFocusScale, e);
  vec3 pivot = rotationCenter * (1.0 - e);
  vec3 vertexLocal = basePos * k - pivot;
  vertexLocal.z += zCorridor * (1.0 - e);
  vec3 rotated = rotY(yAngle * (1.0 - e)) * vertexLocal + pivot;
  rotated.z -= uPageWidth * 0.5 * (1.0 - e);
  rotated.x += uPageWidth * 0.5 * (1.0 - e);
  vec3 newPosition = rotX(xAngle * (1.0 - e)) * rotated;
  newPosition.z += uFocusZ * e;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(newPosition, 1.0);
  vUv = uv;
  vRect = aRect;
  vAspect = aAspect;
  vIndex = aIndex;
  vDim = uFocusProgress * (1.0 - focused);
}
`;

const PAGE_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uPageAspect;
varying vec2 vUv;
varying vec4 vRect;
varying float vAspect;
varying float vDim;

void main() {
  vec2 uv = vUv;
  float s = vAspect / uPageAspect;
  float band = min(s, 1.0 / s);
  if (s >= 1.0) uv.x = (uv.x - 0.5) * band + 0.5;
  else uv.y = (uv.y - 0.5) * band + 0.5;
  vec2 atlasUv = mix(vRect.xy, vRect.zw, clamp(uv, 0.0, 1.0));
  vec4 color = texture2D(uAtlas, atlasUv);
  gl_FragColor = vec4(color.rgb * mix(1.0, ${CORRIDOR_DIM.toFixed(2)}, vDim), color.a);
}
`;

const PICK_FRAGMENT = /* glsl */ `
varying float vIndex;
void main() { gl_FragColor = vec4((vIndex + 1.0) / 255.0, 0.0, 0.0, 1.0); }
`;

export class Corridor {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 200);
  private geometry = new THREE.BoxGeometry(1, 1, 1, PAGE_SEGMENTS, PAGE_SEGMENTS, 1);
  private material: THREE.ShaderMaterial;
  private pickMaterial: THREE.ShaderMaterial;
  private mesh: THREE.InstancedMesh;
  private atlas: THREE.Texture | null = null;
  private pickTarget = new THREE.WebGLRenderTarget(1, 1);
  private pickBuffer = new Uint8Array(4);
  private rectAttr: THREE.InstancedBufferAttribute;
  private aspectAttr: THREE.InstancedBufferAttribute;

  private width = 1;
  private height = 1;
  private frameId = 0;
  private lastT = 0;
  private disposed = false;
  private running = false;
  private visible = true;
  private settingsCache: ReturnType<Corridor["computeSettings"]> | null = null;

  private scroll = { target: 0, current: 0, speed: 0 };
  private drag = { active: false, lastX: 0, id: -1 };
  private focus = { index: -1, t: 0, target: 0, reported: false };
  private tap = { x: 0, y: 0, at: 0, id: -1, hit: -1 };

  onOpen: ((index: number) => void) | null = null;
  onReady: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    private projects: PageProject[],
    private opts: CorridorOptions,
    private reducedMotion: boolean,
  ) {
    // preserveDrawingBuffer lets the liquid-glass arrows refract this canvas.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(canvas);
    this.camera.position.z = CAM_Z;
    this.scene.add(this.camera);

    const blank = new THREE.DataTexture(new Uint8Array([255, 250, 189, 255]), 1, 1, THREE.RGBAFormat);
    blank.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      vertexShader: PAGE_VERTEX,
      fragmentShader: PAGE_FRAGMENT,
      transparent: true,
      uniforms: {
        uPageThickness: { value: 0.01 },
        uPageWidth: { value: 2 },
        uPageHeight: { value: 3 },
        uMeshCount: { value: 10 },
        uPageSpacing: { value: 1 },
        uScrollY: { value: 0 },
        uSpeedY: { value: 0 },
        uWave: { value: 0.4 },
        uTilt: { value: 0 },
        uTurn: { value: 0 },
        uFocusIndex: { value: -1 },
        uFocusProgress: { value: 0 },
        uFocusScale: { value: 1 },
        uFocusZ: { value: 0 },
        uPageAspect: { value: 1.2 },
        uAtlas: { value: blank as THREE.Texture },
      },
    });
    this.pickMaterial = new THREE.ShaderMaterial({ vertexShader: PAGE_VERTEX, fragmentShader: PICK_FRAGMENT, uniforms: this.material.uniforms });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_PAGES);
    this.mesh.frustumCulled = false;

    const index = new Float32Array(MAX_PAGES).map((_, i) => i);
    this.geometry.setAttribute("aIndex", new THREE.InstancedBufferAttribute(index, 1));
    this.rectAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PAGES * 4), 4);
    this.aspectAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PAGES).fill(1.2), 1);
    this.geometry.setAttribute("aRect", this.rectAttr);
    this.geometry.setAttribute("aAspect", this.aspectAttr);
    for (let i = 0; i < MAX_PAGES; i++) this.rectAttr.setXYZW(i, 0, 0, 1, 1);
    this.scene.add(this.mesh);

    this.applySettings();
    this.loadAtlas();
  }

  get canvas() {
    return this.renderer.domElement;
  }

  private computeSettings() {
    const o = this.opts;
    const worldPerPx = VIEW_HEIGHT / Math.max(1, this.height);
    const viewAspect = Math.max(1, this.width) / Math.max(1, this.height);
    const pageWidth = o.pageWidthPx * worldPerPx;
    const pageHeight = o.pageHeightPx * worldPerPx;
    const focusZ = Math.min(CAM_Z * 0.55, pageWidth * 0.75);
    const planeHeight = (VIEW_HEIGHT * (CAM_Z - focusZ)) / CAM_Z;
    const planeWidth = planeHeight * viewAspect;
    const fill = 0.6 + clamp(o.zoom, 0, 10) * 0.04;
    const pages = clamp(this.projects.length, 4, MAX_PAGES);
    const pageSpacing = pageWidth * (0.1 + clamp(o.spacing, 0, 10) * 0.08);
    return {
      pageWidth,
      pageHeight,
      worldPerPx,
      pages,
      pageSpacing,
      thickness: pageWidth * THICKNESS_RATIO,
      tilt: (clamp(o.tilt, -45, 45) * Math.PI) / 180,
      turn: (clamp(o.turn, -60, 60) * Math.PI) / 180,
      wave: this.reducedMotion ? 0 : pageWidth * 0.04 * clamp(o.wave, 0, 10),
      lerp: 0.35 * Math.pow(0.82, clamp(o.smoothing, 0, 10)),
      driftPerSecond: this.reducedMotion ? 0 : clamp(o.drift, -10, 10) * pageWidth * 0.15,
      wheel: 0.4 + clamp(o.wheel, 0, 10) * 0.16,
      focusZ,
      focusScale: Math.min((planeHeight * fill) / pageHeight, (planeWidth * fill) / pageWidth),
      viewDuration: this.reducedMotion ? 0.05 : 1.6 - clamp(o.speed, 0, 10) * 0.13,
    };
  }

  private settings() {
    this.settingsCache ??= this.computeSettings();
    return this.settingsCache;
  }

  private applySettings() {
    const S = this.settings();
    const u = this.material.uniforms;
    this.mesh.count = S.pages;
    u.uMeshCount.value = S.pages;
    u.uPageWidth.value = S.pageWidth;
    u.uPageHeight.value = S.pageHeight;
    u.uPageThickness.value = S.thickness;
    u.uPageSpacing.value = S.pageSpacing;
    u.uWave.value = S.wave;
    u.uTilt.value = S.tilt;
    u.uTurn.value = S.turn;
    u.uPageAspect.value = this.opts.pageWidthPx / this.opts.pageHeightPx;
    u.uFocusScale.value = S.focusScale;
    u.uFocusZ.value = S.focusZ;
  }

  private async loadAtlas() {
    const aspect = this.opts.pageWidthPx / this.opts.pageHeightPx;
    const { canvas, cells } = await paintAtlas(this.projects, aspect, this.renderer.capabilities.maxTextureSize);
    if (this.disposed) return;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    this.atlas = tex;
    this.material.uniforms.uAtlas.value = tex;
    for (let i = 0; i < MAX_PAGES; i++) {
      const c = cells[i % cells.length];
      this.rectAttr.setXYZW(i, ...c.rect);
      this.aspectAttr.setX(i, c.aspect);
    }
    this.rectAttr.needsUpdate = true;
    this.aspectAttr.needsUpdate = true;
    this.onReady?.();
    this.renderer.render(this.scene, this.camera);
  }

  private pick(clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    if (!(u >= 0 && v >= 0 && u < 1 && v < 1)) return -1;
    const scale = Math.min(1, PICK_MAX / Math.max(this.width, this.height));
    const tw = Math.max(1, Math.round(this.width * scale));
    const th = Math.max(1, Math.round(this.height * scale));
    if (this.pickTarget.width !== tw || this.pickTarget.height !== th) this.pickTarget.setSize(tw, th);
    const previous = this.mesh.material;
    this.mesh.material = this.pickMaterial;
    this.renderer.setRenderTarget(this.pickTarget);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.pickTarget, Math.min(tw - 1, Math.floor(u * tw)), Math.min(th - 1, Math.floor((1 - v) * th)), 1, 1, this.pickBuffer);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    this.mesh.material = previous;
    const hit = this.pickBuffer[0] - 1;
    return hit >= 0 && hit < this.settings().pages ? hit : -1;
  }

  /** Bring a page forward; when it arrives, onOpen fires. */
  open(index: number) {
    if (index < 0 || index >= this.settings().pages) return;
    this.focus = { index, t: 0, target: 1, reported: false };
    this.wake();
  }

  /** Move the corridor by whole pages (negative = back). */
  stepPages(n: number) {
    const S = this.settings();
    this.push(n * (S.pageSpacing + S.thickness));
    this.wake();
  }

  private push(worldDelta: number) {
    if (!isFinite(worldDelta)) return;
    this.scroll.target += worldDelta;
    this.scroll.speed += worldDelta;
  }

  private onWheel = (e: WheelEvent) => {
    // Only horizontal gestures move the corridor; vertical scrolling stays with the page.
    if (this.focus.index >= 0 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
    const S = this.settings();
    this.push(e.deltaX * scale * S.worldPerPx * S.wheel);
    this.wake();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.disposed || e.button !== 0) return;
    this.tap = { x: e.clientX, y: e.clientY, at: performance.now(), id: e.pointerId, hit: this.focus.index < 0 ? this.pick(e.clientX, e.clientY) : -1 };
    this.container.setPointerCapture?.(e.pointerId);
    if (this.focus.index >= 0) return;
    this.drag = { active: true, lastX: e.clientX, id: e.pointerId };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag.active || e.pointerId !== this.drag.id) return;
    const delta = this.drag.lastX - e.clientX;
    this.drag.lastX = e.clientX;
    const S = this.settings();
    this.push(delta * 2 * S.worldPerPx * S.wheel);
    this.wake();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.drag.id) this.drag = { active: false, lastX: 0, id: -1 };
    if (e.pointerId !== this.tap.id) return;
    this.container.releasePointerCapture?.(e.pointerId);
    this.tap.id = -1;
    const moved = Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y);
    if (moved <= TAP_SLOP && performance.now() - this.tap.at <= TAP_MS) {
      if (this.focus.index >= 0) this.focus.target = 0;
      else if (this.tap.hit >= 0) this.open(this.tap.hit);
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === this.drag.id) this.drag = { active: false, lastX: 0, id: -1 };
    if (e.pointerId === this.tap.id) this.tap.id = -1;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.focus.index >= 0) this.focus.target = 0;
  };

  private onVisibility = () => this.wake();

  setVisible(v: boolean) {
    this.visible = v;
    this.wake();
  }

  setSize(width: number, height: number) {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.settingsCache = null;
    this.applySettings();
    this.renderer.render(this.scene, this.camera);
  }

  updateOptions(opts: CorridorOptions) {
    this.opts = opts;
    this.settingsCache = null;
    this.applySettings();
    this.wake();
  }

  start() {
    const node = this.container;
    node.addEventListener("wheel", this.onWheel, { passive: false });
    node.addEventListener("pointerdown", this.onPointerDown);
    node.addEventListener("pointermove", this.onPointerMove);
    node.addEventListener("pointerup", this.onPointerUp);
    node.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.wake();
  }

  private wake() {
    if (this.disposed || this.running || !this.visible || document.hidden) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = () => {
      if (this.disposed || !this.visible || document.hidden) {
        this.running = false;
        return;
      }
      this.frameId = requestAnimationFrame(loop);
      this.step();
    };
    this.frameId = requestAnimationFrame(loop);
  }

  private step() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    const S = this.settings();
    const u = this.material.uniforms;

    if (this.focus.index >= 0) {
      const rate = dt / Math.max(0.05, S.viewDuration);
      this.focus.t = clamp(this.focus.t + (this.focus.target ? rate : -rate), 0, 1);
      if (this.focus.t === 1 && this.focus.target === 1 && !this.focus.reported) {
        this.focus.reported = true;
        this.onOpen?.(this.focus.index);
      }
      if (this.focus.t === 0 && this.focus.target === 0) this.focus.index = -1;
    }
    u.uFocusIndex.value = this.focus.index;
    u.uFocusProgress.value = power2InOut(this.focus.t);
    this.container.style.cursor = this.focus.index >= 0 ? "zoom-out" : this.drag.active ? "grabbing" : "grab";

    if (S.driftPerSecond !== 0 && this.focus.index < 0 && !this.drag.active) this.push(S.driftPerSecond * dt);
    const k = dt * 60;
    this.scroll.current += (this.scroll.target - this.scroll.current) * (1 - Math.pow(1 - S.lerp, k));
    this.scroll.speed *= Math.pow(0.835, k);
    const period = S.pages * (S.pageSpacing + S.thickness);
    if (Math.abs(this.scroll.current) > period) {
      const wrap = Math.sign(this.scroll.current) * period;
      this.scroll.current -= wrap;
      this.scroll.target -= wrap;
    }
    u.uScrollY.value = this.scroll.current;
    u.uSpeedY.value = this.scroll.speed;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    const node = this.container;
    node.removeEventListener("wheel", this.onWheel);
    node.removeEventListener("pointerdown", this.onPointerDown);
    node.removeEventListener("pointermove", this.onPointerMove);
    node.removeEventListener("pointerup", this.onPointerUp);
    node.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.geometry.dispose();
    this.material.dispose();
    this.pickMaterial.dispose();
    this.pickTarget.dispose();
    this.atlas?.dispose();
    this.mesh.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
