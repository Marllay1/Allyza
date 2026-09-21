// Builds every brand asset from the official logo (assets/logo-source.jpg).
//  - transparent "cut-outs" of the mark / lockup (dark theme colours as designed)
//  - recoloured light-theme variants (same shapes, plum/rose tones for ivory backgrounds)
//  - app icons, maskable icon, apple-touch, favicons, social image
// Run: node scripts/make-brand.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const SRC = path.join(root, "assets", "logo-source.jpg");
const out = (p) => path.join(root, "public", p);
fs.mkdirSync(out("brand"), { recursive: true });
fs.mkdirSync(out("icons"), { recursive: true });

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

// Local background estimate: the source is a dark vignette, so a wide blur of the image
// (with the bright artwork clamped away) tells us the "paper" colour under each pixel.
const clamped = Buffer.from(data);
for (let i = 0; i < clamped.length; i += 3) {
  const m = Math.max(clamped[i], clamped[i + 1], clamped[i + 2]);
  if (m > 70) { const k = 70 / m; clamped[i] *= k; clamped[i + 1] *= k; clamped[i + 2] *= k; }
}
const bg = await sharp(clamped, { raw: { width: W, height: H, channels: 3 } }).blur(60).raw().toBuffer();

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Hole-filled alpha for the mark (the dark shading between the figures must read as solid on light grounds).
const rawAlpha = Buffer.alloc(W * H);
for (let p = 0; p < W * H; p++) {
  const d = Math.max(data[p*3] - bg[p*3], data[p*3+1] - bg[p*3+1], data[p*3+2] - bg[p*3+2]);
  rawAlpha[p] = Math.round(smooth(14, 58, d) * 255);
}
// Morphological closing (dilate then erode) fills the narrow dark gaps inside the mark without moving its outer edge.
const bin = (buf, thr) => { const o = Buffer.alloc(buf.length); for (let i = 0; i < buf.length; i++) o[i] = buf[i] > thr ? 255 : 0; return o; };
const blur1 = (buf, sigma) => sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
const dilated = bin(await blur1(bin(rawAlpha, 100), 10), 30);
const closed = bin(await blur1(dilated, 10), 226);
const softAlpha = await blur1(closed, 1.1);
const smoothTone = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).blur(1.2).raw().toBuffer();
const MARK_BOTTOM = 690;

// mode "dark": keep artwork colours. mode "light": remap tone to plum→rose→peach-deep for ivory grounds.
function cutout(mode) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    const d = Math.max(r - bg[p * 3], g - bg[p * 3 + 1], b - bg[p * 3 + 2]);
    let a = smooth(14, 58, d);
    const inMark = mode === "light" && Math.floor(p / W) < MARK_BOTTOM;
    if (inMark) a = Math.max(smooth(14, 58, d), softAlpha[p] / 255); // closed silhouette: dark shading between figures is solid
    let R = r, G = g, B = b;
    if (a > 0 && a < 1) { // un-premultiply edge pixels against the local background
      R = Math.min(255, Math.max(0, bg[p * 3] + (r - bg[p * 3]) / Math.max(a, 0.35)));
      G = Math.min(255, Math.max(0, bg[p * 3 + 1] + (g - bg[p * 3 + 1]) / Math.max(a, 0.35)));
      B = Math.min(255, Math.max(0, bg[p * 3 + 2] + (b - bg[p * 3 + 2]) / Math.max(a, 0.35)));
    }
    if (mode === "light") {
      const src = inMark ? smoothTone : data;
      const lum = (0.3 * src[p*3] + 0.59 * src[p*3+1] + 0.11 * src[p*3+2]) / 255; // ~0.35 (violet) .. ~0.9 (peach)
      const t = Math.min(1, Math.max(0, (lum - 0.3) / 0.6));
      // deep plum (#5b2a63) → rose (#b9587a) → warm terracotta-rose (#d98a78)
      const stops = [[88, 40, 104], [176, 78, 128], [214, 122, 150]];
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const A = t < 0.5 ? stops[0] : stops[1], Bc = t < 0.5 ? stops[1] : stops[2];
      R = lerp(A[0], Bc[0], k); G = lerp(A[1], Bc[1], k); B = lerp(A[2], Bc[2], k);
    }
    rgba[p * 4] = R; rgba[p * 4 + 1] = G; rgba[p * 4 + 2] = B; rgba[p * 4 + 3] = Math.round(a * 255);
  }
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
}

const regions = {
  mark: { left: 405, top: 205, width: 400, height: 440 },
  lockup: { left: 255, top: 205, width: 730, height: 705 },
  tagline: { left: 255, top: 905, width: 740, height: 135 },
};

for (const mode of ["dark", "light"]) {
  const base = await cutout(mode).png().toBuffer();
  for (const [name, r] of Object.entries(regions)) {
    await sharp(base).extract(r).resize({ width: Math.round(r.width * 1.5), kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(out(`brand/${name}-${mode}.png`));
  }
}

// ---- app icons: the mark centred on the logo's own night-sky ground ----
const markDark = await sharp(out("brand/mark-dark.png")).toBuffer();
const groundSvg = (size, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2a1a52"/><stop offset=".6" stop-color="#160e33"/><stop offset="1" stop-color="#0a0619"/></radialGradient></defs>
  <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="url(#g)"/></svg>`;
async function icon(size, { rounded = true, scale = 0.62 } = {}) {
  const m = await sharp(markDark).resize({ height: Math.round(size * scale), fit: "inside" }).toBuffer();
  const meta = await sharp(m).metadata();
  return sharp(Buffer.from(groundSvg(size, rounded)))
    .composite([{ input: m, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2 - size * 0.01) }])
    .png();
}
await (await icon(192)).toFile(out("icons/icon-192.png"));
await (await icon(512)).toFile(out("icons/icon-512.png"));
await (await icon(512, { rounded: false, scale: 0.5 })).toFile(out("icons/maskable-512.png")); // inside the 80% safe zone
await (await icon(180, { rounded: false, scale: 0.6 })).toFile(out("icons/apple-touch-icon.png"));
await (await icon(48, { scale: 0.78 })).toFile(out("icons/favicon-48.png"));
await (await icon(32, { scale: 0.8 })).toFile(out("icons/favicon-32.png"));
fs.copyFileSync(out("icons/favicon-48.png"), path.join(root, "src", "app", "icon.png"));
fs.writeFileSync(out("icons/icon.svg"), groundSvg(512, true).replace("</svg>", "</svg>"));

// ---- social / share image ----
const lock = await sharp(out("brand/lockup-dark.png")).resize({ height: 470 }).toBuffer();
const lm = await sharp(lock).metadata();
const tag = await sharp(out("brand/tagline-dark.png")).resize({ width: 640 }).toBuffer();
const tm = await sharp(tag).metadata();
const ogBg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="g" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#2a1a52"/><stop offset=".6" stop-color="#160e33"/><stop offset="1" stop-color="#0a0619"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`;
await sharp(Buffer.from(ogBg)).composite([
  { input: lock, left: Math.round((1200 - lm.width) / 2), top: 20 },
  { input: tag, left: Math.round((1200 - tm.width) / 2), top: 630 - tm.height - 12 },
]).png().toFile(out("brand/og.png"));

// legacy file names still referenced by the service worker shell
fs.copyFileSync(out("brand/mark-dark.png"), out("brand/allyza-mark.png"));
for (const f of ["allyza-icon.svg", "allyza-mark.svg"]) fs.rmSync(out(`brand/${f}`), { force: true });
console.log("brand assets written");
