// Paints each project as an editorial "magazine page" on a 2D canvas, packed into
// one texture atlas for the corridor. Colours and type match the site:
// cream / royal blue / red with Gloock titles, Geist body, Caveat notes.

export type PageProject = {
  slug: string;
  title: string;
  tagline: string;
  categories: string[];
  tech: string[];
  cover?: { src: string };
  demo?: string;
  liveUrl?: string;
};

export type Cell = { rect: [number, number, number, number]; aspect: number };

const COLORS = {
  cream: "#f5ebdd",
  creamDeep: "#efe2cf",
  royal: "#315b8c",
  red: "#f2765e",
  ink: "#413333",
  inkSoft: "rgba(65, 51, 51, 0.72)",
};

// Three page styles in rotation keep the corridor rhythmic.
const THEMES = [
  { bg: COLORS.cream, fg: COLORS.ink, soft: COLORS.inkSoft, accent: COLORS.red, rule: COLORS.royal },
  { bg: COLORS.royal, fg: COLORS.cream, soft: "rgba(245, 235, 221, 0.82)", accent: COLORS.cream, rule: COLORS.red },
  { bg: COLORS.creamDeep, fg: COLORS.ink, soft: COLORS.inkSoft, accent: COLORS.royal, rule: COLORS.red },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function paintPage(ctx: CanvasRenderingContext2D, p: PageProject, i: number, total: number, img: HTMLImageElement | null, x: number, y: number, W: number, H: number) {
  const t = THEMES[i % THEMES.length];
  const u = W / 100; // layout unit
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  // header: index and category
  ctx.fillStyle = t.soft;
  ctx.font = `500 ${2.6 * u}px "Geist Mono", ui-monospace, monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(`${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 6 * u, 5.5 * u);
  ctx.textAlign = "right";
  ctx.fillText(p.categories.slice(0, 2).join("  ·  ").toUpperCase(), W - 6 * u, 5.5 * u);
  ctx.textAlign = "left";
  ctx.fillStyle = t.rule;
  ctx.fillRect(6 * u, 10.5 * u, W - 12 * u, 0.35 * u);

  const textW = img ? 46 * u : W - 12 * u;

  // title
  ctx.fillStyle = t.fg;
  const titleSize = img ? 7.2 * u : 8.4 * u;
  ctx.font = `400 ${titleSize}px Gloock, Georgia, serif`;
  const titleLines = wrap(ctx, p.title, textW, 3);
  let cy = 16 * u;
  for (const l of titleLines) {
    ctx.fillText(l, 6 * u, cy);
    cy += titleSize * 1.08;
  }

  // accent rule
  cy += 1.6 * u;
  ctx.fillStyle = t.accent;
  ctx.fillRect(6 * u, cy, 9 * u, 0.9 * u);
  cy += 4 * u;

  // tagline
  ctx.fillStyle = t.soft;
  ctx.font = `400 ${3.3 * u}px Geist, system-ui, sans-serif`;
  for (const l of wrap(ctx, p.tagline, textW, img ? 5 : 3)) {
    ctx.fillText(l, 6 * u, cy);
    cy += 3.3 * u * 1.4;
  }

  // cover
  if (img) drawCover(ctx, img, 56 * u, 15 * u, 38 * u, H - 30 * u, 2.2 * u);

  // footer: tech and live marks
  const fy = H - 9 * u;
  ctx.font = `500 ${2.5 * u}px "Geist Mono", ui-monospace, monospace`;
  ctx.fillStyle = t.soft;
  ctx.fillText(p.tech.slice(0, 3).join("  ·  "), 6 * u, fy);
  const tag = p.demo ? "LIVE DEMO" : p.liveUrl ? "LIVE" : "";
  if (tag) {
    const tw = ctx.measureText(tag).width + 3 * u;
    const tx = W - 6 * u - tw;
    ctx.fillStyle = COLORS.red;
    roundRect(ctx, tx, fy - 1.2 * u, tw, 4.8 * u, 2.4 * u);
    ctx.fill();
    ctx.fillStyle = COLORS.ink; // brown on coral reads at 4.3:1; cream would not
    ctx.fillText(tag, tx + 1.5 * u, fy);
  }
  ctx.fillStyle = t.accent;
  ctx.font = `600 ${4.2 * u}px Caveat, cursive`;
  ctx.textAlign = "right";
  ctx.fillText("open →", W - 6 * u, fy - 7.5 * u);
  ctx.restore();
}

/** Paint all pages into one square-celled atlas. Returns the canvas and per-page UV rects. */
export async function paintAtlas(projects: PageProject[], pageAspect: number, maxTexture: number) {
  await Promise.all([
    document.fonts.load('400 40px "Gloock"'),
    document.fonts.load('600 40px "Caveat"'),
    document.fonts.load('400 20px "Geist"'),
    document.fonts.load('500 20px "Geist Mono"'),
  ]).catch(() => undefined);
  const images = await Promise.all(projects.map((p) => (p.cover ? loadImage(p.cover.src) : Promise.resolve(null))));

  const n = Math.max(1, projects.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const atlasMax = Math.min(8192, maxTexture);
  const cell = Math.min(1024, Math.floor(atlasMax / Math.max(cols, rows)));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d")!;
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    const w = pageAspect >= 1 ? cell : cell * pageAspect;
    const h = pageAspect >= 1 ? cell / pageAspect : cell;
    const dx = cx + (cell - w) / 2;
    const dy = cy + (cell - h) / 2;
    paintPage(ctx, projects[i], i, n, images[i], dx, dy, w, h);
    const u0 = (dx + 1) / canvas.width;
    const u1 = (dx + w - 1) / canvas.width;
    const vTop = 1 - (dy + 1) / canvas.height;
    const vBottom = 1 - (dy + h - 1) / canvas.height;
    cells.push({ rect: [u0, vBottom, u1, vTop], aspect: pageAspect });
  }
  return { canvas, cells };
}
