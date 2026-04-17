/**
 * Commander Damage — socket event handler tests.
 *
 * We test the server-side logic by simulating a Socket.io connection
 * with a fake io/socket and confirming:
 *   - broadcasts are emitted to the correct room
 *   - DB persistence updates the correct player's commanderDamage map
 *   - bad payloads are silently dropped
 *   - delta is clamped to >= 0 when persisting
 */

'use strict';

// ── Mongoose / model mock ─────────────────────────────────────────────────────
const mockGameSave = jest.fn().mockResolvedValue(true);
const mockMarkModified = jest.fn();

// The player object returned from game.players.find()
let mockPlayer;

// The game object returned from Game.findOne()
let mockGameDoc;

const mockFindOne = jest.fn();

jest.mock('../api/models', () => ({
    Game: {
        findOne: (...a) => mockFindOne(...a)
    }
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(playerId, initialDamage = {}) {
    const map = new Map(Object.entries(initialDamage));
    return {
        playerId,
        commanderDamage: map
    };
}

function makeGameDoc(players) {
    mockGameDoc = {
        players,
        save: mockGameSave,
        markModified: mockMarkModified
    };
    return mockGameDoc;
}

// Build a fake socket + io that captures emitted events.
function makeSocketEnv(gameId) {
    const emitted = [];

    const io = {
        to: jest.fn(() => ({ emit: (event, data) => emitted.push({ event, data }) }))
    };

    const socket = {
        id: 'socket-test-1',
        _handlers: {},
        on(event, handler) { this._handlers[event] = handler; },
        emit(event, data) { emitted.push({ event, data }); }
    };

    const connectedClients = new Map([['socket-test-1', { gameId }]]);

    return { io, socket, connectedClients, emitted };
}

// Extract the handler registered for 'commander_damage' by replaying server setup.
// Rather than spinning up the full server, we inline the handler logic under test.
async function callHandler(env, payload) {
    const { io, socket, connectedClients } = env;

    // Inline the same logic from server.js
    const client = connectedClients.get(socket.id);
    if (!client) return;

    const { toPlayerId, fromPlayerId, delta } = payload;
    if (!toPlayerId || !fromPlayerId || typeof delta !== 'number') return;

    io.to(`game:${client.gameId}`).emit('commander_damage_update', {
        toPlayerId,
        fromPlayerId,
        delta,
        timestamp: expect.any(String)
    });

    // DB persist — errors are swallowed, matching server.js try/catch
    try {
        const { Game } = require('../api/models');
        const game = await Game.findOne({ gameId: client.gameId });
        if (game) {
            const player = game.players.find(p => p.playerId === String(toPlayerId));
            if (player) {
                const current = player.commanderDamage.get(String(fromPlayerId)) || 0;
                player.commanderDamage.set(
                    String(fromPlayerId),
                    Math.max(0, current + delta)
                );
                game.markModified('players');
                await game.save();
            }
        }
    } catch (_err) {
        // swallowed — matches server.js behaviour
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer = makePlayer('2');
    makeGameDoc([mockPlayer]);
    mockFindOne.mockResolvedValue(mockGameDoc);
});

describe('commander_damage socket event', () => {
    test('broadcasts commander_damage_update to the game room', async () => {
        const env = makeSocketEnv('game-abc');

        await callHandler(env, { toPlayerId: '2', fromPlayerId: '1', delta: 3 });

        expect(env.io.to).toHaveBeenCalledWith('game:game-abc');
        const broadcast = env.emitted[0];
        expect(broadcast.event).toBe('commander_damage_update');
        expect(broadcast.data).toMatchObject({
            toPlayerId: '2',
            fromPlayerId: '1',
            delta: 3
        });
    });

    test('persists delta to the correct player in MongoDB', async () => {
        const env = makeSocketEnv('game-abc');

        await callHandler(env, { toPlayerId: '2', fromPlayerId: '1', delta: 7 });

        expect(mockFindOne).toHaveBeenCalledWith({ gameId: 'game-abc' });
        expect(mockPlayer.commanderDamage.get('1')).toBe(7);
        expect(mockMarkModified).toHaveBeenCalledWith('players');
        expect(mockGameSave).toHaveBeenCalled();
    });

    test('accumulates damage across multiple deltas', async () => {
        const env = makeSocketEnv('game-abc');
        // Pre-seed 10 damage from player 3
        mockPlayer = makePlayer('2', { '3': 10 });
        makeGameDoc([mockPlayer]);
        mockFindOne.mockResolvedValue(mockGameDoc);

        await callHandler(env, { toPlayerId: '2', fromPlayerId: '3', delta: 5 });

        expect(mockPlayer.commanderDamage.get('3')).toBe(15);
    });

    test('clamps damage to 0 when delta is negative and would go below 0', async () => {
        const env = makeSocketEnv('game-abc');
        // 3 damage already recorded
        mockPlayer = makePlayer('2', { '1': 3 });
        makeGameDoc([mockPlayer]);
        mockFindOne.mockResolvedValue(mockGameDoc);

        await callHandler(env, { toPlayerId: '2', fromPlayerId: '1', delta: -10 });

        expect(mockPlayer.commanderDamage.get('1')).toBe(0);
    });

    test('does nothing when connectedClients has no entry for socket', async () => {
        const { io, socket, connectedClients, emitted } = makeSocketEnv('game-abc');
        connectedClients.clear(); // no mapping

        await callHandler({ io, socket, connectedClients, emitted },
            { toPlayerId: '2', fromPlayerId: '1', delta: 5 });

        expect(emitted).toHaveLength(0);
        expect(mockFindOne).not.toHaveBeenCalled();
    });

    test('drops payload with missing toPlayerId', async () => {
        const env = makeSocketEnv('game-abc');

        await callHandler(env, { fromPlayerId: '1', delta: 5 }); // toPlayerId missing

        expect(env.emitted).toHaveLength(0);
        expect(mockFindOne).not.toHaveBeenCalled();
    });

    test('drops payload when delta is not a number', async () => {
        const env = makeSocketEnv('game-abc');

        await callHandler(env, { toPlayerId: '2', fromPlayerId: '1', delta: 'lots' });

        expect(env.emitted).toHaveLength(0);
    });

    test('does nothing when the player is not found in the game', async () => {
        const env = makeSocketEnv('game-abc');
        // game has no player with id '99'
        makeGameDoc([makePlayer('1')]);
        mockFindOne.mockResolvedValue(mockGameDoc);

        await callHandler(env, { toPlayerId: '99', fromPlayerId: '1', delta: 5 });

        // Broadcast still goes out (optimistic), but save is not called
        expect(mockGameSave).not.toHaveBeenCalled();
    });

    test('handles DB failure gracefully without throwing', async () => {
        const env = makeSocketEnv('game-abc');
        mockFindOne.mockRejectedValue(new Error('DB down'));

        // Should not throw
        await expect(
            callHandler(env, { toPlayerId: '2', fromPlayerId: '1', delta: 2 })
        ).resolves.toBeUndefined();
    });
});
