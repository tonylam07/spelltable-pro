# Code Style

## General
- Node.js 18+ (use modern JS: optional chaining, nullish coalescing, async/await)
- No `var` — use `const` / `let`
- Single quotes for strings in JS files
- 4-space indent (matches existing codebase)

## Env vars
- Never hardcode secrets, ports, or URLs
- Always provide a safe dev fallback OR fail-fast in production:

```js
// Auth-critical secrets — fail fast
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET env var must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-fallback';

// Ports — safe to fall back
const PORT = process.env.PORT || process.env.DETECT_PORT || 4000;
```

- Never commit `.env` — it's in `.gitignore`
- Update `.env.example` when adding new vars

## Unused variables
Prefix with `_` to suppress lint warnings:
```js
app.use((err, _req, res, _next) => { ... })
```

## Railway / Docker
- Never hardcode `ENV PORT=4000` in Dockerfile — Railway injects PORT dynamically
- Always read `process.env.PORT` at runtime
- EXPOSE in Dockerfile is documentation only, not binding

## Vercel
- Heavy native deps (sharp, tesseract.js, image-hash, multer) go in `.vercelignore`
- Check `SKIP_DETECT` env or `process.env.VERCEL === '1'` before requiring detect routes
- Bundle must stay under 250MB

## MongoDB / Mongoose
- Don't duplicate schema indexes — if `unique: true` is set on a field,
  don't also call `Schema.index({ field: 1 })`
- Use `sparse: true` for optional unique fields (e.g. username)

## Socket.io
- `io.to(room)` — broadcasts to everyone including sender
- `socket.to(room)` — broadcasts to everyone except sender
- User notification rooms: `user:{userId}` — subscribe via `subscribe_user` event
- Game rooms: `game:{gameId}`

## File structure
```
api/models/     Mongoose schemas
api/routes/     Express routers (one file per resource)
api/services/   Business logic (no Express req/res)
api/middleware/ Auth + validation
api/data/       Static assets (phash-db.json)
js/             Frontend JS (browser context)
css/            Stylesheets
tests/          Jest test files
scripts/        Build/utility scripts
```
