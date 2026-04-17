'use strict';

// Mock axios BEFORE imports so the route never makes real HTTP calls
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
    create: () => ({ get: (...a) => mockAxiosGet(...a) }),
}));

const express    = require('express');
const supertest  = require('supertest');
const deckRoutes = require('../api/routes/decks');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/decks', deckRoutes);
    return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOXFIELD_RESP = {
    name:   'Test Deck',
    format: 'commander',
    boards: {
        commanders: {
            cards: {
                Atraxa: {
                    quantity: 1,
                    card: { name: 'Atraxa', scryfall_id: 'abc-123', type_line: 'Legendary Creature', mana_cost: '{W}{U}{B}{G}', cmc: 4 }
                }
            }
        },
        mainboard: {
            cards: {
                'Sol Ring': {
                    quantity: 1,
                    card: { name: 'Sol Ring', scryfall_id: 'def-456', type_line: 'Artifact', mana_cost: '{1}', cmc: 1 }
                }
            }
        },
        sideboard: { cards: {} }
    }
};

const ARCHIDEKT_RESP = {
    name:   'Pioneer Deck',
    format: 3, // modern
    cards: [
        {
            quantity: 4,
            categories: ['Mainboard'],
            card: { uid: 'uid-111', oracleCard: { name: 'Fatal Push', typeLine: 'Instant', manaCost: '{B}', cmc: 1 } }
        }
    ]
};

beforeEach(() => {
    jest.clearAllMocks();
});

// ── Text import ───────────────────────────────────────────────────────────────
describe('POST /api/decks/import — text', () => {
    test('200 with valid plain-text deck', async () => {
        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ text: '4 Lightning Bolt\n1 Sol Ring' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.mainboard).toHaveLength(2);
    });

    test('400 when text produces no cards', async () => {
        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ text: '// only a comment' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

// ── URL import — Moxfield ─────────────────────────────────────────────────────
describe('POST /api/decks/import — moxfield URL', () => {
    test('200 with valid moxfield URL', async () => {
        mockAxiosGet.mockResolvedValue({ data: MOXFIELD_RESP });

        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://www.moxfield.com/decks/TestId123' });

        expect(res.status).toBe(200);
        expect(res.body.data.commander.name).toBe('Atraxa');
        expect(mockAxiosGet).toHaveBeenCalledWith(
            expect.stringContaining('TestId123')
        );
    });

    test('404 when upstream returns 404', async () => {
        mockAxiosGet.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }));

        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://www.moxfield.com/decks/missing' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    test('422 when deck is private', async () => {
        mockAxiosGet.mockRejectedValue(Object.assign(new Error('Forbidden'), { response: { status: 403 } }));

        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://www.moxfield.com/decks/private' });

        expect(res.status).toBe(422);
    });

    test('504 on upstream timeout', async () => {
        mockAxiosGet.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));

        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://www.moxfield.com/decks/slow' });

        expect(res.status).toBe(504);
    });
});

// ── URL import — Archidekt ────────────────────────────────────────────────────
describe('POST /api/decks/import — archidekt URL', () => {
    test('200 with valid archidekt URL', async () => {
        mockAxiosGet.mockResolvedValue({ data: ARCHIDEKT_RESP });

        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://archidekt.com/decks/9876543/my-deck' });

        expect(res.status).toBe(200);
        expect(res.body.data.mainboard[0].name).toBe('Fatal Push');
        expect(mockAxiosGet).toHaveBeenCalledWith(
            expect.stringContaining('9876543')
        );
    });
});

// ── Validation ────────────────────────────────────────────────────────────────
describe('POST /api/decks/import — validation', () => {
    test('400 with empty body', async () => {
        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('400 with unrecognised URL domain', async () => {
        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://deckstats.net/decks/123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/unrecognised/i);
    });

    test('400 with moxfield URL missing deck id', async () => {
        const res = await supertest(buildApp())
            .post('/api/decks/import')
            .send({ url: 'https://www.moxfield.com/' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/deck id/i);
    });
});
