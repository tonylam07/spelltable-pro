# SpellTable Pro+ API Documentation

## Overview
This API provides the backend services for the SpellTable Pro+ TCG table replacement system.

## Endpoints

### Game Management

#### `POST /api/games`
Create a new game session.

**Request:**
```json
{
  "players": ["player1", "player2"],
  "deckType": "standard"
}
```

**Response:**
```json
{
  "gameId": "game-123456",
  "status": "created",
  "players": ["player1", "player2"],
  "turn": 1,
  "createdAt": "2026-04-12T21:00:00Z"
}
```

#### `GET /api/games/:gameId`
Get game state.

**Response:**
```json
{
  "gameId": "game-123456",
  "turn": 1,
  "players": {
    "player1": {
      "life": 20,
      "hand": ["card1", "card2"],
      "board": ["card3"],
      "deck": 40
    },
    "player2": {
      "life": 20,
      "hand": ["card4", "card5"],
      "board": [],
      "deck": 40
    }
  },
  "status": "active"
}
```

#### `PATCH /api/games/:gameId/turn`
Advance to next turn.

**Response:**
```json
{
  "gameId": "game-123456",
  "turn": 2,
  "currentPlayer": "player2"
}
```

### Card Database

#### `GET /api/cards`
Search cards by name or type.

**Query Params:**
- `q`: Search query
- `type`: Filter by type (land, creature, instant, etc.)
- `mana`: Filter by mana cost

**Response:**
```json
{
  "cards": [
    {
      "name": "Forest",
      "type": "land",
      "manaCost": 0,
      "setId": "5ed",
      "oracleText": "Forest enters the battlefield tapped. T: Add G."
    }
  ],
  "total": 1234
}
```

#### `GET /api/cards/:name`
Get specific card details.

**Response:**
```json
{
  "name": "Forest",
  "type": "land",
  "manaCost": 0,
  "power": 0,
  "toughness": 0,
  "oracleText": "Forest enters the battlefield tapped. T: Add G.",
  "setId": "5ed",
  "setSymbol": "⊗",
  "rarity": "common",
  "artist": "Jim Nelson",
  "imageUrl": "https://cards.mtggoldfish.com/cards/200x/forest_5ed.jpg"
}
```

### Card Database API Integration

#### `GET /api/mtg/cards/:name`
Proxy to Magic: The Gathering API.

**Response:**
```json
{
  "id": "12345",
  "name": "Forest",
  "mana_cost": "{T}: Add G",
  "type_line": "Basic Land — Forest",
  "oracle_text": "T: Add {G}.",
  "rulings": [],
  "artist": "Jim Nelson",
  "images": {
    "card_normal": {
      "uri": "https://api.scryfall.com/cards/12345"
    }
  }
}
```

### Real-time Sync

#### `WS /ws`
WebSocket endpoint for real-time game state sync.

**Connection:**
```javascript
const ws = new WebSocket('wss://spelltable-pro.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    gameId: 'game-123456'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleGameUpdate(data);
};
```

**Message Types:**
- `game_state`: Complete game state update
- `turn_change`: Turn advancement
- `card_added`: New card on board
- `card_removed`: Card removed from board
- `life_change`: Life total update

### WebRTC Signaling

#### `POST /api/webrtc/offer`
Handle WebRTC offer for peer connection.

**Request:**
```json
{
  "gameId": "game-123456",
  "playerId": "player1",
  "offer": {
    "type": "offer",
    "sdp": "..."
  }
}
```

**Response:**
```json
{
  "gameId": "game-123456",
  "offerId": "offer-123456",
  "status": "pending"
}
```

#### `POST /api/webrtc/answer`
Handle WebRTC answer.

**Request:**
```json
{
  "gameId": "game-123456",
  "playerId": "player2",
  "answer": {
    "type": "answer",
    "sdp": "..."
  }
}
```

**Response:**
```json
{
  "gameId": "game-123456",
  "playerId": "player2",
  "status": "connected"
}
```

## Authentication

All endpoints require API key in header:
```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- 100 requests/minute for authenticated users
- 10 requests/minute for anonymous users

## Error Responses

**400 Bad Request**
```json
{
  "error": "invalid_request",
  "message": "Missing required field: gameId"
}
```

**401 Unauthorized**
```json
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

**404 Not Found**
```json
{
  "error": "not_found",
  "message": "Game not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "internal_error",
  "message": "Database connection failed"
}
```

## Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/spelltable-pro

# API Keys
MTG_API_KEY=scryfall-api-key
API_SECRET=your-secret-key

# WebSocket
WEBSOCKET_URL=wss://spelltable-pro.com/ws

# WebRTC
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=turn:your-turn-server.com
```

## Development

Start development server:
```bash
npm run dev
```

Start production server:
```bash
npm start
```

Run tests:
```bash
npm test
```

## Deployment

### Docker
```bash
docker build -t spelltable-pro .
docker run -p 3000:3000 spelltable-pro
```

### Vercel
```bash
vercel deploy
```

## Security

- All requests must be over HTTPS
- API keys must be rotated every 90 days
- Enable CORS for allowed origins
- Use rate limiting to prevent abuse
- Sanitize all user inputs
