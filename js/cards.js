// SpellTable Pro+ - Card State Management
// Version: 1.0.0

class CardStateManager {
    constructor() {
        this.cards = new Map();
        this.gameState = {
            library: [],
            hand: [],
            board: [],
            graveyard: [],
            exile: [],
            deck: 40
        };
        this.selectedCard = null;
        this.selectedSlot = null;
        this.history = [];
        this.maxHistory = 50;
        this.isDragging = false;
        this.draggedCard = null;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadFromIndexedDB();
        console.log('🎴 Card state manager initialized');
    }

    cacheDOM() {
        // Card slots
        this.cardSlots = document.querySelectorAll('.card-slot, .board-slot, .board-slot.empty');
        
        // Hand slots
        this.handSlots = document.querySelectorAll('.hand .card-slot');
        
        // Board slots
        this.boardSlots = document.querySelectorAll('.board-slots .board-slot');
        
        // Library and graveyard
        this.libraryCount = document.querySelector('.library-count');
        this.graveyardCount = document.querySelector('.graveyard-count');
    }

    bindEvents() {
        // Card slot clicks
        document.addEventListener('click', (e) => this.handleCardSlotClick(e));
        
        // Drag and drop
        this.setupDragAndDrop();
        
        // Keyboard shortcuts for card management
        document.addEventListener('keydown', (e) => this.handleCardKeyboard(e));
    }

    setupDragAndDrop() {
        this.cardSlots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });
            
            slot.addEventListener('dragleave', (e) => {
                slot.classList.remove('drag-over');
            });
            
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                
                if (this.draggedCard) {
                    this.moveCardToSlot(this.draggedCard, slot);
                }
            });
        });
    }

    handleCardSlotClick(e) {
        const slot = e.target.closest('.card-slot, .board-slot, .board-slot.empty');
        if (!slot) return;

        // Deselect previous slot
        if (this.selectedSlot) {
            this.selectedSlot.classList.remove('selected');
        }

        // Select new slot
        this.selectedSlot = slot;
        slot.classList.add('selected');
        
        // Check if slot has a card
        const card = this.getCardFromSlot(slot);
        if (card) {
            this.selectedCard = card;
            this.highlightCard(card);
            console.log('🎴 Selected card:', card.id);
        } else {
            this.selectedCard = null;
        }
    }

    handleCardKeyboard(e) {
        if (!this.selectedCard) return;

        switch(e.key) {
            case 'd':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.duplicateCard(this.selectedCard);
                }
                break;
            case 'del':
            case 'backspace':
                e.preventDefault();
                this.destroyCard(this.selectedCard);
                break;
            case 'm':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.moveToGraveyard(this.selectedCard);
                }
                break;
            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.moveToLibrary(this.selectedCard);
                }
                break;
        }
    }

    createCard(name, type = 'land', manaCost = 0, power = 0, toughness = 0) {
        const id = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const card = {
            id,
            name,
            type,
            manaCost,
            power,
            toughness,
            uuid: crypto.randomUUID(),
            createdAt: Date.now()
        };
        
        this.cards.set(id, card);
        this.addToHistory('create', { card });
        
        console.log(`🎴 Created card: ${name} (${type})`);
        return card;
    }

    moveCardToSlot(card, slot) {
        const slotId = slot.dataset.slot;
        const location = this.getSlotLocation(slotId);
        
        if (!location) {
            console.warn('❌ Invalid slot location');
            return;
        }

        // Remove from previous location
        this.removeCardFromLocation(card.id, location);
        
        // Add to new location
        this.addToLocation(card.id, location);
        
        // Update UI
        this.renderCardToSlot(card, slot);
        this.updateGameState();
        this.saveToIndexedDB();
        
        console.log(`🎴 Moved card ${card.name} to ${location}`);
    }

    getSlotLocation(slotId) {
        const locationMap = {
            'hand-1': 'hand', 'hand-2': 'hand', 'hand-3': 'hand', 'hand-4': 'hand', 'hand-5': 'hand',
            'board-1': 'board', 'board-2': 'board', 'board-3': 'board', 'board-4': 'board', 'board-5': 'board',
            'opp-board-1': 'opponent_board', 'opp-board-2': 'opponent_board', 'opp-board-3': 'opponent_board', 
            'opp-board-4': 'opponent_board', 'opp-board-5': 'opponent_board'
        };
        
        return locationMap[slotId];
    }

    renderCardToSlot(card, slot) {
        slot.innerHTML = '';
        slot.classList.add('filled');
        
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.draggable = true;
        cardElement.dataset.cardId = card.id;
        cardElement.title = card.name;
        
        // Card visual
        cardElement.innerHTML = `
            <div class="card-inner">
                <div class="card-type">${this.getCardTypeIcon(card.type)}</div>
                <div class="card-name">${card.name.substring(0, 15)}</div>
                ${card.type !== 'land' ? `
                    <div class="card-stats">
                        <span class="power">${card.power || 0}</span>
                        <span class="toughness">${card.toughness || 0}</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        slot.appendChild(cardElement);
        
        // Add drag events
        cardElement.addEventListener('dragstart', (e) => this.handleCardDragStart(e, card));
    }

    getCardTypeIcon(type) {
        const typeIcons = {
            'land': '🌲',
            'creature': '⚔️',
            'instant': '⚡',
            'sorcery': '📜',
            'enchantment': '✨',
            'artifact': '🔧'
        };
        
        return typeIcons[type] || '❓';
    }

    getCardFromSlot(slot) {
        const cardId = slot.querySelector('.card')?.dataset.cardId;
        if (cardId) {
            return this.cards.get(cardId);
        }
        return null;
    }

    addToLocation(cardId, location) {
        if (!this.gameState[location]) {
            console.error(`❌ Invalid location: ${location}`);
            return;
        }
        
        this.gameState[location].push(cardId);
    }

    removeCardFromLocation(cardId, location) {
        if (!this.gameState[location]) return;
        
        const index = this.gameState[location].indexOf(cardId);
        if (index !== -1) {
            this.gameState[location].splice(index, 1);
        }
    }

    updateGameState() {
        // Update library count
        this.libraryCount.textContent = `${this.gameState.deck} cards remaining`;
        
        // Update graveyard count
        const graveyardCount = this.gameState.graveyard.length;
        this.graveyardCount.textContent = graveyardCount === 0 ? 'Empty' : `${graveyardCount} cards`;
        
        // Update AI analysis
        if (window.spellTableApp && window.spellTableApp.updateAIAnalysis) {
            window.spellTableApp.updateAIAnalysis();
        }
    }

    duplicateCard(card) {
        const newCard = this.createCard(
            `${card.name} (Copy)`,
            card.type,
            card.manaCost,
            card.power,
            card.toughness
        );
        
        console.log(`🎴 Duplicated card: ${card.name} → ${newCard.name}`);
        return newCard;
    }

    destroyCard(card) {
        if (!card) return;
        
        this.moveToGraveyard(card);
        this.cards.delete(card.id);
        
        console.log(`🎴 Destroyed card: ${card.name}`);
        
        // Update UI
        this.updateGameState();
    }

    moveToGraveyard(card) {
        const graveyardSlot = document.querySelector('.graveyard .board-slots');
        if (graveyardSlot) {
            const slot = graveyardSlot.querySelector('.board-slot.empty');
            if (slot) {
                this.moveCardToSlot(card, slot);
            }
        }
    }

    moveToLibrary(card) {
        console.log(`🎴 Moved ${card.name} to library`);
        // Implementation would shuffle card back into library
    }

    highlightCard(card) {
        // Remove previous highlights
        document.querySelectorAll('.card').forEach(el => {
            el.style.boxShadow = '';
            el.style.borderColor = '';
        });
        
        // Highlight selected card
        const cardElement = document.querySelector(`.card[data-card-id="${card.id}"]`);
        if (cardElement) {
            cardElement.style.boxShadow = '0 0 0 3px var(--primary-color)';
            cardElement.style.borderColor = 'var(--primary-color)';
        }
    }

    addToHistory(action, data) {
        this.history.push({
            action,
            data,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    undo() {
        if (this.history.length === 0) {
            console.warn('⚠️ No history to undo');
            return;
        }
        
        const lastAction = this.history.pop();
        console.log('↩️ Undoing:', lastAction.action);
        
        // Implement undo logic based on action type
        switch(lastAction.action) {
            case 'create':
                this.cards.delete(lastAction.data.card.id);
                break;
            case 'move':
                // Implement move undo
                break;
            case 'destroy':
                // Implement destroy undo (restore card)
                break;
        }
        
        this.updateGameState();
        this.saveToIndexedDB();
    }

    redo() {
        console.warn('↪️ Redo not yet implemented');
    }

    async saveToIndexedDB() {
        if (!window.spellTableApp?.db) {
            console.warn('❌ Database not initialized');
            return;
        }
        
        try {
            const tx = window.spellTableApp.db.transaction(['cards', 'gamestate'], 'readwrite');
            const cardsStore = tx.objectStore('cards');
            const gameStateStore = tx.objectStore('gamestate');
            
            // Save all cards
            for (const [id, card] of this.cards.entries()) {
                await cardsStore.put({ id, card });
            }
            
            // Save game state
            await gameStateStore.put({
                id: 'current',
                state: this.gameState
            });
            
            console.log('💾 Card state saved to IndexedDB');
            
        } catch (error) {
            console.error('❌ Error saving to IndexedDB:', error);
        }
    }

    async loadFromIndexedDB() {
        if (!window.spellTableApp?.db) {
            console.log('ℹ️ IndexedDB not initialized, skipping load');
            return;
        }
        
        try {
            const tx = window.spellTableApp.db.transaction(['cards', 'gamestate'], 'readonly');
            const cardsStore = tx.objectStore('cards');
            const gameStateStore = tx.objectStore('gamestate');
            
            // Load cards
            const cardsResult = await new Promise((resolve, reject) => {
                const request = cardsStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            cardsResult.forEach(result => {
                this.cards.set(result.id, result.card);
            });
            
            // Load game state
            const gameStateResult = await new Promise((resolve, reject) => {
                const request = gameStateStore.get('current');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (gameStateResult) {
                this.gameState = gameStateResult.state;
            }
            
            console.log('💾 Card state loaded from IndexedDB');
            this.renderAllCards();
            
        } catch (error) {
            console.error('❌ Error loading from IndexedDB:', error);
        }
    }

    renderAllCards() {
        // Render hand cards
        const handSlots = document.querySelectorAll('.hand .card-slot');
        handSlots.forEach((slot, index) => {
            const cardId = this.gameState.hand[index];
            if (cardId) {
                const card = this.cards.get(cardId);
                if (card) {
                    this.renderCardToSlot(card, slot);
                }
            }
        });
        
        // Render board cards
        const boardSlots = document.querySelectorAll('.board-slots .board-slot');
        boardSlots.forEach((slot, index) => {
            const cardId = this.gameState.board[index];
            if (cardId) {
                const card = this.cards.get(cardId);
                if (card) {
                    this.renderCardToSlot(card, slot);
                }
            }
        });
    }

    getRandomCard() {
        const cardIds = Array.from(this.cards.keys());
        if (cardIds.length === 0) {
            return null;
        }
        
        const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
        return this.cards.get(randomId);
    }

    getCardStats() {
        return {
            totalCards: this.cards.size,
            librarySize: this.gameState.deck,
            handSize: this.gameState.hand.length,
            boardSize: this.gameState.board.length,
            graveyardSize: this.gameState.graveyard.length
        };
    }
}

// Initialize card manager
document.addEventListener('DOMContentLoaded', () => {
    window.cardManager = new CardStateManager();
});
