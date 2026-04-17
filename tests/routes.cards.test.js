/**
 * Integration tests for /api/cards.
 * Stubs the Scryfall-backed cardDatabase model.
 */

jest.mock('../api/models', () => ({
  cardDatabase: {
    search: jest.fn(),
    getByName: jest.fn(),
    getImageUrl: jest.fn(),
    getRecent: jest.fn(),
    isValidCard: jest.fn(),
    getCacheStats: jest.fn()
  }
}));

const express = require('express');
const request = require('supertest');
const cardRoutes = require('../api/routes/cards');
const { cardDatabase } = require('../api/models');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cards', cardRoutes);
  return app;
}

describe('GET /api/cards/search', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 when query missing', async () => {
    const res = await request(buildApp()).get('/api/cards/search');
    expect(res.status).toBe(400);
  });

  test('returns search hits', async () => {
    cardDatabase.search.mockResolvedValue({
      total_cards: 1,
      data: [{ name: 'Forest', set: 'dom' }]
    });
    const res = await request(buildApp()).get('/api/cards/search?q=forest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cards[0].name).toBe('Forest');
    expect(cardDatabase.search).toHaveBeenCalledWith('forest');
  });

  test('500 on upstream failure', async () => {
    cardDatabase.search.mockRejectedValue(new Error('scryfall down'));
    const res = await request(buildApp()).get('/api/cards/search?q=forest');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/cards/:name', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns card payload', async () => {
    cardDatabase.getByName.mockResolvedValue({ name: 'Lightning Bolt' });
    const res = await request(buildApp()).get('/api/cards/Lightning Bolt');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Lightning Bolt');
  });

  test('404 when not found', async () => {
    cardDatabase.getByName.mockRejectedValue(new Error('Card "X" not found'));
    const res = await request(buildApp()).get('/api/cards/X');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/cards/image/:name', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns image url', async () => {
    cardDatabase.getImageUrl.mockResolvedValue('https://img/x.png');
    const res = await request(buildApp()).get('/api/cards/image/Forest');
    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toBe('https://img/x.png');
  });

  test('404 when image missing', async () => {
    cardDatabase.getImageUrl.mockResolvedValue(null);
    const res = await request(buildApp()).get('/api/cards/image/Nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/cards/recent', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns recent list', async () => {
    cardDatabase.getRecent.mockResolvedValue([{ name: 'A' }, { name: 'B' }]);
    const res = await request(buildApp()).get('/api/cards/recent?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(cardDatabase.getRecent).toHaveBeenCalledWith(5);
  });

  test('500 on failure', async () => {
    cardDatabase.getRecent.mockRejectedValue(new Error('boom'));
    const res = await request(buildApp()).get('/api/cards/recent');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/cards/validate/:name', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns validity flag', async () => {
    cardDatabase.isValidCard.mockResolvedValue(true);
    const res = await request(buildApp()).get('/api/cards/validate/Forest');
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });
});

describe('GET /api/cards/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns cache stats', async () => {
    cardDatabase.getCacheStats.mockReturnValue({ hits: 10, misses: 2 });
    const res = await request(buildApp()).get('/api/cards/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.hits).toBe(10);
  });
});
