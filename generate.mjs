import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!API_TOKEN) {
  console.error("REPLICATE_API_TOKEN env var is required");
  process.exit(1);
}

const MODEL = "google/nano-banana-2";
const CONCURRENCY = 30;
const POLL_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;
const IMAGES_DIR = join(import.meta.dirname, "images");
const PROGRESS_FILE = join(import.meta.dirname, "progress.json");

const COUNTRIES = [
  "Brazil",
  "Japan",
  "Nigeria",
  "India",
  "Egypt",
  "Mexico",
  "France",
  "South Korea",
  "Kenya",
  "Australia",
];

const SUBJECTS = [
  { key: "man", prompt: "a young man" },
  { key: "woman", prompt: "a young woman" },
  { key: "nonbinary", prompt: "a nonbinary person" },
  { key: "elderly-man", prompt: "an elderly man" },
  { key: "elderly-woman", prompt: "an elderly woman" },
  { key: "child", prompt: "a child" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildPrompt(subject, country) {
  return `close-up portrait photo of ${subject} from ${country}, looking directly at the camera, natural lighting, warm expression`;
}

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return {};
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function apiRequest(path, options = {}) {
  const url = path.startsWith("http") ? path : `https://api.replicate.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

async function createPrediction(prompt) {
  return apiRequest(`/v1/models/${MODEL}/predictions`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        prompt,
        resolution: "1K",
        aspect_ratio: "9:16",
        output_format: "jpg",
      },
    }),
  });
}

async function getPrediction(id) {
  return apiRequest(`/v1/predictions/${id}`);
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(filepath));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(IMAGES_DIR, { recursive: true });

  const progress = loadProgress();

  // Build the full list of jobs
  const jobs = [];
  for (const country of COUNTRIES) {
    for (const subject of SUBJECTS) {
      const slug = `${slugify(country)}-${subject.key}`;
      if (progress[slug]?.status === "succeeded") continue;
      jobs.push({
        slug,
        country,
        subject,
        prompt: buildPrompt(subject.prompt, country),
        retries: progress[slug]?.retries || 0,
      });
    }
  }

  const total = COUNTRIES.length * SUBJECTS.length;
  const alreadyDone = total - jobs.length;
  console.log(`Total: ${total} images, ${alreadyDone} already done, ${jobs.length} remaining`);

  if (jobs.length === 0) {
    console.log("All images already generated.");
    return;
  }

  // Process jobs in batches
  let completed = alreadyDone;
  let batchStart = 0;

  while (batchStart < jobs.length) {
    const batch = jobs.slice(batchStart, batchStart + CONCURRENCY);
    batchStart += batch.length;

    console.log(`\nStarting batch of ${batch.length} predictions...`);

    // Create all predictions in the batch
    const active = [];
    for (const job of batch) {
      try {
        const prediction = await createPrediction(job.prompt);
        progress[job.slug] = {
          status: "running",
          predictionId: prediction.id,
          retries: job.retries,
        };
        active.push({ ...job, predictionId: prediction.id });
        console.log(`  Created: ${job.slug} -> ${prediction.id}`);
      } catch (err) {
        console.error(`  Failed to create ${job.slug}: ${err.message}`);
        progress[job.slug] = {
          status: "failed",
          error: err.message,
          retries: job.retries + 1,
        };
      }
    }
    saveProgress(progress);

    // Poll until all predictions in this batch are done
    while (active.length > 0) {
      await sleep(POLL_INTERVAL_MS);

      const stillActive = [];
      for (const job of active) {
        try {
          const pred = await getPrediction(job.predictionId);

          if (pred.status === "succeeded") {
            const filepath = join(IMAGES_DIR, `${job.slug}.jpg`);
            await downloadImage(pred.output, filepath);
            progress[job.slug] = {
              status: "succeeded",
              predictionId: job.predictionId,
              predictTime: pred.metrics?.predict_time,
            };
            completed++;
            console.log(`  Done: ${job.slug} (${completed}/${total}) [${pred.metrics?.predict_time?.toFixed(1)}s]`);
          } else if (pred.status === "failed" || pred.status === "canceled") {
            progress[job.slug] = {
              status: "failed",
              predictionId: job.predictionId,
              error: pred.error || pred.status,
              retries: job.retries + 1,
            };
            console.error(`  Failed: ${job.slug} - ${pred.error || pred.status}`);
          } else {
            // still processing
            stillActive.push(job);
          }
        } catch (err) {
          console.error(`  Poll error for ${job.slug}: ${err.message}`);
          stillActive.push(job);
        }
      }

      active.length = 0;
      active.push(...stillActive);
      saveProgress(progress);
    }
  }

  // Retry failed jobs
  const failed = Object.entries(progress)
    .filter(([, v]) => v.status === "failed" && (v.retries || 0) < MAX_RETRIES)
    .map(([slug]) => slug);

  if (failed.length > 0) {
    console.log(`\n${failed.length} failed images could be retried. Run the script again.`);
  }

  const succeeded = Object.values(progress).filter((v) => v.status === "succeeded").length;
  console.log(`\nFinished. ${succeeded}/${total} images generated successfully.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
