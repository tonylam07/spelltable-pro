/**
 * Integration tests for /api/users.
 */

jest.mock('../api/middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
  JWT_SECRET: 'test'
}));

jest.mock('../api/models/User', () => {
  const publicProfile = (u) => ({
    id: u._id,
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl || '',
    bio: u.bio || '',
    favoriteFormats: u.favoriteFormats || [],
    stats: u.stats || { gamesPlayed: 0, gamesWon: 0 }
  });

  const wrap = (doc) => ({ ...doc, toPublicProfile: () => publicProfile(doc) });

  const limitChain = { limit: jest.fn() };
  return {
    findById: jest.fn(async (id) => {
      if (id === 'missing') return null;
      return wrap({ _id: id, displayName: 'Tony', username: 'tony' });
    }),
    findByIdAndUpdate: jest.fn(async (_id, patch) => wrap({ _id, ...patch, displayName: patch.displayName || 'Tony' })),
    find: jest.fn(() => limitChain),
    __limitChain: limitChain
  };
});

const express = require('express');
const request = require('supertest');
const userRoutes = require('../api/routes/users');
const User = require('../api/models/User');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  return app;
}

describe('GET /api/users/me', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns current user profile', async () => {
    const res = await request(buildApp()).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Tony');
  });

  test('404 when user missing', async () => {
    User.findById.mockResolvedValueOnce(null);
    const res = await request(buildApp()).get('/api/users/me');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/me', () => {
  beforeEach(() => jest.clearAllMocks());

  test('applies whitelisted fields only', async () => {
    const res = await request(buildApp())
      .patch('/api/users/me')
      .send({ displayName: 'New', password: 'hack', bio: 'hi' });
    expect(res.status).toBe(200);
    const patch = User.findByIdAndUpdate.mock.calls[0][1];
    expect(patch).toHaveProperty('displayName', 'New');
    expect(patch).toHaveProperty('bio', 'hi');
    expect(patch).not.toHaveProperty('password');
  });

  test('409 on duplicate username', async () => {
    const dup = Object.assign(new Error('dup'), { code: 11000 });
    User.findByIdAndUpdate.mockRejectedValueOnce(dup);
    const res = await request(buildApp()).patch('/api/users/me').send({ username: 'taken' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/users/search', () => {
  beforeEach(() => jest.clearAllMocks());

  test('empty result for short query', async () => {
    const res = await request(buildApp()).get('/api/users/search?q=a');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('queries db when q >= 2 chars', async () => {
    User.__limitChain.limit.mockResolvedValueOnce([
      { _id: 'u2', displayName: 'Tom', username: 'tom', toPublicProfile() { return { id: 'u2', displayName: 'Tom', username: 'tom' }; } }
    ]);
    const res = await request(buildApp()).get('/api/users/search?q=to');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(User.find).toHaveBeenCalled();
  });
});

describe('GET /api/users/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 on invalid id', async () => {
    const res = await request(buildApp()).get('/api/users/not-an-oid');
    expect(res.status).toBe(400);
  });
});
