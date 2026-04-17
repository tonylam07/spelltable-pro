// Card Search Routes - Scryfall API Integration
const express = require('express');
const router = express.Router();
const { cardDatabase } = require('../models');

/**
 * @route   GET /api/cards/search
 * @desc    Search Magic cards by query
 * @access  Public
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Search query required'
            });
        }
        
        const results = await cardDatabase.search(q);
        
        res.json({
            success: true,
            data: {
                totalCards: results.total_cards,
                cards: results.data.slice(0, 50) // Limit to 50 results
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Search failed',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/cards/image/:name
 * @desc    Get high-res image URL for card
 * @access  Public
 */
router.get('/image/:name', async (req, res) => {
    try {
        const imageUrl = await cardDatabase.getImageUrl(req.params.name);
        
        if (!imageUrl) {
            return res.status(404).json({
                success: false,
                error: 'Card not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                imageUrl,
                cardName: req.params.name
            }
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Card not found',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/cards/recent
 * @desc    Get recently released cards
 * @access  Public
 */
router.get('/recent', async (req, res) => {
    try {
        const { limit } = req.query;
        const limitCount = parseInt(limit) || 20;
        
        const recentCards = await cardDatabase.getRecent(limitCount);
        
        res.json({
            success: true,
            data: {
                count: recentCards.length,
                cards: recentCards
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent cards',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/cards/validate/:name
 * @desc    Validate if a card exists
 * @access  Public
 */
router.get('/validate/:name', async (req, res) => {
    try {
        const isValid = await cardDatabase.isValidCard(req.params.name);
        
        res.json({
            success: true,
            data: {
                valid: isValid,
                cardName: req.params.name
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/cards/stats
 * @desc    Get card database cache statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = cardDatabase.getCacheStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

// Generic `/:name` comes last so it doesn't shadow `/recent`, `/validate/*`, `/stats`, `/image/*`.
router.get('/:name', async (req, res) => {
    try {
        const card = await cardDatabase.getByName(req.params.name);
        res.json({ success: true, data: card });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Card not found',
            message: error.message
        });
    }
});

module.exports = router;
