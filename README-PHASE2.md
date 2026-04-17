# 📊 SpellTable Pro+ - Phase 2: Backend Build-Out

## 🎯 **Phase 2 Objectives**

**Status:** ✅ **IN PROGRESS** - Backend API foundation created

**Goals:**
- ✅ MongoDB schemas for games, cards, and players
- ✅ RESTful CRUD API endpoints
- ✅ Scryfall API integration (Magic card database)
- ✅ Enhanced WebSocket for real-time sync
- ✅ Security: Helmet, CORS, rate limiting
- ✅ Deployment configuration for GitHub Pages

---

## 📁 **New Project Structure**

```
spelltable-pro/
├── api/
│   ├── models/
│   │   ├── Game.js          ✅ NEW - Game schema with players, board, game log
│   │   ├── Card.js          ✅ NEW - Scryfall API integration service
│   │   └── index.js         ✅ NEW - Models export
│   ├── routes/
│   │   ├── games.js         ✅ NEW - Full CRUD for game management
│   │   └── cards.js         ✅ NEW - Card search, lookup, validation
│   ├── middleware/
│   │   └── validation.js    ✅ NEW - Input validation middleware
│   ├── server.js            ✅ UPDATED - Integrated with new routes
│   └── README.md            ✅ EXISTING - API documentation
├── scripts/
│   └── deploy-github-pages.sh ✅ NEW - Automated deployment script
├── DEPLOYMENT.md            ✅ NEW - Complete deployment guide
├── README-PHASE2.md         ✅ NEW - This file
├── package.json             ✅ UPDATED - Added dependencies
└── [frontend files]         ✅ EXISTING - HTML, CSS, JS

New Dependencies Added:
├── axios (1.6.0)            ✅ For Scryfall API calls
├── express-rate-limit (7.1.5) ✅ API rate limiting
├── express-validator (7.0.1) ✅ Input validation
├── helmet (7.1.0)           ✅ Security headers
└── socket.io (4.6.0)        ✅ Enhanced WebSocket
```

---

## 🚀 **API Endpoints Created**

### **Games API** (`/api/games`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/games` | List all games (with status filter) |
| `GET` | `/api/games/:gameId` | Get single game by ID |
| `POST` | `/api/games` | Create new game |
| `POST` | `/api/games/:gameId/join` | Player joins a game |
| `PUT` | `/api/games/:gameId/turn` | Advance to next turn |
| `PUT` | `/api/games/:gameId/life/:playerId` | Update player life |
| `DELETE` | `/api/games/:gameId` | Delete a game |

**Example Response (Get Game):**
```json
{
  "success": true,
  "data": {
    "gameId": "game-1744531200000-abc123",
    "hostId": "player-123",
    "status": "lobby",
    "players": [
      {
        "playerId": "player-123",
        "playerName": "Player 1",
        "lifeTotal": 20,
        "handSize": 7,
        "libraryCount": 60,
        "boardSlots": []
      }
    ],
    "currentPlayerIndex": 0,
    "turnNumber": 1,
    "gameMode": "casual"
  }
}
```

### **Cards API** (`/api/cards`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cards/search?q=query` | Search Magic cards |
| `GET` | `/api/cards/:name` | Get card by exact name |
| `GET` | `/api/cards/image/:name` | Get high-res image URL |
| `GET` | `/api/cards/recent?limit=20` | Get recent releases |
| `GET` | `/api/cards/validate/:name` | Validate card exists |
| `GET` | `/api/cards/stats` | Get cache statistics |

**Example Response (Search Cards):**
```json
{
  "success": true,
  "data": {
    "totalCards": 5,
    "cards": [
      {
        "name": "Forest",
        "oracleText": "{T}: Add {G}.",
        "type": "Land",
        "manaCost": "",
        "colors": ["G"],
        "setId": "mh3",
        "releasedAt": "2023-01-01"
      }
    ]
  }
}
```

---

## 🗄️ **MongoDB Schemas**

### **Game Schema** (`api/models/Game.js`)

```javascript
{
  gameId: String (unique, required),
  hostId: String (required),
  status: 'lobby' | 'active' | 'paused' | 'completed',
  players: [Player Schema],
  currentPlayerIndex: Number,
  turnNumber: Number,
  gameMode: 'casual' | 'tournament' | 'ranked',
  deckInfo: {
    player1: String,
    player2: String
  },
  gameLog: [{
    timestamp: Date,
    action: String,
    details: Object
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Player Schema (embedded in Game):**
```javascript
{
  playerId: String (unique),
  playerName: String (required),
  lifeTotal: Number (default: 20),
  handSize: Number (default: 7),
  libraryCount: Number (default: 60),
  graveyardCount: Number (default: 0),
  boardSlots: [CardSlot Schema]
}
```

**CardSlot Schema:**
```javascript
{
  cardName: String,
  cardId: String (Scryfall ID),
  cardType: 'creature' | 'land' | 'sorcery' | 'instant' | 'artifact' | 'enchantment' | 'planeswalker',
  power: Number,
  toughness: Number,
  isTapped: Boolean,
  imageUrl: String,
  metadata: Object
}
```

---

## 🔐 **Security Features**

### **Helmet.js Security Headers**
```javascript
app.use(helmet());
// Adds:
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection
// - Strict-Transport-Security
// - And more...
```

### **CORS Configuration**
```javascript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
```

### **Rate Limiting**
```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
});
app.use('/api/', limiter);
```

---

## 🌐 **Scryfall API Integration**

The `CardDatabase` service integrates with the [Scryfall API](https://scryfall.com/docs/api):

**Features:**
- ✅ Search cards by name, type, keyword
- ✅ Get full card details by name or ID
- ✅ Retrieve high-resolution card images
- ✅ Get recently released cards
- ✅ Validate card existence
- ✅ Automatic caching (1 hour TTL)

**Usage Example:**
```javascript
const { cardDatabase } = require('./api/models');

// Search for cards
const searchResults = await cardDatabase.search('Forest');

// Get card by name
const forestCard = await cardDatabase.getByName('Forest');

// Get image URL
const imageUrl = await cardDatabase.getImageUrl('Lightning Strike');

// Check if card is valid
const isValid = await cardDatabase.isValidCard('Fake Card');
```

---

## 🔄 **Enhanced WebSocket Protocol**

**Existing Events:**
- `joinGame` - Join game room
- `leaveGame` - Leave game room

**New Events (for Phase 4):**
- `syncGameState` - Broadcast full game state
- `syncCardMove` - Sync card movement
- `syncTurnUpdate` - Update turn counter
- `playerJoined` - Notify when player joins
- `playerLeft` - Notify when player leaves

**WebSocket Usage:**
```javascript
// Frontend
socket.emit('joinGame', 'game-123');
socket.on('gameStateUpdated', (data) => {
    updateGameState(data);
});

// Backend
io.to(`game:${gameId}`).emit('gameStateUpdated', gameState);
```

---

## 📦 **Package.json Changes**

**Added Dependencies:**
```json
{
  "axios": "^1.6.0",                    // HTTP client for API calls
  "express-rate-limit": "^7.1.5",      // Rate limiting
  "express-validator": "^7.0.1",       // Input validation
  "helmet": "^7.1.0",                  // Security headers
  "socket.io": "^4.6.0"                // Real-time WebSocket
}
```

---

## 🚀 **Deployment Setup**

### **Environment Variables (`.env`)**
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/spelltable-pro
ALLOWED_ORIGINS=http://localhost:3000,https://yourusername.github.io
NODE_ENV=development
```

### **MongoDB Atlas Setup**
1. Create free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Update `MONGODB_URI` in `.env`

### **GitHub Pages Deployment**
- **Frontend:** Host static files on GitHub Pages
- **Backend API:** Deploy to Railway/Render/Vercel
- **Database:** MongoDB Atlas (free tier)

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.**

---

## 🧪 **Testing**

### **Local Testing:**
```bash
# Start server
npm start

# Open demo
# http://localhost:3000/demo.html

# Test API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/cards/search?q=Forest
curl http://localhost:3000/api/games
```

### **API Testing Tools:**
- **Postman:** Import API collection
- **curl:** Quick testing
- **Thunder Client:** VS Code extension

---

## 📋 **Next Steps (Phase 3)**

### **Authentication & Security**
- [ ] JWT token-based authentication
- [ ] User registration/login
- [ ] Password hashing (bcrypt)
- [ ] Session management
- [ ] API key authentication

### **Enhanced Validation**
- [ ] Joi schema validation
- [ ] Sanitize user inputs
- [ ] SQL injection prevention
- [ ] XSS protection

### **Error Handling**
- [ ] Centralized error handling
- [ ] Custom error classes
- [ ] Error logging (Winston)
- [ ] User-friendly error messages

---

## 📚 **Documentation Links**

- **[README.md](./README.md)** - Project overview
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
- **[api/README.md](./api/README.md)** - API documentation
- **[PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)** - Complete project summary

---

## 🎮 **Current Status**

✅ **Phase 1:** MVP Frontend - COMPLETE  
✅ **Phase 2:** Backend API Foundation - IN PROGRESS  
⏸️ **Phase 3:** Authentication & Security - NEXT  
⏸️ **Phase 4:** Multiplayer & Real-time - PENDING  
⏸️ **Phase 5:** AI & Card Detection - CAN RUN PARALLEL  
⏸️ **Phase 6:** Testing & CI/CD - PENDING  
⏸️ **Phase 7:** Production Deployment - PENDING  
⏸️ **Phase 8:** Community Features - PENDING

---

**Ready for Phase 3? Let's add authentication and enhance security!** 🔐
