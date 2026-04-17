// SpellTable Pro+ - API Server
// Express.js backend with WebSocket for real-time sync
// Optimized for Vercel Serverless Functions

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const gameRoutes = require('./routes/games');
const cardRoutes = require('./routes/cards');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
// Detect route is lazy-loaded below; it pulls heavy native deps (sharp,
// tesseract, image-hash) that exceed Vercel's serverless bundle limit.
// Skip it when deployed to Vercel — detection runs on Railway/Fly.

const app = express();
const isVercel = process.env.VERCEL === '1';
const PORT = process.env.PORT || (isVercel ? 443 : 3000);

// WebSocket setup (only for non-Vercel environments)
let io;
let server;
if (!isVercel) {
    server = http.createServer(app);
    server.listen(PORT, () => {
        console.log(`🎮 SpellTable Pro+ running on port ${PORT}`);
    });
    io = new Server(server, {
        cors: {
            origin: ["*"], // Allow all origins for local testing
            methods: ["GET", "POST"]
        }
    });
    app.set('io', io);
    console.log('🔌 Socket.io initialized');
}

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting (Vercel has built-in rate limiting, but keep for local dev)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (serve frontend)
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);

// Only mount detection locally or on the dedicated detect-server host.
// SKIP_DETECT=true is set for Vercel frontend+light-API deploys.
if (process.env.SKIP_DETECT !== 'true' && !isVercel) {
    const detectRoutes = require('./routes/detect');
    app.use('/api/detect', detectRoutes);
    console.log('🔍 Detection route mounted at /api/detect');
} else {
    app.get('/api/detect', (req, res) => res.status(501).json({
        success: false,
        error: 'Detection service runs on a separate host. Set window.__DETECT_API_URL__.'
    }));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        platform: isVercel ? 'Vercel' : 'Local'
    });
});

// Main routes (serve frontend)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/demo.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'demo.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Server error'
    });
});

// WebSocket connection handling (Vercel-compatible)
const connectedClients = new Map();

if (io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Subscribe to personal notification room (for invites, friend requests).
        socket.on('subscribe_user', ({ userId }) => {
            if (userId) socket.join(`user:${userId}`);
        });

        // Join game room
        socket.on('joinGame', (data) => {
            const { gameId } = data;
            socket.join(`game:${gameId}`);
            connectedClients.set(socket.id, { gameId, socket });

            console.log(`✅ ${socket.id} joined game: ${gameId}`);

            // Notify others
            socket.to(`game:${gameId}`).emit('player_joined', {
                socketId: socket.id,
                gameId: gameId,
                timestamp: new Date().toISOString()
            });
        });

        // Leave game room
        socket.on('leaveGame', (data) => {
            const { gameId } = data;
            socket.leave(`game:${gameId}`);
            const client = connectedClients.get(socket.id);
            if (client) {
                connectedClients.delete(socket.id);
            }

            socket.to(`game:${gameId}`).emit('player_left', {
                socketId: socket.id,
                gameId: gameId,
                timestamp: new Date().toISOString()
            });
        });

        // Sync game state
        socket.on('syncGameState', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                socket.to(`game:${client.gameId}`).emit('game_state', data);
            }
        });

        // Sync card move
        socket.on('card_move', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                socket.to(`game:${client.gameId}`).emit('card_move', data);
            }
        });

        // Presence update
        socket.on('presence_update', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                socket.to(`game:${client.gameId}`).emit('presence_update', data);
            }
        });

        socket.on('update_life', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                io.to(`game:${client.gameId}`).emit('life_change', {
                    ...data,
                    socketId: socket.id,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('add_card', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                io.to(`game:${client.gameId}`).emit('card_added', {
                    ...data,
                    socketId: socket.id,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('next_turn', (data) => {
            const client = connectedClients.get(socket.id);
            if (client) {
                io.to(`game:${client.gameId}`).emit('turn_change', {
                    ...data,
                    socketId: socket.id,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Commander damage tracking
        // Payload: { toPlayerId, fromPlayerId, delta }
        // delta is +N or -N; server clamps to 0 minimum when persisting.
        socket.on('commander_damage', async (data) => {
            const client = connectedClients.get(socket.id);
            if (!client) return;

            const { toPlayerId, fromPlayerId, delta } = data;
            if (!toPlayerId || !fromPlayerId || typeof delta !== 'number') return;

            // Broadcast immediately so all clients update optimistically
            io.to(`game:${client.gameId}`).emit('commander_damage_update', {
                toPlayerId,
                fromPlayerId,
                delta,
                timestamp: new Date().toISOString()
            });

            // Persist to DB
            try {
                const { Game } = require('./models');
                const game = await Game.findOne({ gameId: client.gameId });
                if (game) {
                    const player = game.players.find(p => p.playerId === String(toPlayerId));
                    if (player) {
                        const current = player.commanderDamage.get(String(fromPlayerId)) || 0;
                        player.commanderDamage.set(
                            String(fromPlayerId),
                            Math.max(0, current + delta)
                        );
                        game.markModified('players');
                        await game.save();
                    }
                }
            } catch (err) {
                console.error('commander_damage persist error:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
            const client = connectedClients.get(socket.id);
            if (client) {
                connectedClients.delete(socket.id);
                socket.to(`game:${client.gameId}`).emit('player_left', {
                    socketId: socket.id,
                    gameId: client.gameId,
                    timestamp: new Date().toISOString()
                });
            }
        });

    });
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spelltable-pro';

const isMockMode = process.env.MOCK_DATA === 'true';

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
}).then(() => {
    console.log('✅ MongoDB connected');
}).catch((err) => {
    if (isMockMode) {
        console.warn('⚠️ MongoDB connection failed - MOCK DATA MODE active');
        console.log('   UI will work without database');
    } else {
        console.error('❌ MongoDB connection error:', err.message);
    }
});

// Vercel serverless function handler
module.exports = app;
