/**
 * Unit tests for api/services/cardDetection.js.
 *
 * Native deps (sharp, tesseract, image-hash, axios) are mocked so the suite
 * runs fast and deterministically in CI without pulling real Scryfall data.
 */

const path = require('path');
const fs = require('fs');

// --- Mocks -----------------------------------------------------------------

jest.mock('sharp', () => {
  // sharp() returns a chainable pipeline; .toBuffer() yields a fake buffer.
  const chain = {
    resize: jest.fn(() => chain),
    extract: jest.fn(() => chain),
    grayscale: jest.fn(() => chain),
    normalize: jest.fn(() => chain),
    sharpen: jest.fn(() => chain),
    png: jest.fn(() => chain),
    metadata: jest.fn(async () => ({ width: 488, height: 680 })),
    toBuffer: jest.fn(async () => Buffer.from('fake-png'))
  };
  return jest.fn(() => chain);
});

let mockHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
jest.mock('image-hash', () => ({
  imageHash: (_input, _bits, _precise, cb) => cb(null, mockHash)
}));

let mockOcrText = 'Lightning Bolt';
jest.mock('tesseract.js', () => ({
  recognize: jest.fn(async () => ({ data: { text: mockOcrText } }))
}));

jest.mock('axios');
const axios = require('axios');

// Provide a tiny phash DB BEFORE requiring the service (which loads on init)
const DATA_DIR = path.join(__dirname, '..', 'api', 'data');
const DB_PATH = path.join(DATA_DIR, 'phash-db.json');
const GOOD_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

let dbBackup = null;
beforeAll(() => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) dbBackup = fs.readFileSync(DB_PATH, 'utf8');
  fs.writeFileSync(DB_PATH, JSON.stringify({
    [GOOD_HASH]: {
      name: 'Forest',
      set: 'dom',
      scryfall_id: 'forest-id',
      type_line: 'Basic Land — Forest',
      cmc: 0
    }
  }));
});

afterAll(() => {
  if (dbBackup) fs.writeFileSync(DB_PATH, dbBackup);
  else fs.unlinkSync(DB_PATH);
});

// Require AFTER mocks + DB file are in place
const { identifyCard } = require('../api/services/cardDetection');

// --- Tests -----------------------------------------------------------------

describe('identifyCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns phash match when hash is identical', async () => {
    mockHash = GOOD_HASH;
    const result = await identifyCard(Buffer.from('x'));
    expect(result).not.toBeNull();
    expect(result.name).toBe('Forest');
    expect(result.method).toBe('phash');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test('falls back to OCR when phash is far from DB', async () => {
    // Hash that's maximally distant from GOOD_HASH
    mockHash = '1111111111111111111111111111111111111111111111111111111111111111';
    mockOcrText = 'Lightning Bolt';
    axios.get.mockResolvedValueOnce({
      data: {
        name: 'Lightning Bolt',
        set: 'lea',
        id: 'bolt-id',
        type_line: 'Instant',
        cmc: 1
      }
    });

    const result = await identifyCard(Buffer.from('x'));
    expect(result).not.toBeNull();
    expect(result.method).toBe('ocr');
    expect(result.name).toBe('Lightning Bolt');
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/named',
      expect.objectContaining({ params: { fuzzy: 'Lightning Bolt' } })
    );
  });

  test('returns null when both phash and OCR miss', async () => {
    mockHash = '1111111111111111111111111111111111111111111111111111111111111111';
    mockOcrText = '';
    axios.get.mockRejectedValue({ response: { status: 404 } });

    const result = await identifyCard(Buffer.from('x'));
    expect(result).toBeNull();
  });

  test('strips junk characters from OCR output', async () => {
    mockHash = '1111111111111111111111111111111111111111111111111111111111111111';
    mockOcrText = 'L!ghtn1ng B0lt\n{R}';
    axios.get.mockResolvedValueOnce({
      data: { name: 'Lightning Bolt', set: 'lea', id: 'bolt-id', type_line: 'Instant', cmc: 1 }
    });

    await identifyCard(Buffer.from('x'));
    // Digits/symbols stripped; words preserved
    const call = axios.get.mock.calls[0];
    expect(call[1].params.fuzzy).toMatch(/^[A-Za-z', -]+$/);
  });
});
