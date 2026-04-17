/**
 * Integration tests for /api/games invite + public-browse endpoints.
 */

const HOST_ID   = '507f1f77bcf86cd799439099';
const OTHER_ID  = '507f1f77bcf86cd799439088';
const TARGET_ID = '507f1f77bcf86cd799439011';

jest.mock('../api/middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: HOST_ID }; next(); },
  JWT_SECRET: 'test'
}));

jest.mock('../api/middleware/validation', () => ({
  validateGameId: (_req, _res, next) => next(),
  validatePlayerId: (_req, _res, next) => next()
}));

const mockFindOne = jest.fn();

const mockBrowseChain = {
  sort:     jest.fn(() => mockBrowseChain),
  limit:    jest.fn(() => mockBrowseChain),
  populate: jest.fn(() => mockBrowseChain),
  select:   jest.fn(),
  then:     undefined
};

jest.mock('../api/models', () => ({
  Game: {
    findOne:   (...a) => mockFindOne(...a),
    find:      jest.fn(() => mockBrowseChain),
    deleteOne: jest.fn()
  }
}));

const express = require('express');
const request = require('supertest');
const gameRoutes = require('../api/routes/games');
const { Game } = require('../api/models');

const HOST_ID_VAR = HOST_ID;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/games', gameRoutes);
  return app;
}

describe('POST /api/games/:gameId/invites', () => {
  beforeEach(() => { jest.clearAllMocks(); mockFindOne.mockReset(); });

  test('400 on invalid userId', async () => {
    const res = await request(buildApp()).post('/api/games/g1/invites').send({ userId: 'nope' });
    expect(res.status).toBe(400);
  });

  test('404 when game missing', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const res = await request(buildApp()).post('/api/games/g1/invites').send({ userId: TARGET_ID });
    expect(res.status).toBe(404);
  });

  test('403 when caller is not host', async () => {
    mockFindOne.mockResolvedValueOnce({
      hostId: { toString: () => OTHER_ID },
      invites: []
    });
    const res = await request(buildApp()).post('/api/games/g1/invites').send({ userId: TARGET_ID });
    expect(res.status).toBe(403);
  });

  test('409 when already invited', async () => {
    mockFindOne.mockResolvedValueOnce({
      hostId: { toString: () => HOST_ID_VAR },
      invites: [{ userId: { toString: () => TARGET_ID }, status: 'pending' }]
    });
    const res = await request(buildApp()).post('/api/games/g1/invites').send({ userId: TARGET_ID });
    expect(res.status).toBe(409);
  });

  test('201 creates invite and saves', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const game = {
      gameId: 'g1',
      name: 'Test',
      format: 'commander',
      hostId: { toString: () => HOST_ID_VAR },
      invites: [],
      save
    };
    mockFindOne.mockResolvedValueOnce(game);

    const res = await request(buildApp()).post('/api/games/g1/invites').send({ userId: TARGET_ID });
    expect(res.status).toBe(201);
    expect(save).toHaveBeenCalled();
    expect(game.invites).toHaveLength(1);
    expect(game.invites[0].status).toBe('pending');
  });
});

describe('PATCH /api/games/:gameId/invites/me', () => {
  beforeEach(() => { jest.clearAllMocks(); mockFindOne.mockReset(); });

  test('404 when no pending invite', async () => {
    mockFindOne.mockResolvedValueOnce({ invites: [] });
    const res = await request(buildApp()).patch('/api/games/g1/invites/me').send({ action: 'accept' });
    expect(res.status).toBe(404);
  });

  test('accepts pending invite', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const invite = { userId: { toString: () => HOST_ID_VAR }, status: 'pending' };
    mockFindOne.mockResolvedValueOnce({ gameId: 'g1', invites: [invite], save });

    const res = await request(buildApp()).patch('/api/games/g1/invites/me').send({ action: 'accept' });
    expect(res.status).toBe(200);
    expect(invite.status).toBe('accepted');
    expect(save).toHaveBeenCalled();
  });

  test('400 on invalid action', async () => {
    const invite = { userId: { toString: () => HOST_ID_VAR }, status: 'pending' };
    mockFindOne.mockResolvedValueOnce({ gameId: 'g1', invites: [invite], save: jest.fn() });
    const res = await request(buildApp()).patch('/api/games/g1/invites/me').send({ action: 'meh' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/games/browse/public', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('filters to games with open seats', async () => {
    mockBrowseChain.select.mockResolvedValueOnce([
      { gameId: 'g1', name: 'Open',  format: 'commander', gameMode: 'casual', maxPlayers: 4, players: [{}, {}], hostId: { displayName: 'Tony' }, createdAt: new Date() },
      { gameId: 'g2', name: 'Full',  format: 'commander', gameMode: 'casual', maxPlayers: 2, players: [{}, {}], hostId: { displayName: 'Sara' }, createdAt: new Date() }
    ]);
    const res = await request(buildApp()).get('/api/games/browse/public');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].gameId).toBe('g1');
  });

  test('applies format filter in query', async () => {
    mockBrowseChain.select.mockResolvedValueOnce([]);
    await request(buildApp()).get('/api/games/browse/public?format=modern');
    expect(Game.find).toHaveBeenCalledWith(expect.objectContaining({ format: 'modern', isPublic: true, status: 'lobby' }));
  });
});
