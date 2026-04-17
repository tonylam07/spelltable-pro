'use strict';

const {
    parseMoxfield,
    parseArchidekt,
    parseText,
    detectSource,
    extractDeckId,
} = require('../api/services/deckParser');

// ── detectSource ──────────────────────────────────────────────────────────────
describe('detectSource', () => {
    test('detects moxfield', () => {
        expect(detectSource('https://www.moxfield.com/decks/abc123')).toBe('moxfield');
    });
    test('detects archidekt', () => {
        expect(detectSource('https://archidekt.com/decks/1234567/my-deck')).toBe('archidekt');
    });
    test('returns null for unknown domain', () => {
        expect(detectSource('https://deckstats.net/deck/123')).toBeNull();
    });
});

// ── extractDeckId ─────────────────────────────────────────────────────────────
describe('extractDeckId', () => {
    test('extracts moxfield deck id', () => {
        expect(extractDeckId('https://www.moxfield.com/decks/AbC123xYz', 'moxfield')).toBe('AbC123xYz');
    });
    test('extracts archidekt numeric id', () => {
        expect(extractDeckId('https://archidekt.com/decks/9876543/my-deck-name', 'archidekt')).toBe('9876543');
    });
    test('returns null for bad moxfield url', () => {
        expect(extractDeckId('https://www.moxfield.com/', 'moxfield')).toBeNull();
    });
});

// ── parseMoxfield ─────────────────────────────────────────────────────────────
describe('parseMoxfield', () => {
    function makeMoxData(overrides = {}) {
        return {
            name:   'Test Commander Deck',
            format: 'commander',
            boards: {
                commanders: {
                    cards: {
                        'Atraxa': {
                            quantity: 1,
                            card: {
                                name: 'Atraxa, Praetors\' Voice',
                                scryfall_id: 'aaa-111',
                                type_line: 'Legendary Creature — Phyrexian Angel',
                                mana_cost: '{G}{W}{U}{B}',
                                cmc: 4,
                            }
                        }
                    }
                },
                mainboard: {
                    cards: {
                        'Sol Ring': {
                            quantity: 1,
                            card: { name: 'Sol Ring', scryfall_id: 'bbb-222', type_line: 'Artifact', mana_cost: '{1}', cmc: 1 }
                        },
                        'Lightning Bolt': {
                            quantity: 4,
                            card: { name: 'Lightning Bolt', scryfall_id: 'ccc-333', type_line: 'Instant', mana_cost: '{R}', cmc: 1 }
                        }
                    }
                },
                sideboard: { cards: {} },
                ...overrides
            }
        };
    }

    test('parses commander', () => {
        const deck = parseMoxfield(makeMoxData());
        expect(deck.commander).not.toBeNull();
        expect(deck.commander.name).toBe('Atraxa, Praetors\' Voice');
        expect(deck.commander.scryfallId).toBe('aaa-111');
    });

    test('parses mainboard cards', () => {
        const deck = parseMoxfield(makeMoxData());
        expect(deck.mainboard).toHaveLength(2);
        const bolt = deck.mainboard.find(c => c.name === 'Lightning Bolt');
        expect(bolt.quantity).toBe(4);
        expect(bolt.scryfallId).toBe('ccc-333');
    });

    test('sets format', () => {
        expect(parseMoxfield(makeMoxData()).format).toBe('commander');
    });

    test('computes totalCards (mainboard + commander)', () => {
        const deck = parseMoxfield(makeMoxData());
        // 1 Sol Ring + 4 Lightning Bolt + 1 commander = 6
        expect(deck.totalCards).toBe(6);
    });

    test('builds scryfall image URL from scryfallId', () => {
        const deck = parseMoxfield(makeMoxData());
        expect(deck.commander.imageUrl).toContain('aaa-111');
        expect(deck.commander.imageUrl).toMatch(/scryfall\.io/);
    });

    test('throws on invalid input', () => {
        expect(() => parseMoxfield(null)).toThrow();
        expect(() => parseMoxfield('string')).toThrow();
    });
});

// ── parseArchidekt ────────────────────────────────────────────────────────────
describe('parseArchidekt', () => {
    function makeArchData() {
        return {
            name:   'My Pioneer Deck',
            format: 9, // pioneer
            cards: [
                {
                    quantity: 1,
                    categories: ['Commander'],
                    card: {
                        uid: 'uid-aaa',
                        oracleCard: { name: 'Kenrith, the Returned King', typeLine: 'Legendary Creature', manaCost: '{4}{W}', cmc: 5 }
                    }
                },
                {
                    quantity: 4,
                    categories: ['Mainboard'],
                    card: {
                        uid: 'uid-bbb',
                        oracleCard: { name: 'Fatal Push', typeLine: 'Instant', manaCost: '{B}', cmc: 1 }
                    }
                },
                {
                    quantity: 2,
                    categories: ['Sideboard'],
                    card: {
                        uid: 'uid-ccc',
                        oracleCard: { name: 'Duress', typeLine: 'Sorcery', manaCost: '{B}', cmc: 1 }
                    }
                }
            ]
        };
    }

    test('maps numeric format to string', () => {
        expect(parseArchidekt(makeArchData()).format).toBe('pioneer');
    });

    test('separates commander, mainboard, sideboard', () => {
        const deck = parseArchidekt(makeArchData());
        expect(deck.commander.name).toBe('Kenrith, the Returned King');
        expect(deck.mainboard).toHaveLength(1);
        expect(deck.mainboard[0].name).toBe('Fatal Push');
        expect(deck.sideboard).toHaveLength(1);
        expect(deck.sideboard[0].name).toBe('Duress');
    });

    test('throws on invalid input', () => {
        expect(() => parseArchidekt(null)).toThrow();
    });
});

// ── parseText ─────────────────────────────────────────────────────────────────
describe('parseText', () => {
    test('parses basic card list', () => {
        const deck = parseText('4 Lightning Bolt\n2 Counterspell\n1 Sol Ring');
        expect(deck.mainboard).toHaveLength(3);
        expect(deck.mainboard.find(c => c.name === 'Lightning Bolt').quantity).toBe(4);
    });

    test('parses sideboard section', () => {
        const deck = parseText('4 Lightning Bolt\n\nSideboard\n2 Pyroblast');
        expect(deck.mainboard.find(c => c.name === 'Lightning Bolt')).toBeTruthy();
        expect(deck.sideboard.find(c => c.name === 'Pyroblast')).toBeTruthy();
        expect(deck.sideboard[0].quantity).toBe(2);
    });

    test('skips comment lines and blank lines', () => {
        const text = '// This is a comment\n4 Lightning Bolt\n\n// another comment\n1 Sol Ring';
        const deck = parseText(text);
        expect(deck.mainboard).toHaveLength(2);
    });

    test('parses MTGA format (set code + collector #)', () => {
        const deck = parseText('4 Lightning Bolt (M21) 154\n1 Sol Ring (CMR) 263');
        expect(deck.mainboard).toHaveLength(2);
        expect(deck.mainboard[0].name).toBe('Lightning Bolt');
        expect(deck.mainboard[1].name).toBe('Sol Ring');
    });

    test('handles "Deck" section header', () => {
        const deck = parseText('Deck\n4 Lightning Bolt\nSideboard\n2 Pyroblast');
        expect(deck.mainboard).toHaveLength(1);
        expect(deck.sideboard).toHaveLength(1);
    });

    test('parses commander section', () => {
        const deck = parseText('Commander\n1 Atraxa\n\nDeck\n1 Sol Ring');
        expect(deck.commander.name).toBe('Atraxa');
        expect(deck.mainboard).toHaveLength(1);
    });

    test('deduplicates repeated card names', () => {
        const deck = parseText('2 Sol Ring\n2 Sol Ring');
        const solRing = deck.mainboard.find(c => c.name === 'Sol Ring');
        expect(solRing.quantity).toBe(4);
    });

    test('throws on empty input', () => {
        expect(() => parseText('')).toThrow();
        expect(() => parseText('   ')).toThrow();
    });

    test('returns unknown format for text imports', () => {
        expect(parseText('4 Lightning Bolt').format).toBe('unknown');
    });
});
