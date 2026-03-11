# Selfies of the World

AI-generated portrait photos of people from every country.

[![Selfies of the World](https://selfies.ziki.boo/og.jpg)](https://selfies.ziki.boo)

## How it works

Images are generated using Google's [Nano Banana 2](https://replicate.com/google/nano-banana-2) model on [Replicate](https://replicate.com). The gallery is hosted on [Cloudflare Workers](https://workers.cloudflare.com) with on-the-fly image optimization via Cloudflare Images.

## Development

```sh
npm install
npm run dev
```

## Deployment

Deploys automatically via GitHub Actions on push to `main`. To deploy manually:

```sh
npm run deploy
```
