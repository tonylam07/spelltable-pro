#!/usr/bin/env node
/**
 * Builds a perceptual-hash database from Scryfall default-cards bulk data.
 * Output: api/data/phash-db.json  — { [phash]: { name, set, scryfall_id } }
 *
 * Usage:  npm run build:phash -- [--limit=1000] [--set=neo]
 *
 * Note: Full Scryfall English catalog is ~30k cards. Default limit=2000
 * keeps this fast for dev; remove --limit for a full build.
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
const SET_FILTER = arg('set', null);

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
  if (SET_FILTER) pool = pool.filter(c => c.set === SET_FILTER);
  pool = pool.slice(0, LIMIT);
  console.log(`→ Hashing ${pool.length} cards (limit=${LIMIT}${SET_FILTER ? `, set=${SET_FILTER}` : ''})`);

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
