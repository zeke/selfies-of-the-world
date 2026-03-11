import { Hono } from "hono";
import imageManifest from "./images.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageEntry {
  slug: string;
  country: string;
  countrySlug: string;
  subject: string;
  subjectLabel: string;
}

type Bindings = {
  ASSETS: Fetcher;
  IMAGES: ImagesBinding;
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const IMAGES: ImageEntry[] = imageManifest;
const COUNTRIES = [...new Set(IMAGES.map((img) => img.country))];
const TOTAL = IMAGES.length;

// ---------------------------------------------------------------------------
// GitHub Octocat SVG
// ---------------------------------------------------------------------------

const octocatSvg = `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`;

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Bindings }>();

// ---------------------------------------------------------------------------
// GET / -- serve the HTML page
// ---------------------------------------------------------------------------

app.get("/", (c) => {
  const imageCards = IMAGES.map(
    (img) =>
      `<figure data-country="${img.countrySlug}" data-subject="${img.subject}">
      <a href="/images/${img.slug}.jpg">
        <img src="/images/${img.slug}.jpg?w=400" loading="lazy" alt="${img.subjectLabel} from ${img.country}" class="card-img" width="400" height="711">
      </a>
      <figcaption>${img.country} &mdash; ${img.subjectLabel}</figcaption>
    </figure>`
  ).join("\n    ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Selfies of the World</title>
  <meta name="description" content="AI-generated portrait photos of people from ${COUNTRIES.length} countries, created using Google's Nano Banana 2 model on Replicate.">
  <meta property="og:title" content="Selfies of the World">
  <meta property="og:description" content="AI-generated portraits from ${COUNTRIES.length} countries.">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>Selfies of the World</h1>
    <p class="preamble">
      AI-generated portrait photos of people from ${COUNTRIES.length} countries, created using
      <a href="https://replicate.com/google/nano-banana-2">Google's Nano Banana 2 model</a> on
      <a href="https://replicate.com">Replicate</a>.
      For each country, six portraits were generated: a young man, a young woman,
      a nonbinary person, an elderly man, an elderly woman, and a child.
      The images use a consistent prompt with natural lighting and a warm expression.
    </p>
    <div class="search-wrap">
      <input type="search" id="search" placeholder="Filter by country, subject..." autocomplete="off" aria-label="Filter images">
      <span id="count">${TOTAL} of ${TOTAL}</span>
    </div>
  </header>

  <main class="grid">
    ${imageCards}
  </main>

  <footer>
    <a href="https://github.com/zeke/selfies-of-the-world" class="github-link">
      ${octocatSvg}
      zeke/selfies-of-the-world
    </a>
  </footer>

  <script defer src="/app.js"></script>
</body>
</html>`;

  return c.html(html);
});

// ---------------------------------------------------------------------------
// GET /images/:filename -- optimize and serve images
// ---------------------------------------------------------------------------

app.get("/images/:filename", async (c) => {
  const filename = c.req.param("filename");

  if (!filename.endsWith(".jpg")) {
    return c.notFound();
  }

  // Parse width from query param
  const wParam = c.req.query("w");
  const width = Math.min(
    Math.max(parseInt(wParam || "400", 10) || 400, 50),
    1024
  );

  // Fetch original image from static assets
  const assetUrl = new URL(`/images/${filename}`, c.req.url);
  assetUrl.search = "";
  const original = await c.env.ASSETS.fetch(new Request(assetUrl.toString()));

  if (!original.ok) {
    return c.notFound();
  }

  // Buffer the original so we can use it for both the Images binding
  // and the fallback path (ReadableStream can only be consumed once).
  const originalBytes = await original.arrayBuffer();

  // Pick the best output format based on Accept header
  const accept = c.req.header("Accept") || "";
  let outputFormat: "image/avif" | "image/webp" | "image/jpeg" = "image/jpeg";
  if (accept.includes("image/avif")) {
    outputFormat = "image/avif";
  } else if (accept.includes("image/webp")) {
    outputFormat = "image/webp";
  }

  // Transform via Images binding (falls back to original in local dev)
  try {
    const transformed = (
      await c.env.IMAGES.input(originalBytes)
        .transform({ width, fit: "scale-down" })
        .output({ format: outputFormat })
    ).response();

    return new Response(transformed.body, {
      status: 200,
      headers: {
        "Content-Type":
          transformed.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept",
      },
    });
  } catch {
    // Images binding unavailable (local dev) -- serve original
    return new Response(originalBytes, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
});

export default app;
