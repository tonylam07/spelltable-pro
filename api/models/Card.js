// Card Database Service - Scryfall API Integration
const axios = require('axios');

class CardDatabase {
    constructor() {
        this.baseUrl = 'https://api.scryfall.com';
        this.cache = new Map();
        this.cacheTimeout = 3600000; // 1 hour cache
    }

    /**
     * Search Magic cards by query
     * @param {string} query - Search query (card name, keyword, etc.)
     * @returns {Promise<Object>} Search results
     */
    async search(query) {
        const cacheKey = `search:${query}`;
        if (this._isCached(cacheKey)) return this._getCached(cacheKey);

        try {
            const response = await axios.get(`${this.baseUrl}/cards/search`, {
                params: { q: query, order: 'name' },
                headers: { 'User-Agent': 'SpellTablePro/1.0' }
            });

            this._cacheSet(cacheKey, response.data);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return { object: 'list', total_cards: 0, data: [] };
            }
            throw error;
        }
    }

    /**
     * Get card by exact name
     * @param {string} name - Exact card name
     * @returns {Promise<Object>} Card details
     */
    async getByName(name) {
        const cacheKey = `card:${name}`;
        if (this._isCached(cacheKey)) return this._getCached(cacheKey);

        try {
            const response = await axios.get(`${this.baseUrl}/cards/named`, {
                params: { named: name },
                headers: { 'User-Agent': 'SpellTablePro/1.0' }
            });

            this._cacheSet(cacheKey, response.data);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Card "${name}" not found`);
            }
            throw error;
        }
    }

    /**
     * Get card by Scryfall ID
     * @param {string} id - Scryfall card ID
     * @returns {Promise<Object>} Card details
     */
    async getById(id) {
        const cacheKey = `id:${id}`;
        if (this._isCached(cacheKey)) return this._getCached(cacheKey);

        try {
            const response = await axios.get(`${this.baseUrl}/cards/${id}`, {
                headers: { 'User-Agent': 'SpellTablePro/1.0' }
            });

            this._cacheSet(cacheKey, response.data);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Card with ID "${id}" not found`);
            }
            throw error;
        }
    }

    /**
     * Get card images for a card
     * @param {string} cardName - Card name
     * @returns {Promise<string>} High-res image URL
     */
    async getImageUrl(cardName) {
        try {
            const card = await this.getByName(cardName);
            return card.image_uris?.high_res || card.image_uris?.border_crop;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get popular/recent cards
     * @param {number} limit - Number of cards (default: 50)
     * @returns {Promise<Array>} List of recent cards
     */
    async getRecent(limit = 50) {
        const cacheKey = `recent:${limit}`;
        if (this._isCached(cacheKey)) return this._getCached(cacheKey);

        const response = await axios.get(`${this.baseUrl}/cards`, {
            params: { order: 'released', descending: true, pageSize: limit },
            headers: { 'User-Agent': 'SpellTablePro/1.0' }
        });

        this._cacheSet(cacheKey, response.data.data);
        return response.data.data;
    }

    /**
     * Check if card is valid Magic card
     * @param {string} cardName - Card name to validate
     * @returns {Promise<boolean>} True if valid
     */
    async isValidCard(cardName) {
        try {
            await this.getByName(cardName);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Cache helpers
    _isCached(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        return Date.now() - entry.timestamp < this.cacheTimeout;
    }

    _getCached(key) {
        return this.cache.get(key).data;
    }

    _cacheSet(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            hits: 0, // Would need to track hits
            misses: 0
        };
    }
}

// Singleton instance
const cardDatabase = new CardDatabase();

module.exports = cardDatabase;
