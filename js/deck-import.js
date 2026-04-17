/**
 * Deck Import — Frontend Module
 *
 * Provides a modal UI to import a deck from:
 *   - Moxfield URL  (e.g. https://www.moxfield.com/decks/abc123)
 *   - Archidekt URL (e.g. https://archidekt.com/decks/1234567/...)
 *   - Plain text    (MTGA/MTGO/plain "N Card Name" format)
 *
 * After importing, the deck is stored in localStorage and the player's
 * library count is updated on the game board. Cards can then be "drawn"
 * from the deck pile.
 *
 * Storage key: 'spelltable-deck-p{playerId}'
 */

'use strict';

class DeckImport {
    constructor() {
        this.deck    = null; // last successfully imported deck
        this.loading = false;
        this._buildModal();
        this._bindToggle();
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    _buildModal() {
        // Toggle button in player-setup-bar
        const bar = document.querySelector('.player-setup-bar');
        if (bar) {
            const btn = document.createElement('button');
            btn.id        = 'deck-import-toggle';
            btn.className = 'btn btn-sm btn-secondary deck-import-btn';
            btn.title     = 'Import a deck from Moxfield, Archidekt, or text';
            btn.textContent = '📚 Deck';
            bar.appendChild(btn);
        }

        // Modal overlay
        const modal = document.createElement('div');
        modal.id        = 'deck-import-modal';
        modal.className = 'modal deck-import-modal';
        modal.innerHTML = `
            <div class="modal-content deck-import-content">
                <div class="modal-header">
                    <h3>📚 Import Deck</h3>
                    <button class="modal-close" id="deck-import-close">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="di-tabs">
                        <button class="di-tab active" data-tab="url">🔗 URL</button>
                        <button class="di-tab" data-tab="text">📝 Paste List</button>
                    </div>

                    <!-- URL tab -->
                    <div class="di-panel" id="di-panel-url">
                        <p class="di-hint">
                            Paste a <strong>Moxfield</strong> or <strong>Archidekt</strong> deck URL.
                        </p>
                        <input type="url" id="di-url-input" class="di-input"
                               placeholder="https://www.moxfield.com/decks/..." autocomplete="off">
                    </div>

                    <!-- Text tab -->
                    <div class="di-panel hidden" id="di-panel-text">
                        <p class="di-hint">
                            Paste a deck list in MTGA, MTGO, or plain text format.<br>
                            <code>4 Lightning Bolt</code> · <code>1 Sol Ring</code>
                        </p>
                        <textarea id="di-text-input" class="di-textarea"
                                  placeholder="4 Lightning Bolt&#10;4 Counterspell&#10;1 Black Lotus&#10;&#10;Sideboard&#10;2 Pyroblast"
                                  rows="12" spellcheck="false"></textarea>
                    </div>

                    <!-- Error / status -->
                    <div id="di-error"  class="di-error  hidden"></div>
                    <div id="di-status" class="di-status hidden"></div>

                    <!-- Preview -->
                    <div id="di-preview" class="di-preview hidden">
                        <div class="di-deck-header">
                            <div id="di-commander-art" class="di-commander-art hidden"></div>
                            <div class="di-deck-meta">
                                <h4 id="di-deck-name"></h4>
                                <div class="di-deck-tags">
                                    <span id="di-format-badge" class="di-badge"></span>
                                    <span id="di-count-badge" class="di-badge di-badge-neutral"></span>
                                </div>
                                <div id="di-commander-line" class="di-commander-line hidden">
                                    ⚔️ Commander: <strong id="di-commander-name"></strong>
                                </div>
                            </div>
                        </div>
                        <div class="di-card-list" id="di-card-list">
                            <!-- populated dynamically -->
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button id="di-import-btn" class="btn btn-primary">Import</button>
                    <button id="di-load-btn"   class="btn btn-success hidden">✅ Use This Deck</button>
                    <button id="di-cancel-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    _bindToggle() {
        // Open
        document.addEventListener('click', (e) => {
            if (e.target.closest('#deck-import-toggle')) this._openModal();
            if (e.target.closest('#deck-import-close') ||
                e.target.closest('#di-cancel-btn'))      this._closeModal();
            if (e.target.closest('#di-import-btn'))      this._doImport();
            if (e.target.closest('#di-load-btn'))        this._loadDeck();

            // Tab switching
            const tab = e.target.closest('.di-tab');
            if (tab) this._switchTab(tab.dataset.tab);

            // Click-outside to close
            if (e.target.id === 'deck-import-modal')     this._closeModal();
        });

        // Enter in URL input triggers import
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.getElementById('di-url-input') === document.activeElement) {
                this._doImport();
            }
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────

    _openModal() {
        const modal = document.getElementById('deck-import-modal');
        if (modal) { modal.classList.add('active'); document.getElementById('di-url-input')?.focus(); }
    }

    _closeModal() {
        const modal = document.getElementById('deck-import-modal');
        if (modal) modal.classList.remove('active');
    }

    _switchTab(tabId) {
        document.querySelectorAll('.di-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        document.querySelectorAll('.di-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`di-panel-${tabId}`)?.classList.remove('hidden');
    }

    // ── Import ────────────────────────────────────────────────────────────────

    async _doImport() {
        if (this.loading) return;

        const activeTab  = document.querySelector('.di-tab.active')?.dataset.tab ?? 'url';
        const urlInput   = document.getElementById('di-url-input');
        const textInput  = document.getElementById('di-text-input');

        const body = activeTab === 'url'
            ? { url:  urlInput?.value?.trim() }
            : { text: textInput?.value?.trim() };

        if (!body.url && !body.text) {
            return this._showError('Please enter a URL or paste a deck list.');
        }

        this._setLoading(true);
        this._hideError();
        this._hidePreview();

        try {
            const resp = await fetch('/api/decks/import', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });

            const json = await resp.json();

            if (!resp.ok || !json.success) {
                throw new Error(json.error || `Import failed (${resp.status})`);
            }

            this.deck = json.data;
            this._renderPreview(json.data);

        } catch (err) {
            this._showError(err.message);
        } finally {
            this._setLoading(false);
        }
    }

    // ── Preview ───────────────────────────────────────────────────────────────

    _renderPreview(deck) {
        // Show/hide sections
        const preview = document.getElementById('di-preview');
        preview?.classList.remove('hidden');

        // Deck name + format
        const nameEl = document.getElementById('di-deck-name');
        if (nameEl) nameEl.textContent = deck.name || 'Imported Deck';

        const formatEl = document.getElementById('di-format-badge');
        if (formatEl) {
            formatEl.textContent = deck.format || 'unknown';
            formatEl.className   = `di-badge di-badge-${deck.format?.toLowerCase() === 'commander' ? 'commander' : 'format'}`;
        }

        const countEl = document.getElementById('di-count-badge');
        if (countEl) countEl.textContent = `${deck.totalCards} cards`;

        // Commander
        const cmdLine = document.getElementById('di-commander-line');
        const cmdName = document.getElementById('di-commander-name');
        const cmdArt  = document.getElementById('di-commander-art');
        if (deck.commander) {
            cmdLine?.classList.remove('hidden');
            if (cmdName) cmdName.textContent = deck.commander.name;
            if (cmdArt && deck.commander.imageUrl) {
                cmdArt.classList.remove('hidden');
                cmdArt.innerHTML = `<img src="${deck.commander.imageUrl}" alt="${deck.commander.name}" class="di-cmd-img">`;
            }
        } else {
            cmdLine?.classList.add('hidden');
            cmdArt?.classList.add('hidden');
        }

        // Card list (grouped: mainboard then sideboard)
        const listEl = document.getElementById('di-card-list');
        if (listEl) {
            listEl.innerHTML = '';
            this._appendSection(listEl, 'Mainboard', deck.mainboard);
            if (deck.sideboard?.length) {
                this._appendSection(listEl, 'Sideboard', deck.sideboard);
            }
        }

        // Show load button
        document.getElementById('di-load-btn')?.classList.remove('hidden');
    }

    _appendSection(container, label, cards) {
        if (!cards?.length) return;

        const header = document.createElement('div');
        header.className = 'di-section-header';
        header.textContent = `${label} (${cards.reduce((s, c) => s + c.quantity, 0)})`;
        container.appendChild(header);

        // Sort by type → name
        const sorted = [...cards].sort((a, b) => {
            const ta = typeOrder(a.typeLine);
            const tb = typeOrder(b.typeLine);
            return ta !== tb ? ta - tb : a.name.localeCompare(b.name);
        });

        sorted.forEach(card => {
            const row = document.createElement('div');
            row.className = 'di-card-row';
            row.innerHTML = `
                <span class="di-qty">${card.quantity}×</span>
                <span class="di-cname">${escHtml(card.name)}</span>
                ${card.manaCost ? `<span class="di-mana">${escHtml(card.manaCost)}</span>` : ''}
            `;
            container.appendChild(row);
        });
    }

    // ── Load deck into game ───────────────────────────────────────────────────

    _loadDeck() {
        if (!this.deck) return;

        const playerId = window.spellTableApp?.players?.[0]?.id ?? 1;

        // Persist to localStorage
        localStorage.setItem(`spelltable-deck-p${playerId}`, JSON.stringify(this.deck));

        // Update library count on the game board
        const libEl = document.querySelector(`.library-count[data-player="${playerId}"]`);
        if (libEl) libEl.textContent = `${this.deck.totalCards} cards`;

        // Show status
        this._showStatus(`✅ "${this.deck.name}" loaded — ${this.deck.totalCards} cards`);

        // Dispatch event so other modules can react
        document.dispatchEvent(new CustomEvent('deck-loaded', {
            detail: { playerId, deck: this.deck }
        }));

        // Close after a brief pause
        setTimeout(() => this._closeModal(), 1500);
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    _setLoading(on) {
        this.loading = on;
        const btn = document.getElementById('di-import-btn');
        if (btn) {
            btn.disabled     = on;
            btn.textContent  = on ? '⏳ Importing…' : 'Import';
        }
    }

    _showError(msg) {
        const el = document.getElementById('di-error');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    }

    _hideError() {
        document.getElementById('di-error')?.classList.add('hidden');
    }

    _showStatus(msg) {
        const el = document.getElementById('di-status');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        setTimeout(() => el?.classList.add('hidden'), 4000);
    }

    _hidePreview() {
        document.getElementById('di-preview')?.classList.add('hidden');
        document.getElementById('di-load-btn')?.classList.add('hidden');
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const TYPE_ORDER = ['land', 'creature', 'planeswalker', 'instant', 'sorcery', 'artifact', 'enchantment'];
function typeOrder(typeLine = '') {
    const t = typeLine.toLowerCase();
    const idx = TYPE_ORDER.findIndex(k => t.includes(k));
    return idx === -1 ? 99 : idx;
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.deckImport = new DeckImport();
});
