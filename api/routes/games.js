// Game CRUD Routes
const express = require('express');
const router = express.Router();
const { Game } = require('../models');
const { validateGameId, validatePlayerId } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/games/:gameId/start
 * @desc    Start a game from the lobby
 * @access  Private (Host only)
 */
router.post('/:gameId/start', [authenticate, validateGameId], async (req, res) => {
    try {
        const game = await Game.findOne({ gameId: req.params.gameId });

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        if (game.hostId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Only the game host can start the game'
            });
        }

        game.status = 'active';
        await game.save();

        res.json({
            success: true,
            message: 'Game started',
            data: { status: game.status }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/games
 * @desc    Get all games (for host dashboard)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { status, limit } = req.query;
        const query = {};
        
        if (status) query.status = status;
        const limitCount = parseInt(limit) || 10;
        
        const games = await Game.find(query)
            .sort({ updatedAt: -1 })
            .limit(limitCount)
            .select('-__v -gameLog');
        
        res.json({
            success: true,
            count: games.length,
            data: games
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/games/:gameId
 * @desc    Get single game by ID
 * @access  Public
 */
router.get('/:gameId', [validateGameId], async (req, res) => {
    try {
        const game = await Game.findOne({ gameId: req.params.gameId })
            .select('-__v -gameLog');
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }
        
        res.json({
            success: true,
            data: game
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/games
 * @desc    Create new game
 * @access  Private
 */
router.post('/', [authenticate], async (req, res) => {
    try {
        const { playerName, gameMode, format, isPublic, maxPlayers, name } = req.body;

        const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newGame = new Game({
            gameId,
            hostId: req.user.id,
            currentPlayerIndex: 0,
            turnNumber: 1,
            gameMode: gameMode || 'casual',
            format: format || 'commander',
            isPublic: Boolean(isPublic),
            maxPlayers: Math.max(2, Math.min(6, parseInt(maxPlayers) || 4)),
            name: (name || '').trim(),
            players: [{
                playerId: `player-${Date.now()}`,
                playerName: playerName || 'Player 1',
                lifeTotal: 20,
                handSize: 7,
                libraryCount: 60,
                boardSlots: []
            }]
        });

        await newGame.save();

        res.status(201).json({
            success: true,
            message: 'Game created',
            data: {
                gameId: newGame.gameId,
                hostId: newGame.hostId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/games/:gameId/join
 * @desc    Player joins a game
 * @access  Public
 */
router.post('/:gameId/join', [validateGameId], async (req, res) => {
    try {
        const { playerId, playerName } = req.body;
        const game = await Game.findOne({ gameId: req.params.gameId });
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }
        
        // Check if player already exists
        const existingPlayer = game.players.find(p => p.playerId === playerId);
        if (existingPlayer) {
            return res.status(400).json({
                success: false,
                error: 'Player already in game'
            });
        }
        
        const maxPlayers = game.maxPlayers || 6;
        if (game.players.length >= maxPlayers) {
            return res.status(400).json({
                success: false,
                error: `Game full (max ${maxPlayers} players)`
            });
        }
        
        game.players.push({
            playerId,
            playerName: playerName || `Player ${game.players.length + 1}`,
            lifeTotal: 20,
            handSize: 7,
            libraryCount: 60,
            graveyardCount: 0,
            boardSlots: []
        });
        
        await game.save();
        
        res.json({
            success: true,
            message: 'Joined game',
            data: {
                playerId,
                playersCount: game.players.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/games/:gameId/turn
 * @desc    Advance to next turn
 * @access  Public
 */
router.put('/:gameId/turn', [validateGameId], async (req, res) => {
    try {
        const game = await Game.findOne({ gameId: req.params.gameId });
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }
        
        await game.advanceTurn();
        
        res.json({
            success: true,
            data: {
                turnNumber: game.turnNumber,
                currentPlayerIndex: game.currentPlayerIndex
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   PUT /api/games/:gameId/life/:playerId
 * @desc    Update player life total
 * @access  Public
 */
router.put('/:gameId/life/:playerId', [validateGameId, validatePlayerId], async (req, res) => {
    try {
        const { lifeTotal } = req.body;
        
        if (typeof lifeTotal !== 'number' || lifeTotal < 0 || lifeTotal > 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid life total (must be 0-100)'
            });
        }
        
        const result = await Game.updateGameLife(
            req.params.gameId, 
            req.params.playerId, 
            lifeTotal
        );
        
        res.json({
            success: true,
            message: 'Life updated',
            data: {
                playerId: req.params.playerId,
                lifeTotal
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

/**
 * @route   DELETE /api/games/:gameId
 * @desc    Delete a game
 * @access  Private (Owner only)
 */
router.delete('/:gameId', [authenticate, validateGameId], async (req, res) => {
    try {
        const game = await Game.findOne({ gameId: req.params.gameId });

        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        // Ownership check
        if (game.hostId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Only the game host can delete this game'
            });
        }

        await Game.deleteOne({ _id: game._id });

        res.json({
            success: true,
            message: 'Game deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
});

// Public game browser — lists lobby games with open seats.
router.get('/browse/public', async (req, res) => {
    try {
        const { format, limit } = req.query;
        const query = { isPublic: true, status: 'lobby' };
        if (format) query.format = format;

        const games = await Game.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) || 30)
            .populate('hostId', 'displayName username avatarUrl')
            .select('-__v -gameLog -invites');

        const open = games
            .filter(g => g.players.length < g.maxPlayers)
            .map(g => ({
                gameId: g.gameId,
                name: g.name || `${g.hostId?.displayName || 'Host'}'s game`,
                format: g.format,
                gameMode: g.gameMode,
                host: g.hostId,
                players: g.players.length,
                maxPlayers: g.maxPlayers,
                createdAt: g.createdAt
            }));

        res.json({ success: true, count: open.length, data: open });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Invite a user to a game. Host only.
router.post('/:gameId/invites', [authenticate, validateGameId], async (req, res) => {
    try {
        const { userId } = req.body;
        if (!require('mongoose').isValidObjectId(userId)) {
            return res.status(400).json({ success: false, error: 'Invalid userId' });
        }
        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) return res.status(404).json({ success: false, error: 'Game not found' });
        if (game.hostId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only host can invite' });
        }

        const already = game.invites.find(i => i.userId.toString() === userId && i.status === 'pending');
        if (already) return res.status(409).json({ success: false, error: 'Already invited' });

        game.invites.push({ userId, invitedBy: req.user.id, status: 'pending' });
        await game.save();

        // Broadcast so recipient gets it in real time if online.
        const io = req.app.get('io');
        if (io) io.to(`user:${userId}`).emit('game_invite', {
            gameId: game.gameId,
            name: game.name,
            format: game.format,
            invitedBy: req.user.id,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ success: true, data: game.invites[game.invites.length - 1] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List my pending invites.
router.get('/invites/mine', [authenticate], async (req, res) => {
    try {
        const games = await Game.find({
            invites: { $elemMatch: { userId: req.user.id, status: 'pending' } },
            status: 'lobby'
        }).populate('hostId', 'displayName username avatarUrl').select('gameId name format gameMode hostId maxPlayers players invites createdAt');

        const data = games.map(g => {
            const invite = g.invites.find(i => i.userId.toString() === req.user.id && i.status === 'pending');
            return {
                inviteId: invite._id,
                gameId: g.gameId,
                name: g.name,
                format: g.format,
                gameMode: g.gameMode,
                host: g.hostId,
                players: g.players.length,
                maxPlayers: g.maxPlayers,
                invitedAt: invite.createdAt
            };
        });
        res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Respond to an invite.
router.patch('/:gameId/invites/me', [authenticate, validateGameId], async (req, res) => {
    try {
        const { action } = req.body; // 'accept' | 'decline'
        const game = await Game.findOne({ gameId: req.params.gameId });
        if (!game) return res.status(404).json({ success: false, error: 'Game not found' });

        const invite = game.invites.find(i => i.userId.toString() === req.user.id && i.status === 'pending');
        if (!invite) return res.status(404).json({ success: false, error: 'No pending invite' });

        if (action === 'accept') invite.status = 'accepted';
        else if (action === 'decline') invite.status = 'declined';
        else return res.status(400).json({ success: false, error: 'Invalid action' });

        await game.save();
        res.json({ success: true, data: { gameId: game.gameId, status: invite.status } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
