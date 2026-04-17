/**
 * phash-worker.js — Web Worker for client-side perceptual hash detection
 *
 * Runs OFF the main thread so card detection never blocks the UI.
 *
 * Algorithm: DCT pHash matching the image-hash npm package (size=16, long=true).
 *   1. Resize input to 64×64 greyscale (bilinear)
 *   2. Apply separable 2D DCT (precomputed cosine table → ~0.3ms)
 *   3. Extract top-left 16×16 low-frequency coefficients (256 bits)
 *   4. Threshold by mean → 64-char hex hash
 *   5. Linear scan of phash-db.json with early exit at distance 0
 *
 * Messages IN:  { type:'hash', id, imageData, width, height }
 *               { type:'status' }
 * Messages OUT: { type:'result', id, match, distance, confidence, elapsed }
 *               { type:'ready', cardCount }
 *               { type:'error', id, message }
 */

'use strict';

const HASH_SIZE   = 16;          // → 256-bit hash, 64 hex chars
const SAMPLE_SIZE = HASH_SIZE * 4; // 64 — DCT input resolution

// ── Precomputed cosine table ──────────────────────────────────────────────────
// cosTable[u * SAMPLE_SIZE + n] = cos(PI * u * (2n+1) / (2 * SAMPLE_SIZE))
// Built once at worker startup, shared by all hash computations.
let cosTable = null;

function buildCosTable() {
    cosTable = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE);
    for (let u = 0; u < SAMPLE_SIZE; u++) {
        for (let n = 0; n < SAMPLE_SIZE; n++) {
            cosTable[u * SAMPLE_SIZE + n] =
                Math.cos(Math.PI * u * (2 * n + 1) / (2 * SAMPLE_SIZE));
        }
    }
}

// ── Phash database ────────────────────────────────────────────────────────────
// Loaded once from /api/data/phash-db.json
// Stored as parallel typed arrays for maximum scan speed
let hashHex    = null;  // string[] of 64-char hex hashes
let hashNames  = null;  // string[] of card names
let hashMeta   = null;  // object[] of { set, scryfall_id, type_line, mana_cost, cmc }
let dbReady    = false;

async function loadDb() {
    const resp = await fetch('/api/data/phash-db.json');
    if (!resp.ok) throw new Error(`phash-db fetch failed: ${resp.status}`);
    const db = await resp.json();

    const entries = Object.entries(db);
    hashHex   = entries.map(([h])    => h);
    hashNames = entries.map(([, v])  => v.name);
    hashMeta  = entries.map(([, v])  => ({
        set:        v.set,
        scryfall_id: v.scryfall_id,
        type_line:  v.type_line  || '',
        mana_cost:  v.mana_cost  || '',
        cmc:        v.cmc        || 0,
    }));

    dbReady = true;
    self.postMessage({ type: 'ready', cardCount: hashHex.length });
    console.log(`[phash-worker] DB loaded: ${hashHex.length} cards`);
}

// ── Bilinear resize + greyscale ───────────────────────────────────────────────
// Input: Uint8ClampedArray RGBA (width × height)
// Output: Float32Array (SAMPLE_SIZE × SAMPLE_SIZE), column-major (x*S+y)
// Column-major matches the image-hash pixel indexing: f[x][y] where x=col, y=row
function resizeToGreyColMajor(data, srcW, srcH) {
    const S   = SAMPLE_SIZE;
    const out = new Float32Array(S * S);
    const xScale = srcW / S;
    const yScale = srcH / S;

    for (let x = 0; x < S; x++) {       // x = dest column
        for (let y = 0; y < S; y++) {   // y = dest row
            // Bilinear sample position in source
            const sx = (x + 0.5) * xScale - 0.5;
            const sy = (y + 0.5) * yScale - 0.5;

            const x0 = Math.max(0, Math.floor(sx));
            const y0 = Math.max(0, Math.floor(sy));
            const x1 = Math.min(srcW - 1, x0 + 1);
            const y1 = Math.min(srcH - 1, y0 + 1);
            const fx = sx - x0;
            const fy = sy - y0;

            // Bilinear interpolation on greyscale channel
            const grey = (col, row) => {
                const i = (row * srcW + col) * 4;
                return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            };

            const v = grey(x0, y0) * (1 - fx) * (1 - fy)
                    + grey(x1, y0) * fx        * (1 - fy)
                    + grey(x0, y1) * (1 - fx)  * fy
                    + grey(x1, y1) * fx        * fy;

            out[x * S + y] = v;  // column-major: x is outer index
        }
    }
    return out;
}

// ── 1D DCT (using precomputed cosTable) ──────────────────────────────────────
// Returns first `outLen` coefficients of the DCT-II of `signal` (length SAMPLE_SIZE)
function dct1d(signal, offset, stride, outLen) {
    const S   = SAMPLE_SIZE;
    const out = new Float32Array(outLen);
    for (let u = 0; u < outLen; u++) {
        let sum = 0;
        const row = cosTable.subarray(u * S, (u + 1) * S);
        for (let n = 0; n < S; n++) {
            sum += row[n] * signal[offset + n * stride];
        }
        out[u] = sum;
    }
    return out;
}

// ── 2D DCT (separable) ───────────────────────────────────────────────────────
// Matches image-hash algorithm: input is column-major f[x][y]
// Returns top-left HASH_SIZE×HASH_SIZE block of F[i][j], also in column-major
function dct2dTopLeft(pixels) {
    const S  = SAMPLE_SIZE;
    const H  = HASH_SIZE;

    // Step 1: Apply 1D DCT along the y dimension (for each column x)
    //         Only keep first H coefficients → intermediate: H × S (column-major)
    //         intermediate[x * H + j] = DCT_y(f[x][*])[j]
    const intermediate = new Float32Array(S * H);
    for (let x = 0; x < S; x++) {
        const dct = dct1d(pixels, x * S, 1, H); // f[x][0..S-1], stride=1
        for (let j = 0; j < H; j++) {
            intermediate[x * H + j] = dct[j];
        }
    }

    // Step 2: Apply 1D DCT along the x dimension (for each j in 0..H-1)
    //         Only keep first H coefficients → output: H × H (column-major)
    //         output[i * H + j] = DCT_x(intermediate[*][j])[i]
    const output = new Float32Array(H * H);
    const colBuf = new Float32Array(S);
    for (let j = 0; j < H; j++) {
        // Gather column j from intermediate
        for (let x = 0; x < S; x++) colBuf[x] = intermediate[x * H + j];
        const dct = dct1d(colBuf, 0, 1, H);
        for (let i = 0; i < H; i++) {
            output[i * H + j] = dct[i];
        }
    }

    return output; // F[i][j] stored as output[i*H+j], column-major in j
}

// ── Build hex hash from low-frequency DCT block ───────────────────────────────
// Matches image-hash bit ordering: iterate i=0..H-1, j=0..H-1 (column-major)
// then group 4 consecutive bits into a hex nibble
function buildHexHash(lowFreq) {
    const H = HASH_SIZE;
    // Mean of all 256 values (image-hash includes DC component)
    let sum = 0;
    for (let i = 0; i < H * H; i++) sum += lowFreq[i];
    const mean = sum / (H * H);

    let hex = '';
    // Iterate in the same order image-hash uses: outer=i (row), inner=j (col)
    for (let i = 0; i < H * H; i += 4) {
        let nibble = 0;
        for (let bit = 0; bit < 4; bit++) {
            if (lowFreq[i + bit] >= mean) nibble |= (1 << bit);
        }
        hex += nibble.toString(16);
    }
    return hex; // 64 hex chars
}

// ── Hamming distance between two hex strings ──────────────────────────────────
function hexHamming(a, b) {
    if (a.length !== b.length) return 256;
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
        d += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
    }
    return d;
}

// ── Nearest hash lookup ───────────────────────────────────────────────────────
function nearestMatch(queryHex) {
    let bestDist  = 256;
    let bestIdx   = -1;

    for (let i = 0; i < hashHex.length; i++) {
        const d = hexHamming(queryHex, hashHex[i]);
        if (d < bestDist) {
            bestDist = d;
            bestIdx  = i;
            if (d === 0) break; // perfect match, can't do better
        }
    }

    if (bestIdx === -1) return null;

    return {
        name:       hashNames[bestIdx],
        distance:   bestDist,
        ...hashMeta[bestIdx],
        confidence: bestDist === 0  ? 1.0
                  : bestDist <= 8   ? 1.0 - bestDist / 64
                  : bestDist <= 18  ? 0.5 + (18 - bestDist) / 36
                  : 0
    };
}

// ── Compute full hash from ImageData ─────────────────────────────────────────
function hashImageData(data, width, height) {
    const pixels   = resizeToGreyColMajor(data, width, height);
    const lowFreq  = dct2dTopLeft(pixels);
    return buildHexHash(lowFreq);
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = function (e) {
    const { type, id, imageData, width, height } = e.data;

    if (type === 'status') {
        self.postMessage({ type: 'status', ready: dbReady });
        return;
    }

    if (type === 'hash') {
        if (!dbReady) {
            self.postMessage({ type: 'error', id, message: 'DB not ready yet' });
            return;
        }

        const t0 = performance.now();
        try {
            const hex   = hashImageData(imageData, width, height);
            const match = nearestMatch(hex);
            self.postMessage({
                type:       'result',
                id,
                match,                 // null if DB empty
                queryHash:  hex,
                elapsed:    Math.round(performance.now() - t0),
            });
        } catch (err) {
            self.postMessage({ type: 'error', id, message: err.message });
        }
        return;
    }
};

// ── Boot ──────────────────────────────────────────────────────────────────────
buildCosTable();
loadDb().catch(err => {
    console.error('[phash-worker] Failed to load DB:', err);
    self.postMessage({ type: 'error', id: null, message: `DB load failed: ${err.message}` });
});
