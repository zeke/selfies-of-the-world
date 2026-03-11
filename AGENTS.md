# AGENTS.md

## Project overview

Selfies of the World is a gallery of AI-generated portrait photos of people from every country. The web app runs on Cloudflare Workers using Hono and serves optimized images via the Cloudflare Images binding.

Live site: https://selfies.ziki.boo

## Architecture

```
src/index.tsx          Hono app -- serves HTML and handles image optimization
src/images.json        Generated manifest (gitignored, built from images/)
scripts/build-manifest.mjs   Scans images/ and writes src/images.json
generate.mjs           Standalone script to generate images via Replicate API
public/                Static assets (style.css, app.js)
images/                Source JPEGs (committed to repo)
wrangler.jsonc         Workers config
```

## Commands

- `npm run dev` -- local dev server (runs build-manifest first)
- `npm run deploy` -- deploy to Cloudflare Workers (runs build-manifest first)
- `npm run build:manifest` -- regenerate `src/images.json` from `images/`

## Image generation

`generate.mjs` uses the Replicate API to create portraits. It requires the `REPLICATE_API_TOKEN` env var. Progress is tracked in `progress.json` so the script can resume after interruption. Re-running skips images that already succeeded.

## File conventions

- Images: `images/{country-slug}-{subject}.jpg`
- Subjects: `man`, `woman`, `nonbinary`, `elderly-man`, `elderly-woman`, `child`
- `src/images.json` is gitignored -- never edit it by hand. Run `npm run build:manifest` to regenerate.

## Deployment

GitHub Actions deploys on push to `main`. The worker is bound to the custom domain `selfies.ziki.boo`. The `CLOUDFLARE_API_TOKEN` secret must be set in the repo.

## Key details

- The `/images/:filename` route resizes images on the fly using the Cloudflare Images binding (`?w=` query param, max 1024).
- Output format is content-negotiated (AVIF > WebP > JPEG) based on the `Accept` header.
- In local dev, the Images binding is unavailable so the original JPEG is served as a fallback.
