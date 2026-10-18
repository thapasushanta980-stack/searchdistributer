import sharp, { type OutputInfo, type OverlayOptions } from "sharp";
import type { Slide } from "./topics.js";

const W = 1080;
const H = 1920;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface RenderAssets {
  logo?: Buffer;
  /** Screenshot for this slide, shown in a phone frame. */
  screenshot?: Buffer;
}

/** Greedy word-wrap by approximate character count (SVG cannot measure text). */
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const texts = (items: { x: number; y: number; size: number; weight?: number; fill: string; t: string }[]) =>
  items.map((i) => `<text x="${i.x}" y="${i.y}" font-size="${i.size}" font-weight="${i.weight ?? 400}" fill="${i.fill}">${esc(i.t)}</text>`).join("");

function frame(inner: string, hasLogo: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, Helvetica, sans-serif">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1f4d"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="930" cy="260" r="260" fill="#ffffff" opacity="0.06"/>
  ${hasLogo ? "" : `<text x="90" y="200" font-size="56" font-weight="800" fill="#67e8f9">NURVEXA LABS</text>`}
  ${inner}
</svg>`;
}

/** Text-only layout. */
function textSvg(slide: Slide, hasLogo: boolean): string {
  const titleLines = wrap(slide.title, 20);
  let y = 560;
  const title = texts(titleLines.map((t, i) => ({ x: 90, y: y + i * 110, size: 92, weight: 800, fill: "#ffffff", t })));
  y += titleLines.length * 110 + 80;
  const body = texts(
    slide.lines
      .flatMap((l) => wrap(l, 32).map((t, i) => ({ t, first: i === 0 })))
      .map((l, i) => ({ x: l.first ? 90 : 120, y: y + i * 78, size: 54, fill: "#d6e4ff", t: l.t })),
  );
  return frame(
    `<text x="90" y="470" font-size="44" font-weight="700" fill="#fbbf24">${esc(slide.kicker)}</text>${title}${body}
     <text x="90" y="1760" font-size="44" font-weight="700" fill="#67e8f9">nurvexalabs.com</text>`,
    hasLogo,
  );
}

const PHONE = { x: 270, y: 640, w: 540, h: 1100, r: 70, bezel: 18 };

/** Layout with a phone frame: headline up top, screenshot composited into the frame afterwards. */
function phoneSvg(slide: Slide, hasLogo: boolean): string {
  const titleLines = wrap(slide.title, 26).slice(0, 2);
  const title = texts(titleLines.map((t, i) => ({ x: 90, y: 400 + i * 82, size: 70, weight: 800, fill: "#ffffff", t })));
  const sub = texts(wrap(slide.lines[0] ?? "", 44).slice(0, 1).map((t) => ({ x: 90, y: 400 + titleLines.length * 82 + 20, size: 40, fill: "#d6e4ff", t })));
  const p = PHONE;
  return frame(
    `${title}${sub}
     <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r}" fill="#0a0f1f" stroke="#67e8f9" stroke-width="4"/>
     <text x="90" y="1810" font-size="44" font-weight="700" fill="#67e8f9">nurvexalabs.com</text>
     <text x="990" y="1810" font-size="40" font-weight="700" fill="#fbbf24" text-anchor="end">${esc(slide.kicker)}</text>`,
    hasLogo,
  );
}

export async function renderSlide(slide: Slide, assets: RenderAssets = {}): Promise<Buffer> {
  const hasLogo = !!assets.logo;
  const base = sharp(Buffer.from(assets.screenshot ? phoneSvg(slide, hasLogo) : textSvg(slide, hasLogo)));
  const layers: OverlayOptions[] = [];

  if (assets.logo) {
    const logo = await sharp(assets.logo).resize({ height: 110, width: 420, fit: "inside" }).png().toBuffer();
    layers.push({ input: logo, left: 90, top: 150 });
  }
  if (assets.screenshot) {
    const p = PHONE;
    const iw = p.w - p.bezel * 2;
    const ih = p.h - p.bezel * 2;
    const shot = await sharp(assets.screenshot).resize({ width: iw, height: ih, fit: "cover", position: "top" }).png().toBuffer();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}"><rect width="${iw}" height="${ih}" rx="${p.r - p.bezel}" fill="#fff"/></svg>`);
    const rounded = await sharp(shot).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: rounded, left: p.x + p.bezel, top: p.y + p.bezel });
  }
  return base.composite(layers).png().toBuffer();
}
