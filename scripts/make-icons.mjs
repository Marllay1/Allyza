// Generates the Allyza brand SVGs + PNG icon set. Run: node scripts/make-icons.mjs
// The mark is: crescent moon · two intertwined soft forms · a small heart · a star,
// on a deep plum ground with champagne / rose-gold highlights.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const out = (p) => path.join(process.cwd(), "public", p);
fs.mkdirSync(out("icons"), { recursive: true });
fs.mkdirSync(out("brand"), { recursive: true });

const defs = `
  <defs>
    <radialGradient id="bg" cx="30%" cy="22%" r="95%">
      <stop offset="0" stop-color="#3b1f52"/><stop offset="0.55" stop-color="#22112f"/><stop offset="1" stop-color="#140a1c"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6e7c8"/><stop offset="0.55" stop-color="#e2c493"/><stop offset="1" stop-color="#c9959a"/>
    </linearGradient>
    <linearGradient id="rose" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0c3c4"/><stop offset="1" stop-color="#b9788a"/>
    </linearGradient>
    <mask id="moon">
      <rect width="512" height="512" fill="black"/>
      <circle cx="236" cy="256" r="164" fill="white"/>
      <circle cx="298" cy="248" r="138" fill="black"/>
    </mask>
    <clipPath id="top"><circle cx="321" cy="239.5" r="14"/></clipPath>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>`;

// The mark itself (no background). Coordinates in a 512 box.
const mark = `
  <g>
    <circle cx="236" cy="256" r="164" fill="url(#gold)" mask="url(#moon)" opacity="0.28" filter="url(#glow)"/>
    <circle cx="236" cy="256" r="164" fill="url(#gold)" mask="url(#moon)"/>
    <!-- two intertwined forms, cradled by the crescent -->
    <g transform="translate(-31 -13)">
      <g fill="none" stroke-linecap="round" stroke-width="13">
        <ellipse cx="300" cy="284" rx="58" ry="34" transform="rotate(-38 300 284)" stroke="url(#gold)"/>
        <ellipse cx="342" cy="284" rx="58" ry="34" transform="rotate(38 342 284)" stroke="url(#rose)"/>
        <!-- weave: gold passes OVER rose at the top crossing, UNDER it at the bottom one -->
        <g clip-path="url(#top)">
          <ellipse cx="300" cy="284" rx="58" ry="34" transform="rotate(-38 300 284)" stroke="url(#gold)"/>
        </g>
      </g>
      <!-- tiny heart where the forms meet -->
      <path d="M321 297 c-9 -8 -17 -14 -17 -22 a9 9 0 0 1 17 -4 a9 9 0 0 1 17 4 c0 8 -8 14 -17 22z" fill="#f4d7d4"/>
    </g>
    <!-- star -->
    <path d="M396 132 l5 15 15 5 -15 5 -5 15 -5 -15 -15 -5 15 -5z" fill="#f6e7c8"/>
    <circle cx="352" cy="118" r="3.4" fill="#f6e7c8" opacity="0.7"/>
    <circle cx="420" cy="186" r="2.6" fill="#f6e7c8" opacity="0.55"/>
  </g>`;

const icon = ({ rounded = true, pad = 0 } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${defs}
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#bg)"/>
  <g transform="translate(${256 * pad} ${256 * pad}) scale(${1 - pad})">${mark}</g>
</svg>`;

const markOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 80 400 360">${defs}${mark}</svg>`;

fs.writeFileSync(out("brand/allyza-icon.svg"), icon());
fs.writeFileSync(out("brand/allyza-mark.svg"), markOnly);
fs.writeFileSync(out("icons/icon.svg"), icon());

const png = async (svg, size, file) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(`icons/${file}`));

await png(icon(), 192, "icon-192.png");
await png(icon(), 512, "icon-512.png");
await png(icon({ rounded: false, pad: 0.18 }), 512, "maskable-512.png"); // full-bleed for Android masks
await png(icon({ rounded: false }), 180, "apple-touch-icon.png"); // iOS applies its own rounding
await png(icon(), 48, "favicon-48.png");
await png(icon(), 32, "favicon-32.png");

// Splash / social image
const splash = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  ${defs}
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(70 60) scale(0.98)">${mark}</g>
  <text x="640" y="300" fill="#f6ede3" font-family="Georgia, serif" font-size="110" letter-spacing="14">ALLYZA</text>
  <text x="644" y="365" fill="#e2c493" font-family="Georgia, serif" font-style="italic" font-size="38">Her rhythm. Our little world.</text>
</svg>`;
await sharp(Buffer.from(splash)).png().toFile(out("brand/og.png"));
fs.copyFileSync(out("icons/favicon-48.png"), path.join(process.cwd(), "src", "app", "icon.png"));
console.log("icons written");
