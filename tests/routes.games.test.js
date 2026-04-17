/**
 * Integration tests for /api/games (read paths only).
 * Mocks the Mongoose Game model to avoid a live MongoDB in CI.
 */

jest.mock('../api/models', () => {
  const chain = {
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    select: jest.fn(() => chain),
    then: (resolve) => resolve([
      { gameId: 'game-1', status: 'waiting', players: [] },
      { gameId: 'game-2', status: 'active', players: [] }
    ])
  };
  return {
    Game: {
      find: jest.fn(() => chain),
      findOne: jest.fn()
    }
  };
});

jest.mock('../api/middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
  JWT_SECRET: 'test'
}));

const express = require('express');
const request = require('supertest');
const gameRoutes = require('../api/routes/games');
const { Game } = require('../api/models');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/games', gameRoutes);
  return app;
}

describe('GET /api/games', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists games with default limit', async () => {
    const res = await request(buildApp()).get('/api/games');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(Game.find).toHaveBeenCalledWith({});
  });

  test('applies status filter', async () => {
    await request(buildApp()).get('/api/games?status=active');
    expect(Game.find).toHaveBeenCalledWith({ status: 'active' });
  });
});
