'use strict';

/**
 * Card detection routes.
 *
 * POST /api/detect       — full pipeline: phash → OCR fallback (~10ms–4s)
 * POST /api/detect/lite  — phash-only, no OCR (~10ms)
 *
 * Both accept:
 *   multipart/form-data  field: cards (1-12 image files)
 *   application/json     { cards: ["data:image/png;base64,...", ...] }
 *
 * Response: { success, count, elapsed_ms, results: [match|null] }
 */

const express = require('express');
const multer  = require('multer');
const {
    identifyCards,
    identifyCardsWithOcr,
    loadPhashDb,
} = require('../services/cardDetection');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 8 * 1024 * 1024, files: 12 },
});

// Warm phash DB at import so first request is fast
loadPhashDb();

function dataUrlToBuffer(dataUrl) {
    const m = /^data:image\/[a-zA-Z+]+;base64,(.+)$/.exec(dataUrl);
    return m ? Buffer.from(m[1], 'base64') : null;
}

function extractBuffers(req) {
    if (req.files?.length > 0) return req.files.map(f => f.buffer);
    if (Array.isArray(req.body?.cards)) return req.body.cards.map(dataUrlToBuffer).filter(Boolean);
    return [];
}

// ── POST /api/detect/lite — phash-only, no OCR ──────────────────────────────
// ~10ms. Client checks confidence; if low, escalates to POST /api/detect.
router.post('/lite', upload.array('cards', 12), async (req, res, next) => {
    try {
        const buffers = extractBuffers(req);
        if (!buffers.length) {
            return res.status(400).json({ success: false, error: 'No card images provided' });
        }
        const t0      = Date.now();
        const results = await identifyCards(buffers);
        res.json({ success: true, count: results.filter(Boolean).length, elapsed_ms: Date.now() - t0, results });
    } catch (err) { next(err); }
});

// ── POST /api/detect — full pipeline with OCR fallback ──────────────────────
router.post('/', upload.array('cards', 12), async (req, res, next) => {
    try {
        const buffers = extractBuffers(req);
        if (!buffers.length) {
            return res.status(400).json({ success: false, error: 'No card images provided' });
        }
        const t0      = Date.now();
        const results = await identifyCardsWithOcr(buffers);
        res.json({ success: true, count: results.filter(Boolean).length, elapsed_ms: Date.now() - t0, results });
    } catch (err) { next(err); }
});

module.exports = router;
