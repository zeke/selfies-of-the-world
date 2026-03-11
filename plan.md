# Selfies of the World

Generate portrait-style selfie images for people from every country using AI image generation.

## Model

- Provider: Replicate
- Model: `google/nano-banana-2` (Gemini 3.1 Flash Image)
- Resolution: 1K (1024px)
- Aspect ratio: 9:16 (vertical)
- Output format: jpg

## Subjects

For each country, generate 6 images:

| Key            | Prompt fragment      |
| -------------- | -------------------- |
| man            | a young man          |
| woman          | a young woman        |
| nonbinary      | a nonbinary person   |
| elderly-man    | an elderly man       |
| elderly-woman  | an elderly woman     |
| child          | a child              |

## Prompt template

```
close-up portrait photo of {subject} from {country}, looking directly at the camera, natural lighting, warm expression
```

The prompt avoids words like "selfie" or "phone" to prevent the model from generating images of people holding phones.

## Phase 1: 10 countries

Starting with 10 countries for geographic and cultural diversity:

1. Brazil
2. Japan
3. Nigeria
4. India
5. Egypt
6. Mexico
7. France
8. South Korea
9. Kenya
10. Australia

10 countries x 6 subjects = 60 images.

Estimated cost: ~$4-5 (at ~$0.067/image for 1K resolution).

## Phase 2: All countries

195 UN-recognized countries x 6 subjects = 1,170 images.

Estimated cost: ~$78-94.

## File structure

```
selfies-of-the-world/
  plan.md
  generate.mjs
  progress.json
  images/
    brazil-man.jpg
    brazil-woman.jpg
    brazil-nonbinary.jpg
    brazil-elderly-man.jpg
    brazil-elderly-woman.jpg
    brazil-child.jpg
    japan-man.jpg
    ...
```

Flat directory, filenames follow `{country-slug}-{subject}.jpg`.

## Script: generate.mjs

- Uses `REPLICATE_API_TOKEN` env var
- Native `fetch` only, no npm dependencies
- Concurrency: 30 predictions at a time
- Polls predictions every 2 seconds
- Downloads images immediately on completion (output URLs expire after 1 hour)
- Tracks state in `progress.json` for resume on interruption
- Retries failed predictions up to 3 times

## Progress tracking

`progress.json` stores the state of each image:

```json
{
  "brazil-man": { "status": "succeeded", "predictionId": "abc123", "url": "..." },
  "brazil-woman": { "status": "running", "predictionId": "def456" },
  "japan-man": { "status": "pending" }
}
```

Statuses: `pending`, `running`, `succeeded`, `failed`.

Re-running the script skips `succeeded` entries and retries everything else.
