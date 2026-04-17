'use strict';

/**
 * Deck Import Routes
 *
 * POST /api/decks/import
 *   Body (JSON): { url } OR { text }
 *   - url: Moxfield or Archidekt deck URL
 *   - text: raw deck list (MTGA / MTGO / plain)
 *
 * Returns normalised deck: { name, format, commander, mainboard, sideboard, totalCards }
 */

const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const {
    parseMoxfield,
    parseArchidekt,
    parseText,
    detectSource,
    extractDeckId,
} = require('../services/deckParser');

// Shared axios instance with a browser-like UA so APIs don't block us
const http = axios.create({
    timeout: 10_000,
    headers: { 'User-Agent': 'SpellTable-Pro/1.0 (deck-import; +https://spelltable-pro.vercel.app)' },
});

// ── POST /api/decks/import ────────────────────────────────────────────────────
router.post('/import', async (req, res) => {
    const { url, text } = req.body || {};

    // ── Text import ──────────────────────────────────────────────────────────
    if (text && typeof text === 'string') {
        try {
            const deck = parseText(text.trim());
            if (!deck.mainboard.length && !deck.commander) {
                return res.status(400).json({ success: false, error: 'No cards found in deck list' });
            }
            return res.json({ success: true, data: deck });
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
    }

    // ── URL import ───────────────────────────────────────────────────────────
    if (url && typeof url === 'string') {
        const source = detectSource(url);
        if (!source) {
            return res.status(400).json({
                success: false,
                error: 'Unrecognised URL. Supported: moxfield.com, archidekt.com',
            });
        }

        const deckId = extractDeckId(url, source);
        if (!deckId) {
            return res.status(400).json({ success: false, error: 'Could not extract deck ID from URL' });
        }

        try {
            if (source === 'moxfield') {
                const apiUrl = `https://api2.moxfield.com/v2/decks/all/${deckId}`;
                const { data } = await http.get(apiUrl);
                const deck = parseMoxfield(data);
                return res.json({ success: true, data: deck });
            }

            if (source === 'archidekt') {
                const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
                const { data } = await http.get(apiUrl);
                const deck = parseArchidekt(data);
                return res.json({ success: true, data: deck });
            }
        } catch (err) {
            if (err.response?.status === 404) {
                return res.status(404).json({ success: false, error: 'Deck not found — check the URL' });
            }
            if (err.response?.status === 403 || err.response?.status === 401) {
                return res.status(422).json({ success: false, error: 'Deck is private or requires login' });
            }
            if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                return res.status(504).json({ success: false, error: 'Request to deck site timed out' });
            }
            console.error('Deck import upstream error:', err.message);
            return res.status(502).json({ success: false, error: 'Failed to fetch deck from upstream API' });
        }
    }

    return res.status(400).json({
        success: false,
        error: 'Provide either { url } or { text } in the request body',
    });
});

module.exports = router;
