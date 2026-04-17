# SpellTable Pro+ — Phase A Game HUD Design

**Date:** 2026-04-17  
**Scope:** Phase A — in-session game table features  
**Phase B (future):** Overhead camera angle, spectator view

---

## 1. Goals

Address the top SpellTable.com pain points for in-session play:

- In-game text chat with `[[card name]]` linking
- Better life total adjustment (±5, hold-to-change, click-to-type)
- Full mana pool tracker (WUBRG + colourless) with land-tap auto-add
- Token creation (preset grid + Scryfall search)
- Full zone management (hand, battlefield, graveyard, exile, library) with drag-and-drop
- Card detail modal accessible from every card surface

---

## 2. Architecture

### 2.1 Panel abstraction

Every feature is a self-contained `Panel` class with a fixed interface:

```js
class Panel {
  constructor(id, title, icon) {}
  mount(container)  // create DOM, bind events, subscribe to GameState
  destroy()         // remove DOM, unbind listeners
  show()            // classList.remove('hidden')
  hide()            // classList.add('hidden')
}
```

**Option A today (sidebar):** `GameHUD` appends all panels into a collapsible right sidebar.  
**Option C later (floating):** `GameHUD.detachPanel(id)` wraps any panel's root element in a draggable/resizable shell. Panels have no knowledge of their container — the upgrade requires no panel code changes.

### 2.2 GameState bus

`js/game-state.js` — a tiny event emitter that decouples panels from Socket.io:

```
Socket.io event  →  GameState.set(key, value)  →  panel subscribers re-render
Panel action     →  GameState.emit(action, data) →  socket.emit(...)
```

Panels import `GameState` only — never `socket` directly. This makes panels independently testable.

### 2.3 New files

```
js/game-state.js          Shared state bus (event emitter)
js/hud.js                 GameHUD — sidebar chrome, panel registry, collapse toggle
js/card-detail.js         CardDetailModal — shared utility, used by all panels
js/panels/chat.js         ChatPanel
js/panels/life.js         LifePanel
js/panels/mana.js         ManaPanel
js/panels/tokens.js       TokenPanel
js/panels/zones.js        ZonePanel
css/hud.css               Sidebar layout, panel chrome, collapse animation
css/card-detail.css       Modal styles
css/panels/chat.css
css/panels/life.css
css/panels/mana.css
css/panels/tokens.css
css/panels/zones.css
```

---

## 3. CardDetailModal (shared foundation)

Built first. Used by every panel and the AI detection overlay.

**Trigger:** `CardDetail.show(scryfallId)` or `CardDetail.showByName(name)`

**Display:**
- Full card art
- Name, mana cost, type line, oracle text, power/toughness
- Set name + collector number
- "View on Scryfall" link (opens new tab)
- Double-faced cards: both faces rendered with a Flip button

**Implementation:**
- Single Scryfall fetch: `GET /cards/{scryfallId}`
- Results cached in `sessionStorage` — repeated opens are instant
- Pure client-side — no socket events, no backend changes
- One overlay element reused across all calls (not re-created)

---

## 4. In-game Chat (ChatPanel)

### Behaviour
- Ephemeral — messages live in memory only; not persisted to MongoDB
- Room-scoped — all players in the game see all messages
- Max 200 messages in memory (oldest trimmed)
- Max message length: 500 characters

### `[[Card Name]]` linking
1. On send, scan message for `[[...]]` patterns
2. Fire `GET /cards/named?fuzzy={name}` on Scryfall per match
3. Render resolved card as a small inline thumbnail (click → `CardDetail.show()`)
4. On 404 / timeout: render as plain text — no broken UI

### UI
- Scrollable message feed (auto-scrolls to bottom on new message)
- Each message: avatar colour, sender name, text, timestamp
- Input bar fixed at panel bottom; Enter sends, Shift+Enter newlines
- Unread badge on sidebar tab when panel is collapsed

### Socket events
```
Client emits:       chat_message  { text }
Server stamps:      playerId, playerName, gameId, timestamp
Server broadcasts:  chat_message  to game room (io.to)
```

No DB changes required.

---

## 5. Life Adjustment (LifePanel)

Replaces the existing inline life bar with a registered panel. The play-bar life display remains as a read-only summary for small screens.

### Controls per player
| Control | Behaviour |
|---|---|
| **−5 / −1** | Decrease life, emit `update_life` |
| **+1 / +5** | Increase life, emit `update_life` |
| **Click number** | Editable input; blur or Enter confirms; Escape cancels |
| **Hold +1 / −1** | After 400ms hold, auto-repeat at 100ms intervals; release stops |

Hold implemented via `pointerdown` / `pointerup` — works for mouse and touch (Logitech webcam users on laptops).

### Socket events
No new events — existing `update_life` / `life_change` used as-is.

---

## 6. Mana Pool Tracker (ManaPanel)

### Per-player display
Six coloured pip buttons: **W U B R G C**

| Interaction | Result |
|---|---|
| Left-click pip | +1 of that colour |
| Right-click pip | −1 (floor 0) |
| "Spend All" button | Resets all six to 0 |
| "Untap All" button | Broadcasts `untap_all`; does not change mana |

Each player sees all players' mana pools. Others' pools are read-only.

### Mana state
- **Ephemeral** — not persisted to MongoDB. Resets on page reload (correct MTG behaviour — mana drains between phases/turns as players manage it manually).

### Land-tap auto-add (from Zone system)
When a land card is tapped on the battlefield:
1. Read `manaProduced` already stored on the card instance (parsed from oracle text at `zone_add` time)
2. **Single mana type** (e.g. Forest → `{g:1}`) → auto-increment pip, done
3. **Multiple types** (e.g. Breeding Pool → G or U) → small floating picker above card; player taps once to choose
4. **"Any colour"** (e.g. Command Tower) → show all six colour options
5. **Non-land** → tap rotates card only, no mana prompt

Untapping a land does **not** subtract mana (already spent by then).

### Socket events
```
Client emits:       mana_update  { mana: {w,u,b,r,g,c} }
Server stamps:      playerId, broadcasts to room
All clients:        mana_update  → update that player's pip display
```

---

## 7. Token Creation (TokenPanel)

### Two tabs

**Presets tab**
A 5×6 grid of the 30 most common Commander tokens with card art thumbnails. One click → token placed on player's battlefield.

Preset list includes: Treasure, Food, Clue, Blood, Thopter 1/1, Goblin 1/1, Zombie 2/2, Soldier 1/1, Warrior 1/1, Human 1/1, Spirit 1/1, Bird 1/1, Saproling 1/1, Beast 3/3, Golem 3/3, Dragon 5/5, Wurm 5/5, Angel 4/4, Demon 5/5, Knight 2/2, Elemental, Wolf 2/2, Plant 0/1, Insect 1/1, Rat 1/1, Sliver, Vampire 1/1, Illusion, Construct, Copy token.

**Search tab**
- Text input, 300ms debounce
- `GET /cards/search?q=t:token+{name}` on Scryfall
- Results: scrollable list with art, name, P/T
- Click → place on battlefield

### On creation
```
Client emits:   token_create  { scryfallId, name, imageUrl, power, toughness }
Server:         generates cardId (uuid), adds to player battlefield zone in DB
Server broadcasts: zone_update  { playerId, zone: 'battlefield', card }
```

Tokens use `isToken: true` in ZoneCardSchema. The zone system handles everything after creation (drag to graveyard when destroyed, etc.).

---

## 8. Zone Management (ZonePanel)

### Five zones per player

| Zone | Other players see | Tracked as |
|---|---|---|
| **Hand** | Card backs (count) | Full card list |
| **Battlefield** | Face-up + tap state | Full card list |
| **Graveyard** | Face-up, ordered | Full card list |
| **Exile** | Face-up | Full card list |
| **Library** | Count only | Integer |

### Drag-and-drop
HTML5 Drag and Drop API. Cards are draggable from any zone; zones are drop targets with visual highlight on dragover.

On drop: emit `zone_move` **delta** (card + fromZone + toZone) — not a full state dump. Server applies delta to MongoDB and broadcasts delta to room. Clients apply locally for instant feedback.

### Tap state
- Click card on battlefield → toggle `tapped` (rotates 90°)
- Triggers mana auto-add logic described in §6
- `tap_change` event broadcast to all players — opponents see your lands tap in real time
- **Untap All** button: emits `untap_all`, server resets all battlefield cards to `tapped: false`

### Adding cards to zones
- Search bar in ZonePanel header → Scryfall fuzzy → pick zone from dropdown → add
- AI detection overlay gets a **"→ Zone"** button on each detected card (sends to hand by default)
- Library: configurable starting count (default 60); "Draw" moves a placeholder to hand; manual +/− to adjust count

### Oracle text parsing for mana
At `zone_add` time, if the card's type line includes "Land":
1. Fetch oracle text from Scryfall (already available in the card data)
2. Parse `{T}: Add {X}` patterns with a small regex parser
3. Store `manaProduced: {w,u,b,r,g,c}` on the ZoneCard instance
4. If unparseable (complex lands like fetchlands): store `manaProduced: null` → tap rotates only, no auto-add

### Socket events
```
zone_add     { playerId, zone, card }         → zone_update broadcast
zone_move    { playerId, fromZone, toZone, cardId }  → zone_update broadcast
zone_remove  { playerId, zone, cardId }       → zone_update broadcast
tap_change   { playerId, cardId, tapped }     → tap_change broadcast
untap_all    { playerId }                     → untap_all broadcast
```

---

## 9. Data Model Changes

### New: `ZoneCardSchema`

```js
{
  cardId:       String,   // uuid — unique instance (same scryfallId can appear multiple times)
  scryfallId:   String,
  name:         String,
  imageUrl:     String,
  isToken:      Boolean,  default: false
  power:        String,   // creatures/tokens
  toughness:    String,
  tapped:       Boolean,  default: false  // battlefield only
  manaProduced: {         // lands only; null/omitted for non-lands or unparseable
    w: Number, u: Number, b: Number,
    r: Number, g: Number, c: Number
  } | null,
  addedAt:      Date
}
```

### Updated: `PlayerSchema`

Add to existing schema:
```js
zones: {
  hand:        [ZoneCardSchema],
  battlefield: [ZoneCardSchema],
  graveyard:   [ZoneCardSchema],
  exile:       [ZoneCardSchema],
  library:     { type: Number, default: 60 }
}
```

Zone state is persisted — players can rejoin mid-game with their battlefield intact.

Mana pool is **not** added to the schema (ephemeral).

---

## 10. Server Changes (`api/server.js`)

New socket handlers (added alongside existing handlers):

```
chat_message   → stamp + broadcast to game room
mana_update    → stamp + broadcast to game room
zone_add       → validate + DB update + broadcast zone_update
zone_move      → validate + DB delta + broadcast zone_update
zone_remove    → validate + DB update + broadcast zone_update
tap_change     → validate + DB update + broadcast tap_change
untap_all      → DB update all battlefield tapped:false + broadcast
token_create   → generate cardId + zone_add to battlefield + broadcast
```

---

## 11. Build Order

Features have dependencies — build in this sequence:

1. `GameState` bus + `GameHUD` sidebar chrome
2. `CardDetailModal` (no dependencies, used by everything)
3. `LifePanel` (simplest panel, validates HUD wiring)
4. `ChatPanel` (socket-only, no DB)
5. `ManaPanel` (socket-only, no DB)
6. `ZoneCardSchema` + DB migration + zone socket handlers
7. `ZonePanel` (depends on DB schema + socket handlers)
8. `TokenPanel` (depends on ZonePanel for placement)

---

## 12. Testing

New test files:
```
tests/server.chat.test.js       chat_message relay, stamp, room scoping
tests/server.zones.test.js      zone_add / zone_move / zone_remove / tap_change / untap_all
tests/server.tokens.test.js     token_create → uuid generation → zone_add
```

Existing coverage thresholds maintained (75% statements / 60% branches / 70% functions / 75% lines).

Client-side panels (pure DOM) are not unit-tested — covered by integration/manual testing.

---

## 13. Out of Scope (Phase B)

- Overhead camera angle (secondary WebRTC stream designated as "card cam")
- Spectator view (read-only socket role, no game actions)
