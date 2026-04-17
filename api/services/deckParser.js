'use strict';

/**
 * Deck Parser Service
 *
 * Normalises deck data from three sources into one consistent shape:
 *   { name, format, commander, mainboard, sideboard, totalCards }
 *
 * Each card in mainboard/sideboard:
 *   { quantity, name, scryfallId, imageUrl, typeLine, manaCost, cmc }
 *
 * Supported sources:
 *   parseMoxfield(apiData)   — from api2.moxfield.com/v2/decks/all/:id
 *   parseArchidekt(apiData)  — from archidekt.com/api/decks/:id/
 *   parseText(text)          — MTGA / MTGO / plain-text lists
 */

// ── Archidekt format-code map ─────────────────────────────────────────────────
const ARCHIDEKT_FORMATS = {
    1: 'casual',
    3: 'modern',
    4: 'standard',
    5: 'commander',
    6: 'legacy',
    7: 'vintage',
    8: 'pauper',
    9: 'pioneer',
    11: 'brawl',
};

// ── Normalised card shape ─────────────────────────────────────────────────────
function makeCard(qty, name, scryfallId = null, imageUrl = null, typeLine = '', manaCost = '', cmc = 0) {
    return {
        quantity:   Math.max(1, parseInt(qty) || 1),
        name:       name.trim(),
        scryfallId: scryfallId || null,
        imageUrl:   imageUrl   || null,
        typeLine:   typeLine   || '',
        manaCost:   manaCost   || '',
        cmc:        cmc        || 0,
    };
}

// ── Image URL helper (Scryfall CDN) ──────────────────────────────────────────
function scryfallImageUrl(scryfallId, size = 'normal') {
    if (!scryfallId) return null;
    return `https://cards.scryfall.io/${size}/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

// ── Moxfield ─────────────────────────────────────────────────────────────────
function parseMoxfield(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid Moxfield response');

    const name   = data.name   || 'Imported Deck';
    const format = (data.format || 'casual').toLowerCase();

    function extractBoard(board) {
        if (!board?.cards) return [];
        return Object.values(board.cards).map(entry => {
            const card = entry.card || {};
            const sid  = card.scryfall_id || card.id || null;
            return makeCard(
                entry.quantity,
                card.name || entry.name || 'Unknown',
                sid,
                sid ? scryfallImageUrl(sid) : null,
                card.type_line  || '',
                card.mana_cost  || '',
                card.cmc        || 0,
            );
        });
    }

    const commanders = extractBoard(data.boards?.commanders);
    const mainboard  = extractBoard(data.boards?.mainboard);
    const sideboard  = extractBoard(data.boards?.sideboard);
    // Companions, attractions, etc. go into mainboard for simplicity
    const extras     = extractBoard(data.boards?.companions)
        .concat(extractBoard(data.boards?.attractions));

    const allMain = [...mainboard, ...extras];
    const commander = commanders[0] || null;

    return normalise({ name, format, commander, mainboard: allMain, sideboard });
}

// ── Archidekt ─────────────────────────────────────────────────────────────────
function parseArchidekt(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid Archidekt response');

    const name   = data.name || 'Imported Deck';
    const format = ARCHIDEKT_FORMATS[data.format] || 'casual';

    const mainboard  = [];
    const sideboard  = [];
    let   commander  = null;

    const cards = Array.isArray(data.cards) ? data.cards : [];

    for (const entry of cards) {
        const card    = entry.card || {};
        const oracle  = card.oracleCard || {};
        const sid     = card.uid || null;
        const cats    = Array.isArray(entry.categories) ? entry.categories.map(c => c.toLowerCase()) : [];

        const parsed = makeCard(
            entry.quantity,
            oracle.name || card.name || 'Unknown',
            sid,
            sid ? scryfallImageUrl(sid) : null,
            oracle.typeLine || '',
            oracle.manaCost || '',
            oracle.cmc      || 0,
        );

        if (cats.includes('commander')) {
            commander = parsed;
        } else if (cats.includes('sideboard')) {
            sideboard.push(parsed);
        } else {
            mainboard.push(parsed);
        }
    }

    return normalise({ name, format, commander, mainboard, sideboard });
}

// ── Plain-text parser ─────────────────────────────────────────────────────────
// Supports: MTGA, MTGO, plain 'N CardName', section headers
function parseText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty deck list');

    const lines = text.split(/\r?\n/);

    const mainboard = [];
    const sideboard = [];
    const commanders = [];
    let currentSection = 'mainboard';

    // Section header patterns
    const SECTION_RE = /^(deck|main|mainboard|sideboard|side|commander|companion)\s*:?\s*$/i;
    // Card line: optional quantity, then card name, optional (SET) COLLECTOR# suffix
    const CARD_RE    = /^(\d+)x?\s+(.+?)(?:\s+\([A-Z0-9]+\)\s+\d+)?\s*$/i;
    // Comment/empty
    const SKIP_RE    = /^\s*(?:\/\/.*)?$/;

    for (const raw of lines) {
        const line = raw.trim();

        if (SKIP_RE.test(line)) continue;

        const sectionMatch = SECTION_RE.exec(line);
        if (sectionMatch) {
            const s = sectionMatch[1].toLowerCase();
            if (s === 'sideboard' || s === 'side') currentSection = 'sideboard';
            else if (s === 'commander')             currentSection = 'commander';
            else                                    currentSection = 'mainboard';
            continue;
        }

        const cardMatch = CARD_RE.exec(line);
        if (cardMatch) {
            const qty  = parseInt(cardMatch[1], 10);
            const name = cardMatch[2].trim();
            const card = makeCard(qty, name);

            if (currentSection === 'sideboard')   sideboard.push(card);
            else if (currentSection === 'commander') commanders.push(card);
            else                                   mainboard.push(card);
        }
        // Silently skip lines that don't match (handles blank set headers etc.)
    }

    const commander = commanders[0] || null;

    return normalise({ name: 'Imported Deck', format: 'unknown', commander, mainboard, sideboard });
}

// ── Normalise + stats ─────────────────────────────────────────────────────────
function normalise({ name, format, commander, mainboard, sideboard }) {
    const totalCards = mainboard.reduce((s, c) => s + c.quantity, 0)
                     + (commander ? 1 : 0);

    // Deduplicate by name (sums quantities)
    function dedup(cards) {
        const map = new Map();
        for (const c of cards) {
            const key = c.name.toLowerCase();
            if (map.has(key)) {
                map.get(key).quantity += c.quantity;
            } else {
                map.set(key, { ...c });
            }
        }
        return [...map.values()];
    }

    return {
        name,
        format,
        commander,
        mainboard:  dedup(mainboard),
        sideboard:  dedup(sideboard),
        totalCards,
    };
}

// ── URL detection ─────────────────────────────────────────────────────────────
function detectSource(url) {
    if (/moxfield\.com/i.test(url))   return 'moxfield';
    if (/archidekt\.com/i.test(url))  return 'archidekt';
    return null;
}

function extractDeckId(url, source) {
    if (source === 'moxfield') {
        // https://www.moxfield.com/decks/ABC123xyz
        const m = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/);
        return m ? m[1] : null;
    }
    if (source === 'archidekt') {
        // https://archidekt.com/decks/1234567/deck-name
        const m = url.match(/archidekt\.com\/decks\/(\d+)/);
        return m ? m[1] : null;
    }
    return null;
}

module.exports = {
    parseMoxfield,
    parseArchidekt,
    parseText,
    detectSource,
    extractDeckId,
    scryfallImageUrl,
};
