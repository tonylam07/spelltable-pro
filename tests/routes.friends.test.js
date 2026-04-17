/**
 * Integration tests for /api/friends.
 */

const VALID_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';

jest.mock('../api/middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: '507f1f77bcf86cd799439099' }; next(); },
  JWT_SECRET: 'test'
}));

jest.mock('../api/models/Friendship', () => ({
  find: jest.fn(() => ({ populate: jest.fn().mockResolvedValue([]) })),
  findOne: jest.fn(),
  findById: jest.fn(),
  findBetween: jest.fn(),
  create: jest.fn(async (doc) => ({ _id: 'f1', ...doc })),
  __raw: true
}));

jest.mock('../api/models/User', () => ({
  findById: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const routes = require('../api/routes/friends');
const Friendship = require('../api/models/Friendship');
const User = require('../api/models/User');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/friends', routes);
  return app;
}

describe('POST /api/friends', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 on invalid userId', async () => {
    const res = await request(buildApp()).post('/api/friends').send({ userId: 'nope' });
    expect(res.status).toBe(400);
  });

  test('400 on self-request', async () => {
    const res = await request(buildApp()).post('/api/friends').send({ userId: '507f1f77bcf86cd799439099' });
    expect(res.status).toBe(400);
  });

  test('404 when target user missing', async () => {
    User.findById.mockResolvedValueOnce(null);
    const res = await request(buildApp()).post('/api/friends').send({ userId: VALID_ID });
    expect(res.status).toBe(404);
  });

  test('409 when friendship exists', async () => {
    User.findById.mockResolvedValueOnce({ _id: VALID_ID });
    Friendship.findBetween.mockResolvedValueOnce({ status: 'pending' });
    const res = await request(buildApp()).post('/api/friends').send({ userId: VALID_ID });
    expect(res.status).toBe(409);
  });

  test('creates friendship on success', async () => {
    User.findById.mockResolvedValueOnce({ _id: VALID_ID });
    Friendship.findBetween.mockResolvedValueOnce(null);
    const res = await request(buildApp()).post('/api/friends').send({ userId: VALID_ID });
    expect(res.status).toBe(201);
    expect(Friendship.create).toHaveBeenCalled();
  });
});

describe('PATCH /api/friends/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 when non-recipient tries to accept', async () => {
    Friendship.findById.mockResolvedValueOnce({
      _id: 'f1',
      requester: '507f1f77bcf86cd799439099',
      recipient: OTHER_ID
    });
    const res = await request(buildApp()).patch('/api/friends/f1').send({ action: 'accept' });
    expect(res.status).toBe(403);
  });

  test('accepts when recipient is current user', async () => {
    const doc = {
      _id: 'f1',
      requester: OTHER_ID,
      recipient: '507f1f77bcf86cd799439099',
      save: jest.fn().mockResolvedValue(true)
    };
    Friendship.findById.mockResolvedValueOnce(doc);
    const res = await request(buildApp()).patch('/api/friends/f1').send({ action: 'accept' });
    expect(res.status).toBe(200);
    expect(doc.status).toBe('accepted');
  });

  test('400 on invalid action', async () => {
    Friendship.findById.mockResolvedValueOnce({
      _id: 'f1',
      requester: OTHER_ID,
      recipient: '507f1f77bcf86cd799439099'
    });
    const res = await request(buildApp()).patch('/api/friends/f1').send({ action: 'whatever' });
    expect(res.status).toBe(400);
  });
});
