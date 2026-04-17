# SpellTable Pro+ - Quick Start Guide

## 🚀 Option 1: Run API Server (Recommended)

### On Windows (PowerShell)
```powershell
cd spelltable-pro
.\start-server.ps1
```

### On Windows (Batch)
```batch
cd spelltable-pro
start-server.bat
```

### Direct Node.js (Any OS)
```bash
cd spelltable-pro
npm install
node api/server.js
```

**Server will start at:** `http://localhost:3000`

---

## 🌐 Option 2: Open Demo in Browser (No Server Needed)

Just open the demo HTML file directly:

```bash
# Open in default browser
start demo.html           # Windows
open demo.html            # macOS
xdg-open demo.html        # Linux
```

The demo works **completely offline** - no server required for basic features!

---

## 📋 What to Expect

### Server Starting Output:
```
Starting SpellTable Pro+ API server...
🚀 SpellTable Pro+ API server running on port 3000
📡 WebSocket server ready
🌍 API endpoint: http://localhost:3000/api/health
```

### Test the Server:
```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","uptime":123,"version":"1.0.0"}
```

---

## 🎮 Try the Demo

Once server is running (or even without it):

1. Open: `http://localhost:3000/demo.html`
2. Click "🚀 Get Started" to begin
3. Test features:
   - Click "🌙" to toggle themes
   - Click "➡️ Next Turn" to advance turns
   - Click "📸 Snapshot" or "⏺️ Record" (requires camera permissions)

### Console Commands:
Open browser DevTools (F12) and try:
```javascript
// Start next turn
startTurn();

// Add a demo card to the board
testCard();

// Check game state
console.log(window.spellTableApp.gameState);
```

---

## ⚙️ Configuration

### Environment Variables (`.env` file)
```bash
# Server
NODE_ENV=development
PORT=3000

# API Keys (Get from https://scryfall.com)
MTG_API_KEY=your_scryfall_api_key

# WebSocket
WEBSOCKET_URL=ws://localhost:3000/ws

# WebRTC
STUN_SERVER=stun:stun.l.google.com:19302
```

**Note:** `MTG_API_KEY` is optional for basic features. Remove or replace with your own for full card database integration.

---

## 📦 Dependencies

Required Node.js packages:
- `express` - Web server
- `cors` - Cross-origin requests
- `ws` - WebSocket support
- `dotenv` - Environment variables
- `mongoose` - MongoDB support (optional)

Install automatically on first run:
```bash
npm install
```

---

## 🔗 Access URLs

Once server is running:

| URL | Description |
|-----|-----------|
| `http://localhost:3000/` | API health check |
| `http://localhost:3000/api/health` | Server status |
| `http://localhost:3000/demo.html` | Standalone demo |
| `ws://localhost:3000/ws` | WebSocket endpoint |

---

## 🐛 Troubleshooting

### "Node.js not found"
Install Node.js 18+ from https://nodejs.org

### "npm install fails"
Try:
```bash
npm cache clean --force
npm install
```

### "Port 3000 already in use"
Choose a different port:
```bash
PORT=3001 node api/server.js
```

### "WebSocket not connecting"
- Check firewall settings
- Ensure HTTPS in production
- Verify server is running

### "Demo page blank"
- Check browser console (F12) for errors
- Disable ad blockers
- Use modern browser (Chrome, Firefox, Safari, Edge)

---

## 🎯 Next Steps

1. **Test Demo**: Open `demo.html` and explore features
2. **Add API Key**: Get one from https://scryfall.com for full card database
3. **Deploy**: Follow DEPLOYMENT.md for production hosting
4. **Customize**: Modify `demo.html` to match your branding

---

## 💡 Quick Tips

- **No Internet?** Demo works offline with local features!
- **Camera Issues?** Browser will prompt for permissions - allow video access
- **Keyboard Shortcuts**: Try `Ctrl+T` (theme), `Space` (next turn), `F11` (fullscreen)
- **Dark Mode**: Click the 🌙 button in the header

---

**Enjoy SpellTable Pro+!** 🎮✨

For more details, see:
- `README.md` - Full documentation
- `DEPLOYMENT.md` - Production setup
- `PROJECT-SUMMARY.md` - Complete overview
