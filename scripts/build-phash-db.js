#!/usr/bin/env node
/**
 * Builds a perceptual-hash database from Scryfall default-cards bulk data.
 * Output: api/data/phash-db.json  — { [phash]: { name, set, scryfall_id } }
 *
 * Usage:  npm run build:phash -- [options]
 *
 * Options:
 *   --limit=N           Max cards to hash (default: 2000; omit for full run)
 *   --set=<setCode>     Filter to a single set (e.g. --set=neo)
 *   --format=<fmt>      Filter by legality: standard | pioneer | modern |
 *                       legacy | vintage | pauper | commander
 *                       (cards where legalities[fmt] === 'legal')
 *
 * Presets:
 *   quick    --set=neo --limit=200         ~5 min, good for demos
 *   standard --format=standard             ~40 min, ~2k cards, real play
 *   modern   --format=modern --limit=8000  ~4-6 hrs
 *
 * Note: Full English catalog = ~30k cards = 8-16 hrs. Not recommended unless overnight.
 * Scryfall rate-limit: 75ms between requests — don't remove the delay.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { imageHash } = require('image-hash');

const OUT_DIR = path.join(__dirname, '..', 'api', 'data');
const OUT_FILE = path.join(OUT_DIR, 'phash-db.json');
const BULK_ENDPOINT = 'https://api.scryfall.com/bulk-data';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
}

const LIMIT = parseInt(arg('limit', '2000'), 10);
const SET_FILTER    = arg('set', null);
const FORMAT_FILTER = arg('format', null);

const VALID_FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'commander'];
if (FORMAT_FILTER && !VALID_FORMATS.includes(FORMAT_FILTER)) {
  console.error(`✗ Unknown format "${FORMAT_FILTER}". Valid: ${VALID_FORMATS.join(', ')}`);
  process.exit(1);
}

function hashUrl(url) {
  return new Promise((resolve, reject) => {
    imageHash(url, 16, true, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('→ Fetching Scryfall bulk metadata...');
  const bulk = await axios.get(BULK_ENDPOINT);
  const defaultCards = bulk.data.data.find(d => d.type === 'default_cards');
  if (!defaultCards) throw new Error('default_cards bulk entry not found');

  console.log(`→ Downloading ${defaultCards.download_uri}`);
  const { data: cards } = await axios.get(defaultCards.download_uri, { responseType: 'json' });
  console.log(`→ ${cards.length} cards in bulk`);

  let pool = cards.filter(c => c.lang === 'en' && c.image_uris && c.image_uris.normal);
  if (SET_FILTER)    pool = pool.filter(c => c.set === SET_FILTER);
  if (FORMAT_FILTER) pool = pool.filter(c => c.legalities?.[FORMAT_FILTER] === 'legal');
  pool = pool.slice(0, LIMIT);

  const filters = [
    SET_FILTER    ? `set=${SET_FILTER}`       : null,
    FORMAT_FILTER ? `format=${FORMAT_FILTER}` : null,
    `limit=${LIMIT}`
  ].filter(Boolean).join(', ');
  console.log(`→ Hashing ${pool.length} cards (${filters})`);

  const db = {};
  let done = 0;
  for (const card of pool) {
    try {
      const hash = await hashUrl(card.image_uris.normal);
      db[hash] = {
        name: card.name,
        set: card.set,
        scryfall_id: card.id,
        type_line: card.type_line,
        mana_cost: card.mana_cost,
        cmc: card.cmc
      };
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${pool.length}`);
    } catch (err) {
      console.warn(`  skip ${card.name}: ${err.message}`);
    }
    // Scryfall asks for 50-100ms between requests
    await new Promise(r => setTimeout(r, 75));
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(db, null, 2));
  console.log(`✓ Wrote ${Object.keys(db).length} hashes → ${OUT_FILE}`);
}

main().catch(err => {
  console.error('✗ Failed:', err);
  process.exit(1);
});
