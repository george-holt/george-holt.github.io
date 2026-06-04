// Regenerates all favicon assets from img/GH Monogram Simple.svg.
// Dark monogram is centered on a white square with padding.
// Run with: node scripts/generate-favicons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico").default;

const root = path.resolve(__dirname, "..");
const srcSvg = path.join(root, "img", "GH Monogram Simple.svg");

// Fraction of the canvas the glyph occupies (rest is padding).
const SCALE = 0.72;
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

// Render the source SVG, fit it into a padded inner box, and composite
// it centered onto a white square of the given size.
async function renderPng(size) {
  const inner = Math.round(size * SCALE);
  const glyph = await sharp(srcSvg, { density: 200, limitInputPixels: false })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toBuffer();
}

// Build a self-contained favicon.svg: white square background with the
// monogram nested and centered with the same padding.
function buildSvg() {
  const raw = fs.readFileSync(srcSvg, "utf8");
  const inner = raw.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const vbW = 138.20619;
  const vbH = 148.22002;
  const box = 100 * SCALE;
  const w = (box * vbW) / Math.max(vbW, vbH);
  const h = (box * vbH) / Math.max(vbW, vbH);
  const x = (100 - w) / 2;
  const y = (100 - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#ffffff"/>
  <svg x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" viewBox="0 0 ${vbW} ${vbH}">${inner}</svg>
</svg>
`;
}

async function main() {
  // Vector favicon
  fs.writeFileSync(path.join(root, "favicon.svg"), buildSvg());
  console.log("wrote favicon.svg");

  // Raster PNGs
  const pngTargets = {
    "favicon-96x96.png": 96,
    "apple-touch-icon.png": 180,
    "web-app-manifest-192x192.png": 192,
    "web-app-manifest-512x512.png": 512,
  };
  for (const [name, size] of Object.entries(pngTargets)) {
    fs.writeFileSync(path.join(root, name), await renderPng(size));
    console.log("wrote", name);
  }

  // favicon.ico (16/32/48)
  const icoBufs = await Promise.all([16, 32, 48].map(renderPng));
  fs.writeFileSync(path.join(root, "favicon.ico"), await pngToIco(icoBufs));
  console.log("wrote favicon.ico");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
