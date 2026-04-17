// Input Validation Middleware
const { validationResult } = require('express-validator');

/**
 * Validate game ID format
 */
function validateGameId(req, res, next) {
    const gameId = req.params.gameId;
    
    if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid game ID'
        });
    }
    
    // Basic format check: game-<timestamp>-<random>
    if (!gameId.startsWith('game-')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid game ID format'
        });
    }
    
    next();
}

/**
 * Validate player ID format
 */
function validatePlayerId(req, res, next) {
    const playerId = req.params.playerId;
    
    if (!playerId || typeof playerId !== 'string' || playerId.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid player ID'
        });
    }
    
    next();
}

/**
 * Validate search query
 */
function validateSearchQuery(req, res, next) {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Search query required'
        });
    }
    
    if (q.trim().length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Search query too long (max 100 chars)'
        });
    }
    
    next();
}

/**
 * Validate card name parameter
 */
function validateCardName(req, res, next) {
    const name = req.params.name;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Card name required'
        });
    }
    
    if (name.length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Card name too long'
        });
    }
    
    next();
}

// Express Validator middleware for complex validation
const { body, param, query } = require('express-validator');

const validateLifeUpdate = [
    param('gameId').isString().withMessage('Invalid game ID'),
    param('playerId').isString().withMessage('Invalid player ID'),
    body('lifeTotal')
        .isFloat({ min: 0, max: 100 })
        .withMessage('Life total must be between 0 and 100')
        .withMessage('Life total must be a number'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        next();
    }
];

const validateGameCreation = [
    body('hostId')
        .isString()
        .notEmpty()
        .withMessage('Host ID is required'),
    body('playerName')
        .optional()
        .isString()
        .isLength({ max: 50 })
        .withMessage('Player name must be 50 characters or less'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        next();
    }
];

module.exports = {
    validateGameId,
    validatePlayerId,
    validateSearchQuery,
    validateCardName,
    validateLifeUpdate,
    validateGameCreation
};
