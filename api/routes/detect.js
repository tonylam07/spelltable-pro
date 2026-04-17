/**
 * POST /api/detect   — identify one or more card crops.
 *
 * Accepts either:
 *   - multipart/form-data with field `cards` (one or many image files), or
 *   - application/json: { cards: ["data:image/png;base64,...", ...] }
 *
 * Response: { success, results: [ {name, set, scryfall_id, confidence, method} | null ] }
 */

const express = require('express');
const multer = require('multer');
const { identifyCards, loadPhashDb } = require('../services/cardDetection');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 }
});

// Warm phash DB at import
loadPhashDb();

function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/[a-zA-Z+]+;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

router.post('/', upload.array('cards', 12), async (req, res, next) => {
  try {
    let buffers = [];

    if (req.files && req.files.length > 0) {
      buffers = req.files.map(f => f.buffer);
    } else if (Array.isArray(req.body?.cards)) {
      buffers = req.body.cards.map(dataUrlToBuffer).filter(Boolean);
    }

    if (buffers.length === 0) {
      return res.status(400).json({ success: false, error: 'No card images provided' });
    }

    const started = Date.now();
    const results = await identifyCards(buffers);
    res.json({
      success: true,
      count: results.filter(Boolean).length,
      elapsed_ms: Date.now() - started,
      results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
