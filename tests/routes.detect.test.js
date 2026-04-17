/**
 * Integration tests for /api/detect and /api/detect/lite.
 * Mocks the underlying detection service so we only test the route surface.
 */

const mockIdentifyCards = jest.fn(async (buffers) =>
    buffers.map((_, i) => ({
        name: `Card ${i}`,
        set: 'tst',
        scryfall_id: `id-${i}`,
        confidence: 0.9,
        method: 'phash',
        phash_distance: 2
    }))
);

const mockIdentifyCardsWithOcr = jest.fn(async (buffers) =>
    buffers.map((_, i) => ({
        name: `Card OCR ${i}`,
        set: 'tst',
        scryfall_id: `ocr-${i}`,
        confidence: 0.75,
        method: 'ocr'
    }))
);

jest.mock('../api/services/cardDetection', () => ({
    loadPhashDb:          jest.fn(),
    identifyCards:        (...a) => mockIdentifyCards(...a),
    identifyCardsWithOcr: (...a) => mockIdentifyCardsWithOcr(...a),
}));

const express = require('express');
const request = require('supertest');
const detectRoutes = require('../api/routes/detect');

function buildApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/detect', detectRoutes);
    return app;
}

// Minimal 1×1 transparent PNG
const TINY_PNG = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
    'hex'
);
const DATA_URL = `data:image/png;base64,${TINY_PNG.toString('base64')}`;

beforeEach(() => jest.clearAllMocks());

// ── POST /api/detect/lite ─────────────────────────────────────────────────────
describe('POST /api/detect/lite', () => {
    test('400 when no cards supplied', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(mockIdentifyCards).not.toHaveBeenCalled();
    });

    test('200 with base64 data URL — calls identifyCards (phash-only)', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .send({ cards: [DATA_URL] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(1);
        expect(res.body.results).toHaveLength(1);
        expect(res.body.elapsed_ms).toBeGreaterThanOrEqual(0);
        expect(mockIdentifyCards).toHaveBeenCalledTimes(1);
        expect(mockIdentifyCardsWithOcr).not.toHaveBeenCalled();
    });

    test('200 with multiple data URLs', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .send({ cards: [DATA_URL, DATA_URL, DATA_URL] });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(3);
        expect(res.body.results).toHaveLength(3);
        expect(mockIdentifyCards.mock.calls[0][0]).toHaveLength(3);
    });

    test('200 with multipart upload', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .attach('cards', TINY_PNG, { filename: 'card.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(mockIdentifyCards).toHaveBeenCalledTimes(1);
    });

    test('400 when all card entries are malformed', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .send({ cards: ['not-a-data-url', null, ''] });

        expect(res.status).toBe(400);
    });

    test('result shape includes name, confidence, method', async () => {
        const res = await request(buildApp())
            .post('/api/detect/lite')
            .send({ cards: [DATA_URL] });

        expect(res.status).toBe(200);
        const r = res.body.results[0];
        expect(r).toMatchObject({
            name:       expect.any(String),
            confidence: expect.any(Number),
            method:     expect.any(String),
        });
    });

    test('service error → 500', async () => {
        mockIdentifyCards.mockRejectedValueOnce(new Error('DB exploded'));
        const app = buildApp();
        // Add a simple error handler so supertest gets a 500 instead of unhandled
        app.use((err, _req, res, _next) => res.status(500).json({ success: false, error: err.message }));

        const res = await request(app)
            .post('/api/detect/lite')
            .send({ cards: [DATA_URL] });

        expect(res.status).toBe(500);
    });
});

// ── POST /api/detect (full OCR pipeline) ────────────────────────────────────
describe('POST /api/detect', () => {
    test('400 when no cards supplied', async () => {
        const res = await request(buildApp()).post('/api/detect').send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('200 with base64 data URL — calls identifyCardsWithOcr', async () => {
        const res = await request(buildApp())
            .post('/api/detect')
            .send({ cards: [DATA_URL, DATA_URL] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        expect(res.body.results).toHaveLength(2);
        expect(mockIdentifyCardsWithOcr).toHaveBeenCalledTimes(1);
        expect(mockIdentifyCards).not.toHaveBeenCalled();
    });

    test('200 with multipart upload', async () => {
        const res = await request(buildApp())
            .post('/api/detect')
            .attach('cards', TINY_PNG, { filename: 'card.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(mockIdentifyCardsWithOcr).toHaveBeenCalledTimes(1);
    });

    test('400 when all card entries are malformed', async () => {
        const res = await request(buildApp())
            .post('/api/detect')
            .send({ cards: ['not-a-data-url', null, ''] });

        expect(res.status).toBe(400);
    });

    test('result shape includes name and confidence', async () => {
        const res = await request(buildApp())
            .post('/api/detect')
            .send({ cards: [DATA_URL] });

        expect(res.status).toBe(200);
        const r = res.body.results[0];
        expect(r).toMatchObject({
            name:       expect.any(String),
            confidence: expect.any(Number),
        });
    });

    test('elapsed_ms is present and numeric', async () => {
        const res = await request(buildApp())
            .post('/api/detect')
            .send({ cards: [DATA_URL] });

        expect(typeof res.body.elapsed_ms).toBe('number');
    });

    test('service error → 500', async () => {
        mockIdentifyCardsWithOcr.mockRejectedValueOnce(new Error('Tesseract crashed'));
        const app = buildApp();
        app.use((err, _req, res, _next) => res.status(500).json({ success: false, error: err.message }));

        const res = await request(app)
            .post('/api/detect')
            .send({ cards: [DATA_URL] });

        expect(res.status).toBe(500);
    });
});
