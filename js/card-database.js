// SpellTable Pro+ - Card Database Integration
// Integration with Scryfall API for real Magic: The Gathering card data

class CardDatabase {
    constructor() {
        this.apiBase = 'https://api.scryfall.com';
        this.cache = new Map();
        this.searchQueue = [];
        this.isSearching = false;
    }

    // Search cards by name or query
    async search(query, options = {}) {
        const { type, manaCost, page = 1 } = options;
        
        // Build search query
        let scryfallQuery = `name:"${query}"`;
        
        if (type) {
            scryfallQuery += ` type:"${type}"`;
        }
        
        if (manaCost) {
            scryfallQuery += ` cmc:${manaCost}`;
        }
        
        console.log(`🔍 Searching Scryfall API: ${scryfallQuery}`);
        
        try {
            const response = await fetch(
                `${this.apiBase}/cards/search?q=${encodeURIComponent(scryfallQuery)}&order=set&page=${page}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'SpellTable-Pro/1.0'
                    }
                }
            );
            
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('⚠️ Scryfall API rate limit reached');
                    throw new Error('Rate limit exceeded');
                }
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Cache results
            this.cache.set(scryfallQuery, data);
            
            return {
                cards: data.data || [],
                total: data.total_cards || 0,
                hasMore: data.has_more || false
            };
            
        } catch (error) {
            console.error('❌ Scryfall API error:', error);
            return {
                cards: [],
                total: 0,
                hasMore: false,
                error: error.message
            };
        }
    }

    // Get specific card by name
    async getCard(cardName) {
        const cacheKey = `card:${cardName.toLowerCase()}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `${this.apiBase}/cards/named?exact=${encodeURIComponent(cardName)}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'SpellTable-Pro/1.0'
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const card = await response.json();

            // Cache the card
            this.cache.set(cacheKey, card);

            return {
                id: card.id,
                name: card.name,
                type_line: card.type_line,
                mana_cost: card.mana_cost,
                oracle_text: card.oracle_text,
                power: card.power || 0,
                toughness: card.toughness || 0,
                rarity: card.rarity,
                artist: card.artist,
                images: {
                    card_normal: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
                    card_art_crop: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop
                },
                set: card.set,
                set_name: card.set_name
            };

        } catch (error) {
            console.error('❌ Card lookup error:', error);
            return null;
        }
    }

    // Get card by Scryfall ID
    async getCardById(cardId) {
        const cacheKey = `cardId:${cardId}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `${this.apiBase}/cards/${encodeURIComponent(cardId)}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'SpellTable-Pro/1.0'
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const card = await response.json();

            // Cache the card
            this.cache.set(cacheKey, card);

            return {
                id: card.id,
                name: card.name,
                type_line: card.type_line,
                mana_cost: card.mana_cost,
                oracle_text: card.oracle_text,
                power: card.power || 0,
                toughness: card.toughness || 0,
                rarity: card.rarity,
                artist: card.artist,
                imageUrl: card.image_uris?.normal,
                set: card.set,
                set_name: card.set_name
            };

        } catch (error) {
            console.error('❌ Card ID lookup error:', error);
            return null;
        }
    }

    // Add card to board with image
    async renderCardToBoard(playerId, cardId, imageUrl) {
        const cardData = await this.getCardById(cardId);

        const finalImageUrl = cardData?.imageUrl || imageUrl || null;

        // Trigger a card render event
        const event = new CustomEvent('render-board-card', {
            detail: {
                playerId,
                cardId,
                imageUrl: finalImageUrl
            }
        });
        window.dispatchEvent(event);
    }

    // Build a deck of common cards for testing
    async getCommonCards() {
        const commonTypes = ['land', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment'];
        const cards = [];
        
        for (const type of commonTypes) {
            const result = await this.search('', { type, page: 1 });
            if (result.cards && result.cards.length > 0) {
                // Get a few cards of each type
                for (let i = 0; i < 3; i++) {
                    const card = result.cards[i];
                    if (card) {
                        cards.push({
                            name: card.name,
                            type: card.type_line.split('—')[0].trim(),
                            manaCost: this.parseManaCost(card.mana_cost),
                            power: card.power ? parseInt(card.power) : 0,
                            toughness: card.toughness ? parseInt(card.toughness) : 0
                        });
                    }
                }
            }
        }
        
        return cards;
    }

    // Parse mana cost from Scryfall format
    parseManaCost(manaCost) {
        if (!manaCost) return 0;
        
        // Count colored mana symbols
        const colored = (manaCost.match(/[GWUB]/g) || []).length;
        const colorless = (manaCost.match(/[0-9]/g) || []).length;
        
        return colored + colorless;
    }

    // Get card recommendations based on board state
    getRecommendations(boardState) {
        const recommendations = [];
        const boardCards = boardState.detectedCards || [];
        const detectedMana = boardCards.reduce((sum, card) => sum + card.manaCost, 0);
        
        if (boardCards.length === 0) {
            recommendations.push({
                type: 'land',
                priority: 1,
                reason: 'Start by playing lands'
            });
        } else if (detectedMana < 3 && boardCards.every(c => c.type === 'land')) {
            recommendations.push({
                type: 'creature',
                priority: 2,
                manaCost: 2,
                reason: 'Play a 2-mana creature'
            });
        } else if (detectedMana >= 3) {
            recommendations.push({
                type: 'creature',
                priority: 2,
                manaCost: 3,
                reason: 'Consider playing a 3-mana creature'
            });
            
            if (boardCards.length >= 4) {
                recommendations.push({
                    type: 'spell',
                    priority: 3,
                    reason: 'Consider playing a spell or attacking'
                });
            }
        }
        
        return recommendations;
    }

    // Export detected cards to JSON
    exportCards(cards) {
        const json = JSON.stringify(cards, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `spelltable-cards-${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        console.log('💾 Cards exported');
    }
}

// Initialize and bind to UI
document.addEventListener('DOMContentLoaded', () => {
    window.cardDatabase = new CardDatabase();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CardDatabase;
}

document.addEventListener('DOMContentLoaded', () => {
    // Add export button to AI detection section
    const startBtn = document.getElementById('start-ai');
    if (startBtn) {
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-sm btn-secondary';
        exportBtn.textContent = '📥 Export';
        exportBtn.onclick = () => {
            if (window.aiDetection) {
                window.cardDatabase.exportCards(window.aiDetection.detectedCards);
            }
        };
        exportBtn.style.marginLeft = '0.5rem';
        
        const aiStatus = document.querySelector('.ai-status');
        if (aiStatus) {
            aiStatus.appendChild(exportBtn);
        }
    }
    
    // Add card search functionality
    const searchContainer = document.createElement('div');
    searchContainer.innerHTML = `
        <div style="margin: 1rem 0;">
            <input type="text" id="card-search" placeholder="Search for cards..." 
                   style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); 
                          border-radius: var(--radius-sm); background: var(--bg-secondary); 
                          color: var(--text-primary);">
            <div id="search-results" style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;"></div>
        </div>
    `;
    
    const aiSection = document.querySelector('.ai-section');
    if (aiSection) {
        aiSection.insertBefore(searchContainer, aiSection.firstChild);
    }
    
    // Add search listener
    document.getElementById('card-search')?.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            document.getElementById('search-results').innerHTML = '';
            return;
        }
        
        const results = await window.cardDatabase.search(query);
        const resultsContainer = document.getElementById('search-results');
        
        if (results.error) {
            resultsContainer.innerHTML = `<p style="color: var(--danger-color);">${results.error}</p>`;
            return;
        }
        
        if (results.cards.length === 0) {
            resultsContainer.innerHTML = '<p>No cards found</p>';
            return;
        }
        
        const html = results.cards.slice(0, 20).map(card => `
            <div class="detection-item" onclick="window.cardDatabase.addToBoard(${JSON.stringify(card).replace(/"/g, '&quot;')})">
                <span class="detection-icon">🎴</span>
                <span class="detection-text">
                    <strong>${card.name}</strong> 
                    (${card.type_line.split('—')[0].trim()})
                </span>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${card.set_name}
                </span>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = html;
    });
});
