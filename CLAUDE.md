# SpellTable Pro+ — Claude Context

## What this is
A browser-based MTG/TCG play table replacement for Magic: The Gathering.
Players join a game room, show cards to their webcam, and AI identifies them via perceptual hashing + OCR.
Think SpellTable (wizards.com) but self-hosted with more features.

## Live URLs
- **Frontend**: https://spelltable-pro.vercel.app
- **Detection API**: https://spelltable-pro-production.up.railway.app
- **GitHub**: https://github.com/tonylam07/spelltable-pro

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, HTML/CSS, OpenCV.js (contour detection) |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB Atlas via Mongoose |
| Auth | JWT (fail-fast if JWT_SECRET missing in production) |
| Detection | phash (image-hash) + Tesseract.js OCR, Sharp preprocessing |
| Deploy | Vercel (frontend + light API) + Railway Docker (detection) |
| Tests | Jest + supertest, 46 tests across 7 suites |
| CI | GitHub Actions, Node 18 + 20 matrix |

## Phases — all complete
- ✅ Phase 1: MVP frontend (play table UI, SpellTable-style responsive layout)
- ✅ Phase 2: Backend API (Express, MongoDB, game CRUD)
- ✅ Phase 3: Auth (JWT, bcrypt, fail-fast prod guard)
- ✅ Phase 4: Multiplayer sync (Socket.io, life/cards/turn events)
- ✅ Phase 5: AI card detection (hybrid phash + OCR pipeline)
- ✅ Phase 6: Testing + CI (Jest, supertest, GitHub Actions)
- ✅ Phase 7: Split deploy (Vercel + Railway Dockerfile)
- ✅ Phase 8: Community (profiles, friends, game invites, public browser)

## Key files
```
api/server.js              Main Express server + Socket.io handlers
api/detect-server.js       Standalone detection server (Railway)
api/routes/
  games.js                 Game CRUD + invite + browse endpoints
  users.js                 Profile endpoints (/me, /search, /:id)
  friends.js               Friend requests + accept/decline/block
  detect.js                Card detection endpoint (multipart + base64)
  cards.js                 Scryfall card search/lookup
  auth.js                  Register/login/JWT
api/models/
  User.js                  + username, bio, favoriteFormats, stats, toPublicProfile()
  Game.js                  + format, maxPlayers(2-6), isPublic, name, invites[]
  Friendship.js            pending/accepted/blocked, findBetween() helper
api/services/cardDetection.js  identifyCard() — phash → OCR fallback pipeline
api/data/phash-db.json     200 Neon Dynasty cards (run build:phash for more)
js/game-sync.js            Socket.io client, listens: life_change/card_added/turn_change
js/card-detection-hybrid.js  OpenCV contour → perspective warp → POST /api/detect
js/ai-detection.js         Detection toggle, inferType() Scryfall→category mapping
js/app.js                  Main app init, handleGameUrlParam(), handleLogin/Logout
browse.html                Public game browser UI
```

## Socket events
| Client emits | Server broadcasts |
|---|---|
| `joinGame` | `player_joined` |
| `leaveGame` | `player_left` |
| `update_life` | `life_change` |
| `add_card` | `card_added` |
| `next_turn` | `turn_change` |
| `card_move` | `card_move` |
| `syncGameState` | `game_state` |
| `presence_update` | `presence_update` |
| `subscribe_user` | (joins `user:{id}` room for invites) |

## Env vars
```
# Vercel
MONGODB_URI       MongoDB Atlas connection string
JWT_SECRET        Long random string (required in production)
SKIP_DETECT=true  Set by Vercel — skips heavy detection deps
DETECT_API_URL    https://spelltable-pro-production.up.railway.app

# Railway
PORT=4000
NODE_ENV=production
DETECT_PORT=4000
TESSDATA_DIR=/app/tessdata
```

## Test patterns
- **Mock models** with `jest.mock('../api/models', () => ({ Game: { findOne: jest.fn() } }))`
- **Out-of-scope vars** in mock factories must be prefixed `mock` (Jest restriction)
- **Auth middleware** always mocked: `jest.mock('../api/middleware/auth', () => ({ authenticate: (req,_,next) => { req.user = {id:'...'};next(); } }))`
- **Coverage** scoped to `api/routes/detect.js`, `api/routes/cards.js`, `api/services/**`
- Thresholds: 75% statements / 60% branches / 70% functions / 75% lines

## Known gaps (next up)
- Commander damage tracking (6-player matrix)
- In-game chat (Socket.io already wired)
- WebRTC camera streams (js/video.js exists, peer connections not fully wired)
- Deck import (Moxfield/Archidekt URL → populate library)
- Bigger phash DB (run `npm run build:phash -- --set=standard` for ~2k cards)
- Socket auth (subscribe_user trusts client-supplied userId — low risk for now)

## Commands
- `npm run dev` — start local server on PORT from .env (currently 3001)
- `npm run dev:detect` — start detection service on port 4000
- `npm run test` — run all 46 tests
- `npm run test:coverage` — tests + coverage report
- `npm run lint` — ESLint (0 errors, 8 pre-existing warnings)
- `npm run build:phash -- --set=neo --limit=200` — build phash DB subset
- `vercel --prod --yes` — deploy to production
- `git push` — triggers Railway auto-redeploy
