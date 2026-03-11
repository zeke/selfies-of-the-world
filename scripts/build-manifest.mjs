// Scan images/ directory and generate src/images.json
// Run before wrangler dev or wrangler deploy

import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, "..", "images");
const outFile = join(__dirname, "..", "src", "images.json");

const SUBJECT_LABELS = {
  man: "Young man",
  woman: "Young woman",
  nonbinary: "Nonbinary person",
  "elderly-man": "Elderly man",
  "elderly-woman": "Elderly woman",
  child: "Child",
};

// Sort longest keys first so "elderly-man" matches before "man"
const SUBJECT_KEYS = Object.keys(SUBJECT_LABELS).sort(
  (a, b) => b.length - a.length
);

function unslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const files = readdirSync(imagesDir).filter((f) => f.endsWith(".jpg"));
const entries = [];

for (const file of files) {
  const slug = file.replace(".jpg", "");

  let matchedSubject = "";
  for (const key of SUBJECT_KEYS) {
    if (slug.endsWith(`-${key}`)) {
      matchedSubject = key;
      break;
    }
  }
  if (!matchedSubject) continue;

  const countrySlug = slug.slice(0, slug.length - matchedSubject.length - 1);
  const country = unslugify(countrySlug);

  entries.push({
    slug,
    country,
    countrySlug,
    subject: matchedSubject,
    subjectLabel: SUBJECT_LABELS[matchedSubject],
  });
}

// Display order for subjects
const SUBJECT_ORDER = [
  "man",
  "woman",
  "nonbinary",
  "elderly-man",
  "elderly-woman",
  "child",
];

// Sort by country, then subject order
entries.sort((a, b) => {
  const cmp = a.country.localeCompare(b.country);
  if (cmp !== 0) return cmp;
  return SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject);
});

writeFileSync(outFile, JSON.stringify(entries, null, 2));
console.log(`Generated ${outFile} with ${entries.length} images from ${new Set(entries.map((e) => e.country)).size} countries`);
