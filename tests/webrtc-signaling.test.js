/**
 * WebRTC Signaling Relay — server-side handler tests.
 *
 * Verifies that the three relay handlers (webrtc_offer, webrtc_answer,
 * webrtc_ice_candidate) correctly forward payloads to the target socket
 * and reject malformed messages.
 */

'use strict';

// ── Fake socket / io environment ──────────────────────────────────────────────

function makeEnv() {
    const emitted = []; // { to, event, data }

    const io = {
        to: jest.fn((socketId) => ({
            emit: jest.fn((event, data) => emitted.push({ to: socketId, event, data }))
        }))
    };

    const socket = { id: 'socket-A' };

    return { io, socket, emitted };
}

// Inline the relay logic from server.js so we can test it in isolation.
function registerHandlers(socket, io) {
    const handlers = {};

    const on = (event, fn) => { handlers[event] = fn; };

    on('webrtc_offer', ({ to, offer }) => {
        if (to && offer) io.to(to).emit('webrtc_offer', { from: socket.id, offer });
    });

    on('webrtc_answer', ({ to, answer }) => {
        if (to && answer) io.to(to).emit('webrtc_answer', { from: socket.id, answer });
    });

    on('webrtc_ice_candidate', ({ to, candidate }) => {
        if (to && candidate) io.to(to).emit('webrtc_ice_candidate', { from: socket.id, candidate });
    });

    // Helper to fire a registered handler
    handlers._fire = (event, payload) => handlers[event]?.(payload);

    return handlers;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('webrtc_offer relay', () => {
    test('forwards offer to the target socket', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);
        const fakeOffer = { type: 'offer', sdp: 'v=0...' };

        h._fire('webrtc_offer', { to: 'socket-B', offer: fakeOffer });

        expect(io.to).toHaveBeenCalledWith('socket-B');
        expect(emitted).toHaveLength(1);
        expect(emitted[0]).toMatchObject({
            to: 'socket-B',
            event: 'webrtc_offer',
            data: { from: 'socket-A', offer: fakeOffer }
        });
    });

    test('drops message when "to" is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_offer', { offer: { type: 'offer', sdp: '...' } });

        expect(emitted).toHaveLength(0);
        expect(io.to).not.toHaveBeenCalled();
    });

    test('drops message when offer body is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_offer', { to: 'socket-B' });

        expect(emitted).toHaveLength(0);
    });
});

describe('webrtc_answer relay', () => {
    test('forwards answer to the target socket', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);
        const fakeAnswer = { type: 'answer', sdp: 'v=0...' };

        h._fire('webrtc_answer', { to: 'socket-B', answer: fakeAnswer });

        expect(io.to).toHaveBeenCalledWith('socket-B');
        expect(emitted[0]).toMatchObject({
            to: 'socket-B',
            event: 'webrtc_answer',
            data: { from: 'socket-A', answer: fakeAnswer }
        });
    });

    test('drops message when "to" is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_answer', { answer: { type: 'answer', sdp: '...' } });

        expect(emitted).toHaveLength(0);
    });

    test('drops message when answer body is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_answer', { to: 'socket-B' });

        expect(emitted).toHaveLength(0);
    });
});

describe('webrtc_ice_candidate relay', () => {
    test('forwards ICE candidate to the target socket', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);
        const fakeCandidate = { candidate: 'candidate:...', sdpMLineIndex: 0 };

        h._fire('webrtc_ice_candidate', { to: 'socket-B', candidate: fakeCandidate });

        expect(io.to).toHaveBeenCalledWith('socket-B');
        expect(emitted[0]).toMatchObject({
            to: 'socket-B',
            event: 'webrtc_ice_candidate',
            data: { from: 'socket-A', candidate: fakeCandidate }
        });
    });

    test('drops message when "to" is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_ice_candidate', { candidate: { candidate: '...' } });

        expect(emitted).toHaveLength(0);
    });

    test('drops message when candidate is missing', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_ice_candidate', { to: 'socket-B' });

        expect(emitted).toHaveLength(0);
    });

    test('does not echo back to sender', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        h._fire('webrtc_ice_candidate', {
            to: 'socket-B',
            candidate: { candidate: 'candidate:...' }
        });

        // Should only go to 'socket-B', not 'socket-A'
        expect(emitted.every(e => e.to === 'socket-B')).toBe(true);
    });
});

describe('sender identity', () => {
    test('from field is always the sender socket id, not a spoofed value', () => {
        const { io, socket, emitted } = makeEnv();
        const h = registerHandlers(socket, io);

        // Client tries to spoof 'from'
        h._fire('webrtc_offer', {
            to: 'socket-B',
            from: 'SPOOFED',  // this field should be ignored
            offer: { type: 'offer', sdp: '...' }
        });

        expect(emitted[0].data.from).toBe('socket-A'); // always server-assigned
    });
});
