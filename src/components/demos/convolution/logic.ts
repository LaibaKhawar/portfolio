// 2D convolution / correlation from scratch, following apply_convolution in Convolution.ipynb:
// - 'convolution' flips the kernel on both axes, 'correlation' uses it as is
// - 'same' zero-pads by (k - 1) // 2 on each side, 'valid' does not pad
// - out = (padded - k) // stride + 1, output[i, j] = sum(region * kernel)

export type Padding = "valid" | "same";
export type Mode = "convolution" | "correlation";
export type DisplayScale = "abs" | "clamp";

export interface Gray {
  data: Float64Array;
  w: number;
  h: number;
}

export interface ConvOptions {
  stride: number;
  padding: Padding;
  mode: Mode;
}

export type Kernel = number[][];

export function flipKernel(k: Kernel): Kernel {
  return k.slice().reverse().map((row) => row.slice().reverse());
}

export function effectiveKernel(k: Kernel, mode: Mode): Kernel {
  return mode === "convolution" ? flipKernel(k) : k.map((r) => r.slice());
}

export function padAmount(k: Kernel, padding: Padding): { ph: number; pw: number } {
  if (padding !== "same") return { ph: 0, pw: 0 };
  return { ph: Math.floor((k.length - 1) / 2), pw: Math.floor((k[0].length - 1) / 2) };
}

export function outputSize(w: number, h: number, k: Kernel, opts: ConvOptions): { w: number; h: number } {
  const { ph, pw } = padAmount(k, opts.padding);
  const outH = Math.floor((h + 2 * ph - k.length) / opts.stride) + 1;
  const outW = Math.floor((w + 2 * pw - k[0].length) / opts.stride) + 1;
  return { w: Math.max(0, outW), h: Math.max(0, outH) };
}

/** Value of the zero-padded image at padded coordinates (py, px). */
function at(img: Gray, py: number, px: number, ph: number, pw: number): number {
  const y = py - ph;
  const x = px - pw;
  if (y < 0 || x < 0 || y >= img.h || x >= img.w) return 0;
  return img.data[y * img.w + x];
}

/** Compute output rows [rowFrom, rowTo) into `out` (allows chunking on the main thread). */
export function convolveRows(img: Gray, kernel: Kernel, opts: ConvOptions, out: Gray, rowFrom: number, rowTo: number): void {
  const K = effectiveKernel(kernel, opts.mode);
  const kh = K.length;
  const kw = K[0].length;
  const { ph, pw } = padAmount(kernel, opts.padding);
  const s = opts.stride;
  const flat = new Float64Array(kh * kw);
  for (let a = 0; a < kh; a++) for (let b = 0; b < kw; b++) flat[a * kw + b] = K[a][b];
  for (let i = rowFrom; i < rowTo; i++) {
    for (let j = 0; j < out.w; j++) {
      let acc = 0;
      const y0 = i * s;
      const x0 = j * s;
      for (let a = 0; a < kh; a++) {
        for (let b = 0; b < kw; b++) {
          const v = flat[a * kw + b];
          if (v !== 0) acc += at(img, y0 + a, x0 + b, ph, pw) * v;
        }
      }
      out.data[i * out.w + j] = acc;
    }
  }
}

export function applyConvolution(img: Gray, kernel: Kernel, opts: ConvOptions): Gray {
  const { w, h } = outputSize(img.w, img.h, kernel, opts);
  const out: Gray = { data: new Float64Array(w * h), w, h };
  convolveRows(img, kernel, opts, out, 0, h);
  return out;
}

export interface ReceptiveField {
  /** top-left of the window in ORIGINAL image coordinates (may be negative under 'same' padding) */
  y0: number;
  x0: number;
  values: number[][]; // input values under the window (0 where padded)
  weights: number[][]; // kernel actually applied (flipped for convolution)
  products: number[][];
  sum: number;
}

/** Multiply-accumulate breakdown for output pixel (i, j). */
export function receptiveField(img: Gray, kernel: Kernel, opts: ConvOptions, i: number, j: number): ReceptiveField {
  const K = effectiveKernel(kernel, opts.mode);
  const { ph, pw } = padAmount(kernel, opts.padding);
  const py = i * opts.stride;
  const px = j * opts.stride;
  const values: number[][] = [];
  const products: number[][] = [];
  let sum = 0;
  for (let a = 0; a < K.length; a++) {
    const vr: number[] = [];
    const pr: number[] = [];
    for (let b = 0; b < K[0].length; b++) {
      const v = at(img, py + a, px + b, ph, pw);
      vr.push(v);
      pr.push(v * K[a][b]);
      sum += v * K[a][b];
    }
    values.push(vr);
    products.push(pr);
  }
  return { y0: py - ph, x0: px - pw, values, weights: K, products, sum };
}

export function absDiff(a: Gray, b: Gray): Gray {
  const out = new Float64Array(a.data.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.abs(a.data[i] - b.data[i]);
  return { data: out, w: a.w, h: a.h };
}

/**
 * Map raw output values to 0..255 bytes.
 * 'abs': |v| scaled so the largest magnitude becomes 255 (edge kernels, differences).
 * 'clamp': v clamped to [0, 255] (blur, sharpen, identity: kernels that sum to 1).
 */
export function toBytes(g: Gray, scale: DisplayScale): Uint8ClampedArray {
  const out = new Uint8ClampedArray(g.data.length);
  if (scale === "clamp") {
    for (let i = 0; i < out.length; i++) out[i] = Math.round(g.data[i]);
    return out;
  }
  let max = 0;
  for (let i = 0; i < g.data.length; i++) {
    const v = Math.abs(g.data[i]);
    if (v > max) max = v;
  }
  const f = max > 0 ? 255 / max : 0;
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.abs(g.data[i]) * f);
  return out;
}

/** Kernels whose weights sum to roughly 0 respond to change, so they are shown as |v| rescaled. */
export function autoScale(k: Kernel): DisplayScale {
  let s = 0;
  for (const r of k) for (const v of r) s += v;
  return Math.abs(s) < 1e-9 ? "abs" : "clamp";
}

/** ITU-R BT.601 luma, same weights OpenCV uses for IMREAD_GRAYSCALE. */
export function rgbaToGray(rgba: ArrayLike<number>, w: number, h: number): Gray {
  const data = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[i] = Math.round(0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]);
  }
  return { data, w, h };
}

export interface Preset {
  id: string;
  name: string;
  kernel: Kernel;
}

const g = 1 / 16;
const b = 1 / 9;

export const PRESETS: Preset[] = [
  { id: "identity", name: "Identity", kernel: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
  { id: "box", name: "Box blur", kernel: [[b, b, b], [b, b, b], [b, b, b]] },
  { id: "gauss", name: "Gaussian blur", kernel: [[g, 2 * g, g], [2 * g, 4 * g, 2 * g], [g, 2 * g, g]] },
  { id: "sharpen", name: "Sharpen", kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  { id: "sobel-x", name: "Sobel X", kernel: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
  { id: "sobel-y", name: "Sobel Y", kernel: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
  { id: "prewitt-x", name: "Prewitt X", kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] },
  { id: "laplacian", name: "Laplacian", kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]] },
  { id: "shift", name: "Asymmetric (shift)", kernel: [[0, 0, 0], [0, 0, 0], [0, 0, 1]] },
];

export function resizeKernel(k: Kernel, size: 3 | 5): Kernel {
  const old = k.length;
  if (old === size) return k.map((r) => r.slice());
  const out: Kernel = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const off = (size - old) / 2;
  for (let a = 0; a < old; a++)
    for (let c = 0; c < old; c++) {
      const y = a + off;
      const x = c + off;
      if (y >= 0 && x >= 0 && y < size && x < size) out[y][x] = k[a][c];
    }
  return out;
}
