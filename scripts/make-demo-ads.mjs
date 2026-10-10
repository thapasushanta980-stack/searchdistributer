// Generates ORIGINAL demo ad creatives (fictional advertisers, illustrated products, no stock imagery).
// Local-development fixtures only: run `node scripts/make-demo-ads.mjs`.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/public/ads");
fs.mkdirSync(out, { recursive: true });
const F = "Arial, Helvetica, sans-serif";

/* ------------------------------------------------------------------ */
/* Illustrated products. Each is drawn around (0,0), about 520 tall.    */
/* ------------------------------------------------------------------ */

const shadow = (w = 150) => `<ellipse cx="0" cy="276" rx="${w}" ry="20" fill="#000" opacity=".28"/>`;

const ART = {
  bottle: (a, b) => `
    ${shadow(120)}
    <defs>
      <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="${b}" stop-opacity=".55"/><stop offset="1" stop-color="${a}" stop-opacity=".9"/></linearGradient>
      <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#0B1230"/></linearGradient>
    </defs>
    <rect x="-36" y="-262" width="72" height="50" rx="12" fill="url(#cap)"/>
    <path d="M-32 -212 H32 C32 -168 84 -158 84 -96 H-84 C-84 -158 -32 -168 -32 -212Z" fill="url(#glass)"/>
    <rect x="-84" y="-100" width="168" height="374" rx="36" fill="url(#glass)"/>
    <rect x="-84" y="-30" width="168" height="150" fill="${a}" opacity=".92"/>
    <circle cx="0" cy="45" r="44" fill="#fff" opacity=".95"/><path d="M-18 55 Q0 20 18 55 Q0 70 -18 55Z" fill="${a}"/>
    <rect x="-66" y="-170" width="14" height="330" rx="7" fill="#fff" opacity=".45"/>
    <circle cx="-100" cy="-20" r="9" fill="#fff" opacity=".7"/><circle cx="104" cy="60" r="12" fill="#fff" opacity=".6"/><circle cx="98" cy="-70" r="6" fill="#fff" opacity=".8"/>`,

  food: (a, b) => `
    ${shadow(160)}
    <defs><linearGradient id="bx" x1="0" x2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
    <path d="M-120 -140 L-70 -190 H150 L100 -140Z" fill="${b}"/>
    <rect x="-120" y="-140" width="220" height="400" rx="16" fill="url(#bx)"/>
    <path d="M100 -140 L150 -190 V210 L100 260Z" fill="${a}" opacity=".78"/>
    <circle cx="-10" cy="-30" r="78" fill="#fff"/>
    <path d="M-52 -26 Q-10 -86 32 -26 Q-10 -6 -52 -26Z" fill="${a}"/><circle cx="-10" cy="-6" r="8" fill="${a}"/>
    <rect x="-96" y="86" width="172" height="16" rx="8" fill="#fff" opacity=".9"/><rect x="-96" y="116" width="120" height="14" rx="7" fill="#fff" opacity=".6"/>
    <rect x="-96" y="150" width="172" height="62" rx="12" fill="#fff" opacity=".18"/>
    <path d="M-102 -110 L-86 -110 L-86 230" stroke="#fff" stroke-opacity=".4" stroke-width="10" fill="none" stroke-linecap="round"/>`,

  pharma: (a, b) => `
    ${shadow(120)}
    <defs><linearGradient id="pb" x1="0" x2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
    <rect x="-96" y="-250" width="192" height="70" rx="18" fill="#fff"/>
    <rect x="-96" y="-208" width="192" height="12" fill="#000" opacity=".08"/>
    <rect x="-84" y="-180" width="168" height="450" rx="28" fill="url(#pb)"/>
    <rect x="-84" y="-80" width="168" height="230" fill="#fff"/>
    <rect x="-18" y="-48" width="36" height="110" rx="8" fill="${a}"/><rect x="-55" y="-11" width="110" height="36" rx="8" fill="${a}"/>
    <rect x="-60" y="92" width="120" height="12" rx="6" fill="${a}" opacity=".35"/>
    <rect x="-66" y="-160" width="14" height="410" rx="7" fill="#fff" opacity=".4"/>
    <g transform="translate(150 205) rotate(-28)"><rect x="-60" y="-24" width="120" height="48" rx="24" fill="#fff"/><path d="M0 -24 H36 a24 24 0 0 1 0 48 H0Z" fill="${a}"/></g>
    <g transform="translate(-170 215) rotate(24)"><rect x="-50" y="-20" width="100" height="40" rx="20" fill="#fff"/><path d="M0 -20 H30 a20 20 0 0 1 0 40 H0Z" fill="${b}"/></g>`,

  auto: (a, b) => `
    ${shadow(170)}
    <defs><radialGradient id="rot" cx=".35" cy=".3"><stop offset="0" stop-color="#F8FAFC"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="#334155"/></radialGradient></defs>
    <circle cx="0" cy="0" r="200" fill="url(#rot)"/>
    <circle cx="0" cy="0" r="200" fill="none" stroke="${a}" stroke-width="10"/>
    <circle cx="0" cy="0" r="132" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>
    <circle cx="0" cy="0" r="70" fill="#1E293B"/><circle cx="0" cy="0" r="46" fill="${a}"/><circle cx="0" cy="0" r="16" fill="#fff"/>
    ${Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2; return `<circle cx="${Math.cos(t) * 100}" cy="${Math.sin(t) * 100}" r="13" fill="#1E293B"/>`; }).join("")}
    ${Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return `<circle cx="${Math.cos(t) * 164}" cy="${Math.sin(t) * 164}" r="9" fill="#475569" opacity=".7"/>`; }).join("")}
    <path d="M-150 -120 A190 190 0 0 1 20 -190" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none" opacity=".55"/>`,

  skin: (a, b) => `
    ${shadow(170)}
    <defs>
      <linearGradient id="jar" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <linearGradient id="lid" x1="0" x2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#B45309"/></linearGradient>
    </defs>
    <rect x="-130" y="-30" width="260" height="70" rx="22" fill="url(#lid)"/>
    <rect x="-118" y="40" width="236" height="210" rx="40" fill="url(#jar)"/>
    <rect x="-118" y="100" width="236" height="96" fill="${a}" opacity=".9"/>
    <circle cx="0" cy="148" r="30" fill="#fff"/><path d="M0 128 q22 20 0 40 q-22 -20 0 -40z" fill="${a}"/>
    <rect x="-100" y="58" width="12" height="170" rx="6" fill="#fff" opacity=".6"/>
    <g transform="translate(-150 -170) rotate(-16)">
      <rect x="-42" y="-96" width="84" height="40" rx="10" fill="url(#lid)"/>
      <path d="M-42 -56 H42 L30 130 Q0 150 -30 130Z" fill="${a}"/>
      <rect x="-26" y="-20" width="52" height="64" rx="10" fill="#fff" opacity=".9"/>
    </g>`,
};

const sparkle = (x, y, s, o = 0.9) => `<path d="M${x} ${y - s} Q${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} Q${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} Q${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} Q${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z" fill="#FDE68A" opacity="${o}"/>`;

const backdrop = (w, h, bg1, bg2, glowX, glowY) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <radialGradient id="glow" cx="${glowX}" cy="${glowY}" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" opacity=".18"/></pattern>
    <filter id="ts" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".35"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <polygon points="${w * 0.55},0 ${w * 0.78},0 ${w * 0.5},${h} ${w * 0.3},${h}" fill="#fff" opacity=".06"/>
  <polygon points="${w * 0.72},0 ${w * 0.84},0 ${w * 0.64},${h} ${w * 0.56},${h}" fill="#fff" opacity=".05"/>`;

const cluster = (kind, a, b, scale) => `
  <g transform="scale(${scale})">
    <g transform="translate(-250 40) scale(.62)" opacity=".92">${ART[kind](a, b)}</g>
    <g transform="translate(250 60) scale(.6)" opacity=".92">${ART[kind](a, b)}</g>
    <g>${ART[kind](a, b)}</g>
  </g>`;

const sticker = (x, y, r, color, l1, l2) => `
  <g transform="translate(${x} ${y}) rotate(-12)" filter="url(#ts)">
    <circle r="${r}" fill="${color}"/><circle r="${r - 8}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/>
    <text y="${-r * 0.08}" text-anchor="middle" font-family="${F}" font-size="${r * 0.24}" font-weight="900" fill="#fff">${l1}</text>
    <text y="${r * 0.3}" text-anchor="middle" font-family="${F}" font-size="${r * 0.24}" font-weight="900" fill="#FDE68A">${l2}</text>
  </g>`;

const hero = ({ kind, bg1, bg2, a, b, brand, kicker, l1, l2, sub, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640">
  ${backdrop(1600, 640, bg1, bg2, 0.78, 0.5)}
  <circle cx="1240" cy="320" r="270" fill="#fff" opacity=".1"/><circle cx="1240" cy="320" r="190" fill="#fff" opacity=".08"/>
  ${sparkle(980, 90, 26)}${sparkle(1500, 120, 18)}${sparkle(1010, 560, 16, 0.7)}${sparkle(1530, 500, 24)}
  <g transform="translate(1180 318)">${cluster(kind, a, b, 0.98)}</g>
  ${sticker(1450, 118, 78, accent, "OPEN FOR", "PARTNERS")}
  <g filter="url(#ts)">
    <text x="84" y="108" font-family="${F}" font-size="30" font-weight="800" fill="#fff" letter-spacing="2">${brand}</text>
  </g>
  <rect x="84" y="140" width="${kicker.length * 17 + 40}" height="40" rx="20" fill="#fff" opacity=".18"/>
  <text x="104" y="167" font-family="${F}" font-size="20" font-weight="800" fill="#fff" letter-spacing="3">${kicker}</text>
  <g filter="url(#ts)">
    <text x="82" y="288" font-family="${F}" font-size="104" font-weight="900" fill="#fff" letter-spacing="-4">${l1}</text>
    <text x="82" y="392" font-family="${F}" font-size="104" font-weight="900" fill="#FDE68A" letter-spacing="-4">${l2}</text>
  </g>
  <text x="84" y="450" font-family="${F}" font-size="29" fill="#fff" opacity=".92">${sub}</text>
  <g filter="url(#ts)">
    <rect x="84" y="488" width="470" height="80" rx="40" fill="#fff"/>
    <text x="290" y="538" text-anchor="middle" font-family="${F}" font-size="25" font-weight="900" fill="${bg1}" letter-spacing=".5">BECOME A DISTRIBUTOR</text>
    <circle cx="510" cy="528" r="22" fill="${bg1}"/><path d="M501 528 H519 M512 520 L520 528 L512 536" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <rect x="578" y="488" width="210" height="80" rx="40" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
  <text x="683" y="538" text-anchor="middle" font-family="${F}" font-size="24" font-weight="800" fill="#fff">Contact us</text>
</svg>`;

const card = ({ kind, bg1, bg2, a, b, brand, h1, h2, sub }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500">
  ${backdrop(1000, 500, bg1, bg2, 0.8, 0.5)}
  <circle cx="800" cy="260" r="210" fill="#fff" opacity=".1"/>
  ${sparkle(640, 70, 20)}${sparkle(950, 90, 14)}${sparkle(930, 440, 18, 0.8)}
  <g transform="translate(800 262)">${cluster(kind, a, b, 0.62)}</g>
  <g filter="url(#ts)">
    <text x="80" y="82" font-family="${F}" font-size="24" font-weight="800" fill="#fff" letter-spacing="2">${brand}</text>
    <text x="78" y="196" font-family="${F}" font-size="72" font-weight="900" fill="#fff" letter-spacing="-3">${h1}</text>
    <text x="78" y="272" font-family="${F}" font-size="72" font-weight="900" fill="#FDE68A" letter-spacing="-3">${h2}</text>
  </g>
  <text x="80" y="322" font-family="${F}" font-size="24" fill="#fff" opacity=".92">${sub}</text>
  <g filter="url(#ts)">
    <rect x="80" y="362" width="360" height="70" rx="35" fill="#fff"/>
    <text x="260" y="407" text-anchor="middle" font-family="${F}" font-size="21" font-weight="900" fill="${bg1}">BECOME A DISTRIBUTOR</text>
  </g>
</svg>`;

const jobs = [
  ["demo-hero-1", hero({ kind: "food", bg1: "#9A3412", bg2: "#F97316", a: "#EA580C", b: "#FED7AA", brand: "HIMAL FRESH FOODS", kicker: "DISTRIBUTORSHIP OPEN", l1: "Fresh taste,", l2: "every shelf.", sub: "Packaged foods for retail across Gandaki and Lumbini.", accent: "#DC2626" })],
  ["demo-hero-2", hero({ kind: "bottle", bg1: "#0B1B5A", bg2: "#2563EB", a: "#1D4ED8", b: "#BFDBFE", brand: "EVEREST BEVERAGE", kicker: "COLD-CHAIN SUPPLY", l1: "Thirst has", l2: "no limits.", sub: "Bottled water and juices for hotels, cafes and retail.", accent: "#0EA5E9" })],
  ["demo-hero-3", hero({ kind: "pharma", bg1: "#065F46", bg2: "#10B981", a: "#059669", b: "#A7F3D0", brand: "SAGARMATHA PHARMA", kicker: "LICENSED DISTRIBUTION", l1: "Care that", l2: "reaches far.", sub: "Temperature-controlled storage and pharmacy delivery.", accent: "#047857" })],
  ["demo-card-1", card({ kind: "auto", bg1: "#312E81", bg2: "#7C3AED", a: "#F59E0B", b: "#CBD5E1", brand: "LUMBINI AUTO PARTS", h1: "Dealers", h2: "wanted.", sub: "Two-wheeler spares, western Nepal." })],
  ["demo-card-2", card({ kind: "skin", bg1: "#9D174D", bg2: "#F472B6", a: "#BE185D", b: "#FCE7F3", brand: "GORKHA SKIN CARE", h1: "Grow with", h2: "skincare.", sub: "Salon and pharmacy network." })],
];

for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(path.join(out, `${name}.webp`));
}
console.log(`Wrote ${jobs.length} demo creatives to ${out}`);
