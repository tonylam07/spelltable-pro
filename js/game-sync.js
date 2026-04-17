// SpellTable Pro+ - WebSocket Game Sync (Socket.io Version)
// Real-time synchronization between players using Socket.io

class GameSync {
    constructor() {
        this.socket = null;
        this.gameId = null;
        this.isConnected = false;
        this.pendingEvents = [];
        this.moveThrottleTimeout = null;
        this.init();
    }

    init() {
        console.log('🔄 Game sync initialized (Socket.io)');
        this.initCardRendering();
        // Don't auto-connect - we need a game ID first
    }

    async connect(gameId) {
        console.log('🔌 Attempting Socket.io connection to:', window.location.origin);
        console.log('   Hostname:', window.location.hostname);
        if (this.isConnected) {
            console.log('✅ Already connected');
            return;
        }

        const wsUrl = window.location.origin; // Socket.io handles protocol (ws/wss) automatically

        try {
            // Initialize Socket.io connection
            this.socket = io(wsUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('🔗 Socket.io connected');
                this.isConnected = true;
                this.gameId = gameId;

                // Join game room
                this.joinGame(gameId);

                // Subscribe to personal notification room so invites arrive in real time.
                const userId = localStorage.getItem('userId');
                if (userId) this.socket.emit('subscribe_user', { userId });

                // Process pending events
                this.flushPendingEvents();
            });

            this.socket.on('game_invite', (payload) => {
                console.log('📨 Game invite received', payload);
                const badge = document.querySelector('a[href="social.html"] .invite-dot');
                if (badge) badge.classList.remove('hidden');
                if (window.showToast) window.showToast(`Game invite: ${payload.name || payload.gameId}`);
            });

            this.socket.on('disconnect', () => {
                console.log('🔌 Socket.io disconnected');
                this.isConnected = false;
            });

            this.socket.on('connect_error', (error) => {
                console.warn('⚠️ Socket.io connection error:', error.message);
                // Don't show connection error in mock mode - just continue without real-time sync
                if (window.location.hostname === 'localhost') {
                    console.log('ℹ️ Running in mock mode - real-time sync disabled');
                }
            });

            // --- Event Handlers ---

            this.socket.on('game_state', (game) => this.onGameStateUpdate(game));
            this.socket.on('turn_change', (data) => this.onTurnChange(data));
            this.socket.on('life_change', (data) => this.onLifeChange(data));
            this.socket.on('card_added', (data) => this.onCardAdded(data));
            this.socket.on('player_joined', (data) => {
                this.onPlayerJoined(data);
                // We are an existing player — initiate WebRTC call to the newcomer.
                // video.js handles the case where localStream isn't ready yet.
                if (data.socketId && data.socketId !== this.socket.id) {
                    window.videoManager?.initiateCall(data.socketId);
                }
            });
            this.socket.on('player_left', (data) => {
                this.onPlayerLeft(data);
                // Tear down the peer connection and restore their video slot.
                if (data.socketId) {
                    window.videoManager?.handlePeerLeft(data.socketId);
                }
            });
            this.socket.on('presence_update', (data) => this.onPresenceUpdate(data));
            this.socket.on('card_move', (data) => this.onCardMove(data));

        } catch (error) {
            console.error('❌ Socket.io connection failed:', error);
            this.showConnectionError();
        }
    }

    joinGame(gameId) {
        this.gameId = gameId;
        this.socket.emit('joinGame', { gameId: gameId });
        console.log(`🎮 Joined game: ${gameId}`);
    }

    sendMessage(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
            console.log(`📤 Sending ${event}:`, data);
        } else {
            console.warn(`⚠️ Socket not connected, queuing ${event}`);
            this.pendingEvents.push({ event, data });
        }
    }

    flushPendingEvents() {
        while (this.pendingEvents.length > 0) {
            const { event, data } = this.pendingEvents.shift();
            this.sendMessage(event, data);
        }
    }

    // --- Presence & Movement ---

    emitPresence(action, details = {}) {
        this.sendMessage('presence_update', {
            action,
            playerId: window.spellTableApp?.currentUser?.id,
            ...details
        });
    }

    emitCardMove(cardId, x, y) {
        // Throttle movements to every 50ms to prevent flooding
        if (this.moveThrottleTimeout) return;

        this.moveThrottleTimeout = setTimeout(() => {
            this.sendMessage('card_move', {
                cardId,
                x,
                y,
                playerId: window.spellTableApp?.currentUser?.id
            });
            this.moveThrottleTimeout = null;
        }, 50);
    }

    // --- Handler Implementations ---

    onGameStateUpdate(game) {
        window.spellTableApp.gameState = game;
        this.renderGameState(game);
        console.log('📊 Game state updated');
    }

    onTurnChange(data) {
        if (window.spellTableApp) {
            window.spellTableApp.gameState.turn = data.turn;
            window.spellTableApp.gameState.currentPlayer = data.currentPlayer;
            document.getElementById('turn-display').textContent = data.turn;
            this.highlightCurrentPlayer(data.currentPlayer);
        }
    }

    onLifeChange(data) {
        const lifeInput = document.getElementById(`life-input-${data.playerId}`);
        if (lifeInput) {
            lifeInput.value = data.life;
            if (window.spellTableApp) {
                window.spellTableApp.gameState.life = data.life;
                window.spellTableApp.updateAIAnalysis();
            }
        }
    }

    onCardAdded(data) {
        if (data.location === 'board' || data.location === 'opponent_board') {
            this.renderBoardCard(data.cardId, data.imageUrl);
        }
    }

    // Listen for card rendering events
    initCardRendering() {
        window.addEventListener('render-board-card', (e) => {
            this.renderBoardCard(e.detail.cardId, e.detail.imageUrl, e.detail.playerId);
        });
    }

    onPlayerJoined(data) {
        const sessionInfo = document.querySelector('.session-info');
        if (sessionInfo) {
            sessionInfo.innerHTML = `<span class="status-badge online">🟢 Session: ${data.gameId}</span>`;
        }
    }

    onPlayerLeft(data) {
        const sessionInfo = document.querySelector('.session-info');
        if (sessionInfo) {
            sessionInfo.innerHTML = `<span class="status-badge offline">🔴 Session: ${data.gameId}</span>`;
        }
    }

    onPresenceUpdate(data) {
        console.log(`👤 Presence: Player ${data.playerId} is ${data.action}`);
    }

    onCardMove(data) {
        const cardEl = document.querySelector(`.card[data-card-id="${data.cardId}"]`);
        if (cardEl) {
            cardEl.style.transition = 'all 0.1s linear';
            cardEl.style.left = `${data.x}px`;
            cardEl.style.top = `${data.y}px`;
            cardEl.style.position = 'absolute';
        }
    }

    // --- UI Helpers ---

    renderGameState(game) {
        document.querySelectorAll('[data-game-state]').forEach(element => {
            const stateField = element.dataset.gameState;
            const value = this.getGameStateValue(game, stateField);
            if (value !== undefined) element.textContent = value;
        });
    }

    getGameStateValue(game, field) {
        const parts = field.split('.');
        let value = game;
        for (const part of parts) {
            if (value === undefined || value === null) return undefined;
            value = value[part];
        }
        return value;
    }

    highlightCurrentPlayer(playerId) {
        document.querySelectorAll('.table-area').forEach(area => {
            area.classList.remove('active-turn');
            if (area.dataset.playerId === playerId) area.classList.add('active-turn');
        });
    }

    renderBoardCard(cardId, imageUrl, playerId) {
        // Find empty slot for this player's board
        const playerSlots = document.querySelectorAll(`.table-area[data-player-id="${playerId}"] .board-slots .board-slot`);
        const emptySlot = Array.from(playerSlots).find(slot => !slot.classList.contains('filled'));

        if (emptySlot) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.draggable = true;
            cardElement.dataset.cardId = cardId;
            cardElement.dataset.playerId = playerId;

            // Load image and handle loading state
            const img = new Image();
            img.src = imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 85"%3E%3Crect fill="%23f0f0f0" width="60" height="85" rx="4" /%3E%3Ctext x="50%" y="50%" text-anchor="middle" font-size="10" fill="%23999"%3ECard%3C/text%3E%3C/svg%3E';
            img.className = 'card-img';
            img.loading = 'lazy';

            img.onload = () => {
                cardElement.classList.add('loaded');
            };

            img.onerror = () => {
                console.warn('Image failed to load, showing placeholder');
            };

            const cardName = cardId ? `Card #${cardId.slice(0, 8)}` : 'Card';

            cardElement.innerHTML = `
                <div class="card-inner">
                    ${imageUrl ? '' : `<div class="card-placeholder">🎴</div>`}
                    <img src="${imageUrl || 'assets/images/default-card.png'}" alt="card" class="card-img" onerror="this.style.display='none'">
                    <div class="card-name">${cardName}</div>
                </div>
            `;

            emptySlot.innerHTML = '';
            emptySlot.appendChild(cardElement);
            emptySlot.classList.add('filled');

            // Make it draggable
            cardElement.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', cardId);
                cardElement.style.opacity = '0.5';
                this.emitPresence('dragging', { cardId });
            });

            cardElement.addEventListener('dragend', (e) => {
                cardElement.style.opacity = '1';
                this.emitPresence('dropped', { cardId });
            });

            console.log('🎴 Card rendered:', cardId, imageUrl);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
    }

    showConnectionError() {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'connection-error';
        errorMessage.innerHTML = `
            <div class="error-icon">⚠️</div>
            <h4>Connection Error</h4>
            <p>Could not connect to game server. Will retry automatically.</p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button>
        `;
        const container = document.querySelector('.video-section');
        if (container) container.appendChild(errorMessage);
        setTimeout(() => errorMessage.remove(), 5000);
    }

    updateLife(playerId, life) {
        this.sendMessage('update_life', { playerId, life });
    }

    addCard(playerId, card, location) {
        this.sendMessage('add_card', { playerId, card, location });
    }

    nextTurn() {
        this.sendMessage('next_turn', {});
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gameSync = new GameSync();
});
