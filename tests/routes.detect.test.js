/**
 * Integration tests for /api/detect.
 * Mocks the underlying detection service so we only test the route surface.
 */

jest.mock('../api/services/cardDetection', () => ({
  loadPhashDb: jest.fn(),
  identifyCards: jest.fn(async (buffers) =>
    buffers.map((_, i) => ({
      name: `Card ${i}`,
      set: 'tst',
      scryfall_id: `id-${i}`,
      confidence: 0.9,
      method: 'phash'
    }))
  )
}));

const express = require('express');
const request = require('supertest');
const detectRoutes = require('../api/routes/detect');
const { identifyCards } = require('../api/services/cardDetection');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/detect', detectRoutes);
  return app;
}

const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
  'hex'
);

describe('POST /api/detect', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 when no cards supplied', async () => {
    const res = await request(buildApp()).post('/api/detect').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('accepts base64 data URLs', async () => {
    const dataUrl = `data:image/png;base64,${TINY_PNG.toString('base64')}`;
    const res = await request(buildApp())
      .post('/api/detect')
      .send({ cards: [dataUrl, dataUrl] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.results).toHaveLength(2);
    expect(identifyCards).toHaveBeenCalledTimes(1);
    expect(identifyCards.mock.calls[0][0]).toHaveLength(2);
  });

  test('accepts multipart uploads', async () => {
    const res = await request(buildApp())
      .post('/api/detect')
      .attach('cards', TINY_PNG, { filename: 'card.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('rejects malformed base64 entries', async () => {
    const res = await request(buildApp())
      .post('/api/detect')
      .send({ cards: ['not-a-data-url', null, ''] });

    expect(res.status).toBe(400);
  });
});
