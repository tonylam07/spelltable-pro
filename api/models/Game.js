// Game Model - MongoDB Schema for TCG Games
const mongoose = require('mongoose');

const CardSlotSchema = new mongoose.Schema({
    cardName: { type: String, default: '' },
    cardId: { type: String, default: '' }, // Scryfall ID
    cardType: { type: String, enum: ['creature', 'land', 'sorcery', 'instant', 'artifact', 'enchantment', 'planeswalker'], default: '' },
    power: { type: Number, default: 0 },
    toughness: { type: Number, default: 0 },
    isTapped: { type: Boolean, default: false },
    imageUrl: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const PlayerSchema = new mongoose.Schema({
    playerId: { type: String, required: true, unique: true },
    playerName: { type: String, required: true },
    lifeTotal: { type: Number, default: 20 },
    handSize: { type: Number, default: 7 },
    libraryCount: { type: Number, default: 60 },
    graveyardCount: { type: Number, default: 0 },
    boardSlots: [CardSlotSchema],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const GameSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String, 
        enum: ['lobby', 'active', 'paused', 'completed'], 
        default: 'lobby' 
    },
    players: [PlayerSchema],
    currentPlayerIndex: { type: Number, default: 0 },
    turnNumber: { type: Number, default: 1 },
    gameMode: {
        type: String,
        enum: ['casual', 'tournament', 'ranked'],
        default: 'casual'
    },
    format: {
        type: String,
        enum: ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'pauper', 'draft', 'sealed', 'casual'],
        default: 'commander'
    },
    maxPlayers: { type: Number, default: 4, min: 2, max: 6 },
    isPublic: { type: Boolean, default: false, index: true },
    name: { type: String, default: '', trim: true, maxlength: 80 },
    invites: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
    }],
    deckInfo: {
        player1: { type: String, default: '' },
        player2: { type: String, default: '' }
    },
    gameLog: [{
        timestamp: { type: Date, default: Date.now },
        action: { type: String, required: true },
        details: { type: mongoose.Schema.Types.Mixed, default: {} }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Indexes for performance
GameSchema.index({ status: 1 });
GameSchema.index({ hostId: 1 });

// Virtual for current player
GameSchema.virtual('currentPlayer').get(function() {
    if (this.players.length > 0 && this.currentPlayerIndex >= 0) {
        return this.players[this.currentPlayerIndex];
    }
    return null;
});

// Virtual for game duration
GameSchema.virtual('duration').get(function() {
    return Date.now() - this.createdAt;
});

// Methods
GameSchema.methods.addGameLog = function(action, details = {}) {
    this.gameLog.push({ action, details, timestamp: new Date() });
    this.updatedAt = Date.now();
    return this.save();
};

GameSchema.methods.advanceTurn = function() {
    this.turnNumber++;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.updatedAt = Date.now();
    return this.save();
};

GameSchema.methods.updatePlayerLife = function(playerId, newLife) {
    const player = this.players.id(playerId);
    if (player) {
        player.lifeTotal = newLife;
        this.addGameLog('life_update', { playerId, newLife });
        return this.save();
    }
    return Promise.reject('Player not found');
};

// Remove virtuals from toJSON output
GameSchema.set('toJSON', { virtuals: true });
GameSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Game', GameSchema);
