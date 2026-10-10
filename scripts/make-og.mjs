// Generates the default Open Graph / Twitter card image. Run: node scripts/make-og.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/public");
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#3156D3" stop-opacity="0.22"/><stop offset="1" stop-color="#F8FAFC" stop-opacity="0"/></radialGradient>
    <pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#0F172A" stroke-opacity="0.05"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#F8FAFC"/>
  <rect width="1200" height="630" fill="url(#p)"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(80 84)">
    <rect width="72" height="72" rx="18" fill="#3156D3"/>
    <circle cx="31.5" cy="31.5" r="12.4" fill="none" stroke="#fff" stroke-width="5.6"/>
    <path d="M41.6 41.6l13.5 13.5" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/>
    <circle cx="52" cy="20" r="4.5" fill="#A5B4FC"/>
    <text x="96" y="50" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#111827">Search<tspan fill="#3156D3">Distributor</tspan></text>
  </g>
  <text x="80" y="300" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="800" fill="#111827" letter-spacing="-2">Find the right distributor.</text>
  <text x="80" y="388" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="800" fill="#3156D3" letter-spacing="-2">Grow into new markets.</text>
  <text x="80" y="470" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#5B6B82">Search distributors by product, category and location.</text>
  <rect x="80" y="520" width="190" height="52" rx="12" fill="#3156D3"/>
  <text x="175" y="554" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff">Search now</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(out, "og-default.png"));
await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(path.join(out, "og-default.webp"));
console.log("OG images written to", out);
