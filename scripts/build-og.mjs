// Generate an OpenGraph mosaic image (1200x630) from a grid of portrait photos.
// Each tile shows a different country, cycling through the six subject types.

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, "..", "images");
const outFile = join(__dirname, "..", "public", "og.jpg");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const COLS = 8;
const ROWS = 3;

const TILE_W = Math.floor(OG_WIDTH / COLS); // 150
const TILE_H = Math.floor(OG_HEIGHT / ROWS); // 210

const SUBJECTS = [
  "man",
  "woman",
  "nonbinary",
  "elderly-man",
  "elderly-woman",
  "child",
];

// Simple seeded PRNG so the mosaic is deterministic
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Gather one image per country with varied subjects
// ---------------------------------------------------------------------------

const files = readdirSync(imagesDir).filter((f) => f.endsWith(".jpg"));

// Group files by country slug
const byCountry = new Map();
for (const file of files) {
  const slug = file.replace(".jpg", "");
  for (const subj of [...SUBJECTS].sort((a, b) => b.length - a.length)) {
    if (slug.endsWith(`-${subj}`)) {
      const country = slug.slice(0, slug.length - subj.length - 1);
      if (!byCountry.has(country)) byCountry.set(country, {});
      byCountry.get(country)[subj] = file;
      break;
    }
  }
}

const countries = [...byCountry.keys()].sort();
const rand = mulberry32(42);

// Shuffle countries deterministically
for (let i = countries.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [countries[i], countries[j]] = [countries[j], countries[i]];
}

// Pick one image per country, cycling through subjects
const needed = COLS * ROWS;
const selected = [];
for (let i = 0; i < needed; i++) {
  const country = countries[i % countries.length];
  const subjectMap = byCountry.get(country);
  const subj = SUBJECTS[i % SUBJECTS.length];
  // Fall back to any available subject if the preferred one doesn't exist
  const file = subjectMap[subj] || Object.values(subjectMap)[0];
  selected.push(file);
}

// ---------------------------------------------------------------------------
// Build the mosaic
// ---------------------------------------------------------------------------

console.log(
  `Compositing ${selected.length} tiles (${COLS}x${ROWS}) into ${OG_WIDTH}x${OG_HEIGHT} image…`
);

const composites = await Promise.all(
  selected.map(async (file, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const buf = await sharp(join(imagesDir, file))
      .resize(TILE_W, TILE_H, { fit: "cover", position: "top" })
      .toBuffer();

    return { input: buf, left: col * TILE_W, top: row * TILE_H };
  })
);

await sharp({
  create: {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
})
  .composite(composites)
  .jpeg({ quality: 85 })
  .toFile(outFile);

console.log(`Wrote ${outFile}`);
