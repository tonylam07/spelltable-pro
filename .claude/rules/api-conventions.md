# API Conventions

## Route ordering (critical)
Specific routes MUST come before wildcard routes in Express.
Wrong order causes silent 404s — we were burned by this in cards.js.

```js
// CORRECT — specific before wildcard
router.get('/search', ...)
router.get('/recent', ...)
router.get('/validate/:name', ...)
router.get('/stats', ...)
router.get('/:name', ...)   // ← wildcard always last
```

## Response shape
All API responses use this envelope:
```json
{ "success": true, "data": <payload> }
{ "success": false, "error": "message" }
```
Never return raw data without the envelope.

## Auth middleware
- Use `authenticate` from `api/middleware/auth.js`
- Attach as array: `router.get('/me', [authenticate], handler)`
- `req.user.id` is the authenticated user's MongoDB ObjectId string
- In production, JWT_SECRET must be set as env var — fails fast at startup if missing

## Player cap
Games support 2-6 players. The cap is `game.maxPlayers || 6`.
Never hardcode 4.

## Socket events — client emits → server broadcasts
| Client emits | Server must broadcast |
|---|---|
| update_life | life_change (to whole room) |
| add_card | card_added (to whole room) |
| next_turn | turn_change (to whole room) |
| card_move | card_move (to room except sender) |
| syncGameState | game_state (to room except sender) |

Use `io.to(room)` for events that the sender also needs to receive (life, cards, turns).
Use `socket.to(room)` for events where sender already applied optimistic update.

## Error handling
- 400 — bad input (validation)
- 401 — missing/invalid JWT
- 403 — authenticated but not authorized (e.g. non-host trying to start)
- 404 — resource not found
- 409 — conflict (duplicate username, already invited)
- 500 — unexpected server error
