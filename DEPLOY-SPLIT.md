# Split Deploy: Vercel + Railway

SpellTable Pro+ ships as **two services** because the AI detection pipeline
(sharp + tesseract + phash DB) is too heavy for Vercel serverless.

```
┌──────────────────────┐     ┌───────────────────────┐
│ Vercel               │     │ Railway               │
│  • static frontend   │     │  • /api/detect        │
│  • /api/games        │ ──▶ │  • phash + OCR        │
│  • /api/cards        │     │  • Docker + sharp     │
│  • /api/auth         │     │                       │
└──────────────────────┘     └───────────────────────┘
```

## Part 1 — Deploy detection to Railway

1. Push repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway auto-detects `railway.json` and builds `Dockerfile.detect`.
4. Set env vars in the Railway project:
   - `ALLOWED_ORIGINS` = `https://spelltable-pro.vercel.app` (your frontend URL)
   - `DETECT_PORT` = `4000` (optional; matches Dockerfile)
5. Build the phash DB **before first deploy** so it ships inside the image:
   ```bash
   npm run build:phash -- --limit=2000
   git add api/data/phash-db.json
   git commit -m "seed phash DB"
   ```
   (Alternative: mount as a Railway volume and run the builder post-deploy.)
6. Copy the public URL Railway assigns, e.g. `https://spelltable-detect.up.railway.app`.
7. Smoke test:
   ```bash
   curl https://spelltable-detect.up.railway.app/health
   ```

## Part 2 — Deploy frontend + light API to Vercel

1. Vercel → **Import Project** → pick this repo.
2. Build command: leave blank (vercel.json handles it).
3. Set env vars:
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = random secret
   - `ALLOWED_ORIGINS` = `https://spelltable-pro.vercel.app`
   - `SKIP_DETECT` = `true` (already in vercel.json; belt & suspenders)
4. Point the frontend at the Railway detect URL. Edit [index.html](index.html)
   and [demo.html](demo.html), uncomment:
   ```html
   <script>
     window.__DETECT_API_URL__ = 'https://spelltable-detect.up.railway.app/api/detect';
   </script>
   ```
5. Deploy. Open the Vercel URL, click **Start Detection**, point camera at a card.

## Local dev equivalents

```bash
# One terminal: light API + frontend (detect lives here too in dev)
MOCK_DATA=true npm start                # :3000

# If you want to mimic prod split locally, run detect separately:
SKIP_DETECT=true MOCK_DATA=true npm start       # :3000, no detect
npm run start:detect                             # :4000, detect only
# Then in your HTML: window.__DETECT_API_URL__ = 'http://localhost:4000/api/detect';
```

## Environment variable matrix

| Var                     | Vercel          | Railway          | Local |
| ----------------------- | --------------- | ---------------- | ----- |
| `MONGODB_URI`           | required        | —                | optional (`MOCK_DATA=true` skips) |
| `JWT_SECRET`            | required        | —                | required for auth routes |
| `ALLOWED_ORIGINS`       | frontend origin | frontend origin  | `http://localhost:3000` |
| `SKIP_DETECT`           | `true`          | — (detect *is* this service) | unset |
| `DETECT_PORT`           | —               | `4000`           | optional |
| `NODE_ENV`              | `production`    | `production`     | `development` |

## Troubleshooting

- **CORS errors from the browser** — `ALLOWED_ORIGINS` on Railway must include the
  Vercel URL (and any preview URLs if you use branch deploys).
- **`/api/detect` returns 501** — `SKIP_DETECT=true` is set but
  `window.__DETECT_API_URL__` isn't configured; the frontend is still calling same-origin.
- **Railway build fails on sharp** — usually a Node version mismatch. Dockerfile
  pins Node 20; if you change the base image, keep `>=18`.
- **phash DB not found on Railway** — confirm `api/data/phash-db.json` is
  committed; `.gitignore` does not exclude it.
- **Tesseract first call hangs ~10s** — it's downloading the English language
  model (~10MB). Cached after. Consider baking into the image for faster cold start.
