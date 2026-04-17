# SpellTable Pro+ 🎮

**Modern, AI-Powered TCG Play Table - Enhanced Version**

## 🚀 Features

- **Modern UI/UX**: Clean, responsive design with dark/light mode toggle
- **Real-time Video**: WebRTC integration for remote play
- **AI Card Detection**: Computer vision support (ready for integration)
- **Turn Tracking**: Automated game state management
- **Life Total Sync**: Real-time synchronization across players
- **Card State Management**: IndexedDB for local storage
- **Keyboard Shortcuts**: Power user support
- **Custom Themes**: Table customization

## 📁 Project Structure

```
spelltable-pro/
├── index.html           # Main interface
├── css/
│   ├── styles.css       # Core styles
│   ├── dark-theme.css   # Dark mode styles
│   ├── light-theme.css  # Light mode styles
│   └── responsive.css   # Mobile/tablet styles
├── js/
│   ├── app.js           # Main application logic
│   ├── video.js         # WebRTC video integration
│   ├── cards.js         # Card state management
│   ├── ai-detection.js  # AI card detection (placeholder)
│   └── sync.js          # Real-time sync (WebSocket ready)
├── assets/
│   ├── images/          # Logo, icons
│   └── sounds/          # Sound effects (optional)
└── docs/
    └── INSTALLATION.md  # Setup instructions
```

## 🎯 Current Status

**Phase 1: MVP Prototype** - ✅ **COMPLETE**
- [x] Modern HTML5 structure
- [x] Responsive CSS framework
- [x] Dark/Light mode system
- [x] Video chat UI
- [x] Card state management
- [x] AI detection placeholder
- [x] Keyboard shortcuts
- [x] Mobile responsiveness

**Phase 2: Backend API Foundation** - ✅ **IN PROGRESS**
- [x] MongoDB game/player/card schemas
- [x] RESTful CRUD API (13 endpoints)
- [x] Scryfall API integration (real card database)
- [x] Enhanced WebSocket (Socket.io v4)
- [x] Security: Helmet, CORS, rate limiting
- [x] Input validation middleware
- [ ] JWT authentication (next)
- [ ] User registration/login (next)

**Phase 3: Authentication & Security** - ⏸️ **PENDING**
- [ ] JWT token-based auth
- [ ] User registration/login
- [ ] Secure game access
- [ ] API key authentication
- [ ] Session management

## 🚀 Quick Start

1. Open `index.html` in any modern browser
2. Toggle dark/light mode (settings menu)
3. Start a video session (WebRTC)
4. Manage card states (IndexedDB)
5. Try AI card detection (placeholder)

## 🛠️ Tech Stack

**Frontend:**
- HTML5/CSS3: Modern semantic markup
- JavaScript (ES2022): Vanilla JS, no framework
- WebRTC: Real-time video/audio
- IndexedDB: Local card state storage
- OpenCV.js: Browser-based card detection

**Backend (Phase 2):**
- Node.js + Express.js: REST API
- MongoDB: Game state persistence
- Socket.io v4: Real-time WebSocket sync
- Mongoose: MongoDB ODM
- Helmet: Security headers
- express-rate-limit: API rate limiting
- express-validator: Input validation
- axios: HTTP client (Scryfall API)

**Deployment:**
- GitHub Pages: Static frontend hosting
- MongoDB Atlas: Cloud database
- Railway/Render: API hosting (future)

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🔮 Future Phases

**Phase 2: Enhanced AI**
- [ ] OpenCV integration
- [ ] Card recognition model
- [ ] Game state analysis
- [ ] Play recommendations

**Phase 3: Backend Integration**
- [ ] Node.js server
- [ ] PostgreSQL database
- [ ] Redis for real-time
- [ ] WebSocket sync

**Phase 4: Community Features**
- [ ] Matchmaking system
- [ ] Tournament support
- [ ] Leaderboards
- [ ] Spectator mode

## 🎨 Design Philosophy

**"Simple, Powerful, Beautiful"**

- Minimal clicks for common actions
- Keyboard shortcuts for power users
- Responsive design for all devices
- Clean, modern aesthetic
- Accessibility-first approach

## 📝 License

MIT License - Free for personal and commercial use

## 👨‍💻 Contributing

Contributions welcome! Fork the repo and submit a PR.

## 📞 Support

For issues or questions, open an issue on GitHub.

---

**Built with ❤️ by J.E.S.S.I.E.**
*Your AI companion for creating amazing TCG tools*
