/**
 * Commander Damage Tracker
 *
 * Maintains a damage matrix: damages[toPlayerId][fromPlayerId] = totalDamage
 * A player loses when any single commander deals 21+ damage to them.
 *
 * Integrates with window.gameSync (Socket.io) and window.spellTableApp (player list).
 */

class CommanderDamage {
    constructor() {
        // damages[toPlayerId][fromPlayerId] = number
        this.damages = {};
        this.visible = false;
        this.panel = null;
        this.init();
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    init() {
        this._buildPanel();
        this._bindSocketEvents();
        this._bindToggle();

        // Re-render whenever the player count changes
        document.addEventListener('players-changed', () => this.refresh());
    }

    // Called by app.js after player count changes so we reset the matrix.
    refresh() {
        this.damages = {};
        this._renderMatrix();
    }

    // ── Socket integration ────────────────────────────────────────────────────

    _bindSocketEvents() {
        // Poll until gameSync is available (it's created on DOMContentLoaded)
        const attach = () => {
            const sync = window.gameSync;
            if (!sync || !sync.socket) {
                setTimeout(attach, 300);
                return;
            }
            sync.socket.on('commander_damage_update', (data) => {
                this._applyLocal(data.toPlayerId, data.fromPlayerId, data.delta);
                // Only re-render if this came from another client (avoid double-render
                // for our own emits — we already applied optimistically in emitDamage).
            });
        };
        attach();
    }

    // Emit a delta and immediately apply it locally (optimistic update).
    emitDamage(toPlayerId, fromPlayerId, delta) {
        this._applyLocal(toPlayerId, fromPlayerId, delta);

        const sync = window.gameSync;
        if (sync && sync.socket && sync.isConnected) {
            sync.socket.emit('commander_damage', { toPlayerId, fromPlayerId, delta });
        }
    }

    // ── State helpers ─────────────────────────────────────────────────────────

    _applyLocal(toId, fromId, delta) {
        const to = String(toId);
        const from = String(fromId);
        if (!this.damages[to]) this.damages[to] = {};
        const prev = this.damages[to][from] || 0;
        this.damages[to][from] = Math.max(0, prev + delta);
        this._renderMatrix();
    }

    getDamage(toId, fromId) {
        return (this.damages[String(toId)] || {})[String(fromId)] || 0;
    }

    // True if this player has taken 21+ from any single commander.
    isDeadByCommander(toId) {
        const row = this.damages[String(toId)] || {};
        return Object.values(row).some(v => v >= 21);
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    _buildPanel() {
        // Toggle button — injected into player-setup-bar
        const setupBar = document.querySelector('.player-setup-bar');
        if (setupBar) {
            const btn = document.createElement('button');
            btn.id = 'cmd-dmg-toggle';
            btn.className = 'btn btn-sm btn-secondary cmd-dmg-btn';
            btn.title = 'Toggle commander damage tracker';
            btn.innerHTML = '⚔️ Cmd Dmg';
            setupBar.appendChild(btn);
        }

        // Panel — inserted after life-totals-bar
        const bar = document.getElementById('life-totals-bar');
        if (!bar) return;

        this.panel = document.createElement('div');
        this.panel.id = 'commander-damage-panel';
        this.panel.className = 'commander-damage-panel hidden';
        this.panel.innerHTML = `
            <div class="cmd-dmg-header">
                <span>⚔️ Commander Damage</span>
                <span class="cmd-dmg-rule">21+ damage from a single commander = eliminated</span>
            </div>
            <div id="cmd-dmg-matrix" class="cmd-dmg-matrix"></div>
        `;
        bar.insertAdjacentElement('afterend', this.panel);
    }

    _bindToggle() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#cmd-dmg-toggle')) {
                this.visible = !this.visible;
                if (this.panel) this.panel.classList.toggle('hidden', !this.visible);
                const btn = document.getElementById('cmd-dmg-toggle');
                if (btn) btn.classList.toggle('active', this.visible);
                if (this.visible) this._renderMatrix();
            }
        });
    }

    _renderMatrix() {
        const matrix = document.getElementById('cmd-dmg-matrix');
        if (!matrix || !this.visible) return;

        const app = window.spellTableApp;
        const players = app ? app.players : this._fallbackPlayers();
        if (!players || players.length < 2) return;

        matrix.innerHTML = '';

        players.forEach(receiver => {
            const row = document.createElement('div');
            row.className = 'cmd-dmg-row';
            row.dataset.playerId = receiver.id;

            // Dead-by-commander indicator
            const dead = this.isDeadByCommander(receiver.id);

            row.innerHTML = `
                <div class="cmd-dmg-player-label ${dead ? 'eliminated' : ''}"
                     style="color: ${receiver.color || '#999'}">
                    ${dead ? '💀 ' : ''}${receiver.label}
                </div>
                <div class="cmd-dmg-cells" data-to="${receiver.id}"></div>
            `;

            const cells = row.querySelector('.cmd-dmg-cells');

            players.forEach(attacker => {
                if (attacker.id === receiver.id) return; // skip self

                const dmg = this.getDamage(receiver.id, attacker.id);
                const danger = dmg >= 21 ? 'lethal' : dmg >= 16 ? 'danger' : dmg >= 10 ? 'warning' : '';

                const cell = document.createElement('div');
                cell.className = `cmd-dmg-cell ${danger}`;
                cell.title = `Damage from ${attacker.label} → ${receiver.label}`;
                cell.innerHTML = `
                    <div class="cmd-dmg-attacker" style="color: ${attacker.color || '#999'}"
                         title="From ${attacker.label}">
                        ${attacker.label.replace('Player ', 'P')}
                    </div>
                    <div class="cmd-dmg-controls">
                        <button class="cmd-btn cmd-minus"
                                data-to="${receiver.id}" data-from="${attacker.id}">−</button>
                        <span class="cmd-dmg-value">${dmg}</span>
                        <button class="cmd-btn cmd-plus"
                                data-to="${receiver.id}" data-from="${attacker.id}">+</button>
                    </div>
                `;
                cells.appendChild(cell);
            });

            matrix.appendChild(row);
        });

        // Bind +/- buttons (event delegation on matrix)
        matrix.addEventListener('click', (e) => {
            const btn = e.target.closest('.cmd-btn');
            if (!btn) return;
            const to = btn.dataset.to;
            const from = btn.dataset.from;
            const delta = btn.classList.contains('cmd-plus') ? 1 : -1;
            this.emitDamage(to, from, delta);
        }, { once: true }); // replaced on each render, so use once
    }

    // Fallback if app not ready yet
    _fallbackPlayers() {
        const widgets = document.querySelectorAll('[data-player-id]');
        const ids = [...new Set([...widgets].map(w => w.dataset.playerId))];
        return ids.map((id, i) => ({
            id,
            label: `Player ${id}`,
            color: ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][i] || '#999'
        }));
    }

    // Load persisted state from a game object (called when joining a game).
    loadFromGame(game) {
        if (!game || !Array.isArray(game.players)) return;
        this.damages = {};
        game.players.forEach(player => {
            if (!player.commanderDamage) return;
            const entries = Object.entries(player.commanderDamage);
            if (!entries.length) return;
            this.damages[player.playerId] = {};
            entries.forEach(([fromId, dmg]) => {
                this.damages[player.playerId][fromId] = dmg;
            });
        });
        if (this.visible) this._renderMatrix();
    }
}

// Boot after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.commanderDamage = new CommanderDamage();
});
