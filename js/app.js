// SpellTable Pro+ - Main Application Logic
// Version: 2.0.0

class SpellTableApp {
    constructor() {
        this.theme = 'light';
        this.playerCount = 4;
        this.players = [];
        this.gameState = {
            turn: 1,
            currentPlayerIndex: 0,
            cardsInHand: 0,
            cardsOnBoard: 0
        };
        this.selectedSlot = null;
        this.isAIActive = false;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindWelcome();
        this.initPlayers(this.playerCount);
        this.renderDynamicUI();
        this.bindEvents();
        this.loadSettings();
        this.checkAuth();
        this.initializeIndexedDB();
        this.startGameLoop();
        this.handleGameUrlParam();
        console.log('🎮 SpellTable Pro+ initialized');
    }

    // Auto-join the game ID from ?game=... (set by invite-accept / browse).
    handleGameUrlParam() {
        const params = new URLSearchParams(window.location.search);
        const gameId = params.get('game');
        if (!gameId) return;

        const tryJoin = () => {
            if (window.gameSync && typeof window.gameSync.connect === 'function') {
                window.gameSync.connect(gameId);
                return true;
            }
            return false;
        };
        if (!tryJoin()) {
            const interval = setInterval(() => { if (tryJoin()) clearInterval(interval); }, 200);
            setTimeout(() => clearInterval(interval), 5000);
        }
    }

    // --- Player Management ---

    initPlayers(count) {
        const colors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        const labels = ['You', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];

        this.players = [];
        for (let i = 0; i < count; i++) {
            this.players.push({
                id: i + 1,
                label: labels[i],
                life: 20,
                color: colors[i],
                isLocal: i === 0
            });
        }
        this.playerCount = count;
    }

    setPlayerCount(count) {
        count = Math.max(2, Math.min(6, parseInt(count)));
        if (count === this.playerCount) return;

        this.initPlayers(count);
        this.renderDynamicUI();
        this.saveGameState();
        console.log(`👥 Player count set to ${count}`);
    }

    // --- Dynamic Rendering ---

    renderDynamicUI() {
        this.renderVideoGrid();
        this.renderLifeTotals();
        this.renderPlayTable();
    }

    renderVideoGrid() {
        const grid = document.getElementById('video-grid');
        if (!grid) return;

        grid.setAttribute('data-players', this.playerCount);
        grid.innerHTML = '';

        this.players.forEach((player, i) => {
            const isPrimary = i === 0;
            const container = document.createElement('div');
            container.className = `video-container ${isPrimary ? 'primary' : 'secondary'}`;
            container.dataset.playerId = player.id;

            container.innerHTML = `
                <div class="video-placeholder" id="video-placeholder-${player.id}">
                    <div class="video-content">
                        <span class="video-icon">${isPrimary ? '📹' : '👤'}</span>
                        <h3>${player.label}</h3>
                        <p>${isPrimary ? 'Your camera feed' : 'Remote video feed'}</p>
                    </div>
                </div>
                <div class="video-controls">
                    ${isPrimary ? `
                        <button class="btn btn-sm" data-action="snapshot" data-player="${player.id}">📷 Snapshot</button>
                        <button class="btn btn-sm" data-action="record" data-player="${player.id}">⏺️ Record</button>
                        <button class="btn btn-sm" data-action="mute" data-player="${player.id}">🎤 Mute</button>
                    ` : `
                        <button class="btn btn-sm" data-action="mute-remote" data-player="${player.id}">🎤 Mute</button>
                        <button class="btn btn-sm" data-action="settings" data-player="${player.id}">⚙️ Settings</button>
                    `}
                </div>
            `;

            grid.appendChild(container);
        });
    }

    renderLifeTotals() {
        const bar = document.getElementById('life-totals-bar');
        if (!bar) return;

        bar.innerHTML = '';

        this.players.forEach(player => {
            const widget = document.createElement('div');
            widget.className = `life-widget${player.isLocal ? ' you' : ''}`;
            widget.style.borderColor = player.color;
            widget.dataset.playerId = player.id;

            widget.innerHTML = `
                <span class="player-label" style="color: ${player.color}">${player.label}</span>
                <button class="btn btn-sm" data-action="sub-life" data-player="${player.id}">-</button>
                <input type="number" class="life-input" value="${player.life}" min="0" max="999"
                       data-player="${player.id}" id="life-input-${player.id}">
                <button class="btn btn-sm" data-action="add-life" data-player="${player.id}">+</button>
            `;

            bar.appendChild(widget);
        });
    }

    renderPlayTable() {
        const table = document.getElementById('play-table');
        if (!table) return;

        table.setAttribute('data-players', this.playerCount);
        table.innerHTML = '';

        this.players.forEach(player => {
            const area = document.createElement('div');
            area.className = `table-area${player.isLocal ? ' you' : ''}`;
            area.dataset.playerId = player.id;

            const prefix = player.isLocal ? '' : `p${player.id}-`;

            area.innerHTML = `
                <h3 style="border-bottom-color: ${player.color}">
                    <span style="color: ${player.color}">●</span> ${player.label}
                </h3>
                ${player.isLocal ? `
                    <div class="hand">
                        <div class="card-slot empty" data-slot="${prefix}hand-1"></div>
                        <div class="card-slot empty" data-slot="${prefix}hand-2"></div>
                        <div class="card-slot empty" data-slot="${prefix}hand-3"></div>
                        <div class="card-slot empty" data-slot="${prefix}hand-4"></div>
                        <div class="card-slot empty" data-slot="${prefix}hand-5"></div>
                    </div>
                ` : ''}
                <div class="board">
                    <h4>Play Area</h4>
                    <div class="board-slots">
                        <div class="board-slot empty" data-slot="${prefix}board-1"></div>
                        <div class="board-slot empty" data-slot="${prefix}board-2"></div>
                        <div class="board-slot empty" data-slot="${prefix}board-3"></div>
                        <div class="board-slot empty" data-slot="${prefix}board-4"></div>
                        <div class="board-slot empty" data-slot="${prefix}board-5"></div>
                    </div>
                </div>
                <div class="library">
                    <h4>Library</h4>
                    <div class="library-count" data-player="${player.id}">40 cards remaining</div>
                </div>
                <div class="graveyard">
                    <h4>Graveyard</h4>
                    <div class="graveyard-count" data-player="${player.id}">Empty</div>
                </div>
            `;

            table.appendChild(area);
        });
    }

    // --- API & Authentication ---

    async request(endpoint, options = {}) {
        const token = localStorage.getItem('jwt');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, { ...options, headers });

        if (response.status === 401) {
            this.handleLogout();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return response;
    }

    async handleLogin(credentials) {
        try {
            const response = await this.request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('jwt', data.token);
            localStorage.setItem('userName', data.user.displayName);
            localStorage.setItem('userId', data.user.id);
            this.checkAuth();
            this.toggleAuthModal(false);
            console.log('✅ User logged in');
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message);
        }
    }

    async handleRegister(credentials) {
        try {
            const response = await this.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Registration failed');
            }

            alert('Registration successful! You can now log in.');
        } catch (error) {
            console.error('Registration error:', error);
            alert(error.message);
        }
    }

    handleLogout() {
        localStorage.removeItem('jwt');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        this.checkAuth();
        console.log('👋 User logged out');
    }

    checkAuth() {
        const token = localStorage.getItem('jwt');
        if (this.loginLink) this.loginLink.classList.toggle('hidden', !!token);
        if (this.userProfile) this.userProfile.classList.toggle('hidden', !token);
        if (this.logoutBtn) this.logoutBtn.classList.toggle('hidden', !token);

        if (token && this.userDisplayName) {
            // We could decode the JWT here to get the name, or use a user endpoint
            // For now, we'll set a generic 'User' or store the name in localStorage
            const userName = localStorage.getItem('userName') || 'User';
            this.userDisplayName.textContent = userName;
        }
    }

    toggleAuthModal(show, mode = 'login') {
        if (!this.authSection) return;
        this.authSection.classList.toggle('active', show);
        if (show) {
            this.switchAuthForm(mode);
        }
    }

    switchAuthForm(mode) {
        if (!this.loginForm || !this.registerForm) return;

        if (mode === 'login') {
            this.loginForm.classList.remove('hidden');
            this.registerForm.classList.add('hidden');
            if (this.authTitle) this.authTitle.textContent = 'Login';
        } else {
            this.loginForm.classList.add('hidden');
            this.registerForm.classList.remove('hidden');
            if (this.authTitle) this.authTitle.textContent = 'Create Account';
        }
    }


    handleLoginFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = Object.fromEntries(formData.entries());
        this.handleLogin(credentials);
    }

    handleRegisterFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = Object.fromEntries(formData.entries());
        this.handleRegister(credentials);
    }

    // --- DOM & Events ---


    cacheDOM() {
        // Auth
        this.authSection = document.getElementById('auth-section');
        this.loginLink = document.getElementById('login-link');
        this.userProfile = document.getElementById('user-profile');
        this.logoutBtn = document.getElementById('logout-btn');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.closeAuthBtn = document.getElementById('close-auth');
        this.showRegisterLink = document.getElementById('show-register');
        this.showLoginLink = document.getElementById('show-login');
        this.userDisplayName = document.getElementById('user-display-name');

        // Lobby
        this.lobbyView = document.getElementById('lobby-view');
        this.lobbyPlayerList = document.getElementById('lobby-player-list');
        this.lobbyGameMode = document.getElementById('lobby-game-mode');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.lobbyHint = document.getElementById('lobby-hint');
        this.lobbyStatus = document.getElementById('lobby-status');



        // Theme toggle
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.querySelector('.theme-icon');


        // Navigation
        this.navLinks = document.querySelectorAll('.nav-link');

        // Buttons
        this.fullscreenBtn = document.getElementById('fullscreen');
        this.saveSettingsBtn = document.getElementById('save-settings');
        this.cancelSettingsBtn = document.getElementById('cancel-settings');

        // Turn controls
        this.turnDisplay = document.getElementById('turn-display');
        this.nextTurnBtn = document.getElementById('next-turn');

        // Player count
        this.playerCountSelect = document.getElementById('player-count');

        // AI detection
        this.startAiBtn = document.getElementById('start-ai');
        this.aiDetectionResults = document.getElementById('ai-detection-results');
        this.aiAnalysisContent = document.getElementById('ai-analysis-content');

        // Modal
        this.settingsModal = document.getElementById('settings-modal');
        this.modalClose = document.querySelector('.modal-close');

        // Welcome overlay
        this.welcomeOverlay = document.getElementById('welcome-overlay');
        this.startBtn = document.getElementById('start-btn');

        // Theme buttons
        this.themeButtons = document.querySelectorAll('.theme-btn');

        // Checkboxes
        this.autoSave = document.getElementById('auto-save');
        this.notifications = document.getElementById('enable-notifications');
        this.enableSync = document.getElementById('enable-sync');
    }

    bindEvents() {
        // Auth events
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLoginFormSubmit(e));
        }
        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => this.handleRegisterFormSubmit(e));
        }
        if (this.loginLink) {
            this.loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthModal(true, 'login');
            });
        }
        if (this.closeAuthBtn) {
            this.closeAuthBtn.addEventListener('click', () => this.toggleAuthModal(false));
        }
        if (this.showRegisterLink) {
            this.showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthForm('register');
            });
        }
        if (this.showLoginLink) {
            this.showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthForm('login');
            });
        }

        // Lobby events
        if (this.startGameBtn) {
            this.startGameBtn.addEventListener('click', () => this.startGame());
        }

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());



        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());


        // Navigation
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Fullscreen
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Turn controls
        this.nextTurnBtn.addEventListener('click', () => this.nextTurn());

        // Player count selector
        this.playerCountSelect.addEventListener('change', (e) => {
            this.setPlayerCount(e.target.value);
        });

        // AI detection is handled by card-detection-enhanced.js

        // Settings modal
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.cancelSettingsBtn.addEventListener('click', () => this.closeModal());
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeModal();
        });

        // Theme buttons
        this.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Welcome overlay
        this.startBtn.addEventListener('click', () => this.hideWelcome());

        // Card slot clicks (delegated)
        document.addEventListener('click', (e) => this.handleCardSlotClick(e));

        // Life total buttons and inputs (delegated)
        document.addEventListener('click', (e) => this.handleLifeAction(e));
        document.addEventListener('change', (e) => this.handleLifeInputChange(e));

        // Resize handler
        window.addEventListener('resize', () => this.handleResize());

        // Before unload
        window.addEventListener('beforeunload', () => this.saveGameState());
    }

    // --- Life Total Management ---

    handleLifeAction(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const playerId = parseInt(btn.dataset.player);

        if (action === 'add-life') {
            this.updatePlayerLife(playerId, 1);
        } else if (action === 'sub-life') {
            this.updatePlayerLife(playerId, -1);
        }
    }

    handleLifeInputChange(e) {
        const input = e.target.closest('.life-input[data-player]');
        if (!input) return;

        const playerId = parseInt(input.dataset.player);
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        let value = parseInt(input.value);
        value = Math.max(0, Math.min(999, isNaN(value) ? 0 : value));
        input.value = value;
        player.life = value;
        this.saveGameState();
    }

    updatePlayerLife(playerId, amount) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        player.life = Math.max(0, Math.min(999, player.life + amount));

        const input = document.getElementById(`life-input-${playerId}`);
        if (input) input.value = player.life;

        this.saveGameState();
        this.updateAIAnalysis();
    }

    // --- Theme ---

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(this.theme);
        localStorage.setItem('spelltable-theme', this.theme);
    }

    setTheme(theme) {
        this.theme = theme;
        document.body.className = `${theme}-theme`;
        this.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';

        this.themeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) btn.classList.add('active');
        });
    }

    // --- Navigation ---

    handleNavigation(e) {
        e.preventDefault();
        this.navLinks.forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');

        const sectionId = e.target.getAttribute('href').substring(1);
        const section = document.getElementById(sectionId);
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // --- Turn Management ---

    nextTurn() {
        this.gameState.turn++;
        this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.playerCount;
        this.turnDisplay.textContent = this.gameState.turn;

        // Highlight current player
        const currentPlayer = this.players[this.gameState.currentPlayerIndex];
        document.querySelectorAll('.table-area').forEach(area => {
            area.classList.remove('active-turn');
        });
        const activeArea = document.querySelector(`.table-area[data-player-id="${currentPlayer.id}"]`);
        if (activeArea) activeArea.classList.add('active-turn');

        this.saveGameState();

        // Visual feedback
        this.turnDisplay.classList.add('animate-pulse');
        setTimeout(() => this.turnDisplay.classList.remove('animate-pulse'), 500);
    }

    // --- AI ---

    updateAIAnalysis() {
        if (!this.aiAnalysisContent) return;

        const localPlayer = this.players.find(p => p.isLocal);
        const analysisContent = `
            <div class="analysis-item">
                <span class="analysis-label">Your Life:</span>
                <span class="analysis-value">${localPlayer ? localPlayer.life : 0}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Turn:</span>
                <span class="analysis-value">${this.gameState.turn}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Players:</span>
                <span class="analysis-value">${this.playerCount}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Recommended Play:</span>
                <span class="analysis-value">Play lands first</span>
            </div>
        `;

        this.aiAnalysisContent.innerHTML = analysisContent;
    }

    // --- Card Slots ---

    handleCardSlotClick(e) {
        const slot = e.target.closest('[data-slot]');
        if (!slot) return;

        if (this.selectedSlot) this.selectedSlot.classList.remove('selected');
        this.selectedSlot = slot;
        slot.classList.add('selected');
    }

    // --- Settings ---

    loadSettings() {
        const savedTheme = localStorage.getItem('spelltable-theme');
        if (savedTheme) {
            this.theme = savedTheme;
            this.setTheme(savedTheme);
        }

        const savedState = localStorage.getItem('spelltable-game-state');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            this.gameState.turn = parsed.turn || 1;
            this.gameState.currentPlayerIndex = parsed.currentPlayerIndex || 0;
            this.turnDisplay.textContent = this.gameState.turn;

            // Restore player count
            if (parsed.playerCount && parsed.playerCount !== this.playerCount) {
                this.playerCountSelect.value = parsed.playerCount;
                this.initPlayers(parsed.playerCount);
                this.renderDynamicUI();
            }

            // Restore life totals
            if (parsed.playerLives) {
                parsed.playerLives.forEach((life, i) => {
                    if (this.players[i]) {
                        this.players[i].life = life;
                        const input = document.getElementById(`life-input-${this.players[i].id}`);
                        if (input) input.value = life;
                    }
                });
            }
        }

        const autoSave = localStorage.getItem('spelltable-auto-save');
        if (autoSave !== null) this.autoSave.checked = autoSave === 'true';

        const notifications = localStorage.getItem('spelltable-notifications');
        if (notifications !== null) this.notifications.checked = notifications === 'true';

        const sync = localStorage.getItem('spelltable-sync');
        if (sync !== null) this.enableSync.checked = sync === 'true';
    }

    saveSettings() {
        localStorage.setItem('spelltable-theme', this.theme);
        localStorage.setItem('spelltable-auto-save', this.autoSave.checked);
        localStorage.setItem('spelltable-notifications', this.notifications.checked);
        localStorage.setItem('spelltable-sync', this.enableSync.checked);
        this.closeModal();
    }

    closeModal() {
        this.settingsModal.classList.remove('active');
    }

    openModal() {
        this.settingsModal.classList.add('active');
    }

    async startGame() {
        try {
            const gameId = window.gameSync.gameId;
            const gameMode = this.lobbyGameMode.value;

            const response = await this.request(`/api/games/${gameId}/start`, {
                method: 'POST',
                body: JSON.stringify({ gameMode })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to start game');
            }

            alert('🎮 Game started! Moving to the table...');
            this.updateView('table');
        } catch (error) {
            console.error('Start game error:', error);
            alert(error.message);
        }
    }

    updateView(view) {
        if (view === 'lobby') {
            this.lobbyView.classList.remove('hidden');
            document.querySelector('.player-setup').classList.add('hidden');
            document.querySelector('.video-section').classList.add('hidden');
            document.querySelector('.play-section').classList.add('hidden');
            document.querySelector('.ai-section').classList.add('hidden');
        } else if (view === 'table') {
            this.lobbyView.classList.add('hidden');
            document.querySelector('.player-setup').classList.remove('hidden');
            document.querySelector('.video-section').classList.remove('hidden');
            document.querySelector('.play-section').classList.remove('hidden');
            document.querySelector('.ai-section').classList.remove('hidden');
        }
    }

    updateLobbyPlayers(players) {
        if (!this.lobbyPlayerList) return;
        this.lobbyPlayerList.innerHTML = '';
        players.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<span>👤</span> ${player.playerName}`;
            this.lobbyPlayerList.appendChild(li);
        });
    }

    updateLobbyState(game) {
        if (game.status === 'lobby') {
            this.updateView('lobby');
            this.updateLobbyPlayers(game.players);
            this.lobbyStatus.textContent = 'Waiting for players. ..';

            // Only show start button for host
            const isHost = game.hostId.toString() === localStorage.getItem('userId');
            this.startGameBtn.classList.toggle('hidden', !isHost);
            this.lobbyHint.classList.toggle('hidden', isHost);
        } else {
            this.updateView('table');
        }
    }

    // Render player areas for organic table layout
    renderPlayerAreas(playerCount) {
        const table = document.getElementById('play-table');
        const playerIds = Array.from({ length: playerCount }, (_, i) => i + 1);

        // Keep the common board, remove old player areas
        const commonBoard = table.querySelector('.common-board');
        table.innerHTML = '';
        if (commonBoard) table.appendChild(commonBoard);

        playerIds.forEach(id => {
            const area = document.createElement('div');
            area.className = 'table-area';
            area.dataset.playerId = id;

            const player = window.spellTableApp?.players?.find(p => p.id === id);
            const isLocal = id === 1;

            area.innerHTML = `
                <h3 style="color: #ffd700;">
                    <span>●</span> ${player?.label || `Player ${id}`}
                </h3>
                ${isLocal ? `
                    <div class="hand">
                        <div class="board-slot empty" data-slot="hand-1"></div>
                        <div class="board-slot empty" data-slot="hand-2"></div>
                        <div class="board-slot empty" data-slot="hand-3"></div>
                        <div class="board-slot empty" data-slot="hand-4"></div>
                        <div class="board-slot empty" data-slot="hand-5"></div>
                    </div>
                ` : ''}
                <div class="board">
                    <h4 style="color: white; text-align: center;">Play Area</h4>
                    <div class="board-slots">
                        <div class="board-slot empty" data-slot="board-${id}-1"></div>
                        <div class="board-slot empty" data-slot="board-${id}-2"></div>
                        <div class="board-slot empty" data-slot="board-${id}-3"></div>
                        <div class="board-slot empty" data-slot="board-${id}-4"></div>
                        <div class="board-slot empty" data-slot="board-${id}-5"></div>
                    </div>
                </div>
                <div class="library">
                    <h4 style="color: white; text-align: center;">Library</h4>
                    <div class="library-count" data-player="${id}">40 cards</div>
                </div>
                <div class="graveyard">
                    <h4 style="color: white; text-align: center;">Graveyard</h4>
                    <div class="graveyard-count" data-player="${id}">Empty</div>
                </div>
            `;

            table.appendChild(area);
        });
    }


    handleKeyboardShortcuts(e) {
        if (this.settingsModal.classList.contains('active') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }

        switch (e.key) {
            case 't':
                if (e.ctrlKey) { e.preventDefault(); this.toggleTheme(); }
                break;
            case 'F11':
                e.preventDefault(); this.toggleFullscreen();
                break;
            case ' ':
                e.preventDefault(); this.nextTurn();
                break;
            case '+':
                e.preventDefault(); this.updatePlayerLife(1, 1);
                break;
            case '-':
                e.preventDefault(); this.updatePlayerLife(1, -1);
                break;
            case 's':
                if (e.ctrlKey) { e.preventDefault(); this.saveGameState(); }
                break;
            case 'o':
                if (e.ctrlKey) { e.preventDefault(); this.openModal(); }
                break;
        }
    }

    // --- Utilities ---

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {}, 250);
    }

    startGameLoop() {
        setInterval(() => this.saveGameState(), 30000);
    }

    saveGameState() {
        const state = {
            turn: this.gameState.turn,
            currentPlayerIndex: this.gameState.currentPlayerIndex,
            playerCount: this.playerCount,
            playerLives: this.players.map(p => p.life)
        };
        localStorage.setItem('spelltable-game-state', JSON.stringify(state));
    }

    initializeIndexedDB() {
        const request = indexedDB.open('SpellTablePro', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains('games')) {
                const gameStore = db.createObjectStore('games', { keyPath: 'id' });
                gameStore.createIndex('timestamp', 'timestamp', { unique: false });
                gameStore.createIndex('session', 'session', { unique: false });
            }
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                sessionStore.createIndex('gameId', 'gameId', { unique: false });
            }
            if (!db.objectStoreNames.contains('cards')) {
                db.createObjectStore('cards', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('gamestate')) {
                db.createObjectStore('gamestate', { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => {
            console.log('✅ IndexedDB initialized');
            this.db = e.target.result;
        };

        request.onerror = (e) => {
            console.error('❌ IndexedDB error:', e.target.error);
        };
    }

    hideWelcome() {
        if (this.welcomeOverlay) {
            this.welcomeOverlay.classList.add('hidden');
        }
        console.log('🎮 Welcome dismissed, starting game');
    }

    bindWelcome() {
        // Close welcome on click
        if (this.welcomeOverlay) {
            this.welcomeOverlay.addEventListener('click', () => this.hideWelcome());
            console.log('🎮 Welcome overlay click handler bound');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.spellTableApp = new SpellTableApp();
});
