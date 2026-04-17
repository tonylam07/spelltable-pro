/**
 * Hybrid card detection service.
 *
 * Strategy: phash-first, OCR fallback.
 *   1. Compute a 16-bit perceptual hash of the cropped card image.
 *   2. Find the nearest hash in our pre-built Scryfall phash DB.
 *   3. If Hamming distance is low enough → high-confidence match.
 *   4. Otherwise OCR the title bar with Tesseract and look up on Scryfall.
 *
 * The client is expected to send already-isolated card crops (perspective-
 * corrected rectangles) produced by the client-side OpenCV.js pipeline.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const { imageHash } = require('image-hash');
const Tesseract = require('tesseract.js');
const axios = require('axios');

const PHASH_DB_PATH = path.join(__dirname, '..', 'data', 'phash-db.json');
const PHASH_MAX_DISTANCE = 18;     // 256-bit hash; ~7% bit-flip tolerance
const PHASH_GREAT_MATCH  = 8;      // below this we skip OCR fallback entirely

let phashDb = null;
let phashEntries = null;  // cached [hash, entry] array for linear scan

function loadPhashDb() {
  if (phashDb) return phashDb;
  if (!fs.existsSync(PHASH_DB_PATH)) {
    console.warn('⚠ phash-db.json missing — run `npm run build:phash`. Detection will rely on OCR only.');
    phashDb = {};
  } else {
    phashDb = JSON.parse(fs.readFileSync(PHASH_DB_PATH, 'utf8'));
    console.log(`✓ Loaded phash DB with ${Object.keys(phashDb).length} entries`);
  }
  phashEntries = Object.entries(phashDb);
  return phashDb;
}

function hexHammingDistance(a, b) {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // popcount nibble
    dist += ((xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1));
  }
  return dist;
}

function hashBuffer(buf) {
  return new Promise((resolve, reject) => {
    imageHash({ data: buf, ext: 'image/png' }, 16, true, (err, data) =>
      err ? reject(err) : resolve(data)
    );
  });
}

function nearestByPhash(hash) {
  loadPhashDb();
  let best = { distance: Infinity, entry: null };
  for (const [h, entry] of phashEntries) {
    const d = hexHammingDistance(hash, h);
    if (d < best.distance) best = { distance: d, entry };
    if (d === 0) break;
  }
  return best;
}

/**
 * Crop the top ~15% of the card (title bar) for OCR.
 * Upscale + grayscale + threshold for Tesseract accuracy.
 */
async function preprocessForOcr(buf) {
  const meta = await sharp(buf).metadata();
  const titleHeight = Math.round(meta.height * 0.15);
  return sharp(buf)
    .extract({ left: 0, top: 0, width: meta.width, height: titleHeight })
    .resize({ width: 800 })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

async function ocrCardName(buf) {
  const preprocessed = await preprocessForOcr(buf);
  const opts = { logger: () => {} };
  // Serve traineddata from disk when available (baked into Docker image).
  // Avoids a ~10MB CDN download on first OCR call in production.
  if (process.env.TESSDATA_DIR) {
    opts.langPath = process.env.TESSDATA_DIR;
    opts.cachePath = process.env.TESSDATA_DIR;
  }
  const { data } = await Tesseract.recognize(preprocessed, 'eng', opts);
  const raw = (data.text || '').trim().split('\n')[0] || '';
  // Strip non-letters (mana symbols OCR as junk) and normalize whitespace
  return raw.replace(/[^A-Za-z' ,-]/g, '').replace(/\s+/g, ' ').trim();
}

const nameCache = new Map();

async function lookupByName(name) {
  if (!name || name.length < 3) return null;
  if (nameCache.has(name)) return nameCache.get(name);
  try {
    // Scryfall fuzzy match is tolerant of OCR wobble
    const { data } = await axios.get('https://api.scryfall.com/cards/named', {
      params: { fuzzy: name },
      headers: { 'User-Agent': 'SpellTablePro/1.0' }
    });
    nameCache.set(name, data);
    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      nameCache.set(name, null);
      return null;
    }
    throw err;
  }
}

/**
 * @param {Buffer} imageBuffer  PNG/JPEG of a single isolated card
 * @returns {Promise<{name, set, scryfall_id, confidence, method}|null>}
 */
async function identifyCard(imageBuffer) {
  // Normalize to PNG at card aspect ratio for hashing consistency
  const normalized = await sharp(imageBuffer)
    .resize(488, 680, { fit: 'fill' })
    .png()
    .toBuffer();

  const hash = await hashBuffer(normalized);
  const { distance, entry } = nearestByPhash(hash);

  if (entry && distance <= PHASH_GREAT_MATCH) {
    return {
      ...entry,
      confidence: 1 - distance / 64,
      method: 'phash',
      phash_distance: distance
    };
  }

  // OCR fallback
  let ocrName = null;
  try {
    ocrName = await ocrCardName(normalized);
  } catch (err) {
    console.warn('OCR failed:', err.message);
  }

  if (ocrName) {
    const card = await lookupByName(ocrName);
    if (card) {
      return {
        name: card.name,
        set: card.set,
        scryfall_id: card.id,
        type_line: card.type_line,
        mana_cost: card.mana_cost,
        cmc: card.cmc,
        confidence: 0.75,
        method: 'ocr',
        ocr_raw: ocrName
      };
    }
  }

  // Last resort: return best phash guess if within loose threshold
  if (entry && distance <= PHASH_MAX_DISTANCE) {
    return {
      ...entry,
      confidence: 0.5 + (PHASH_MAX_DISTANCE - distance) / (2 * PHASH_MAX_DISTANCE),
      method: 'phash-loose',
      phash_distance: distance,
      ocr_raw: ocrName
    };
  }

  return null;
}

async function identifyCards(buffers) {
  return Promise.all(buffers.map(b => identifyCard(b).catch(err => {
    console.error('identifyCard error:', err.message);
    return null;
  })));
}

module.exports = { identifyCard, identifyCards, loadPhashDb };
