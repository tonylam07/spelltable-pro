# Detection assets

## `phash-db.json`

Perceptual-hash lookup table used by the detection service for phash-first
card matching. **Must be committed to git before deploying to Railway** — the
Dockerfile copies this directory into the image.

### Seed → real DB

```bash
npm run build:phash              # ~40 min, full Scryfall catalog
npm run build:phash -- --limit=500  # quick dev seed
git add api/data/phash-db.json
git commit -m "refresh phash DB"
```

The committed placeholder lets `tests/` and Docker builds succeed without
a pre-built DB; detection silently falls back to OCR-only in that state.
