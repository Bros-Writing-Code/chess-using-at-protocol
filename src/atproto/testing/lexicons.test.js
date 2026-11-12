import { readFileSync } from 'node:fs';
import { Lexicons, lexiconDoc } from '@atproto/lexicon';
import { describe, expect, it } from 'vitest';

const schemas = [
  '../lexicons/com/atproto/repo/strongRef.json',
  '../lexicons/app/chess/game.json',
  '../lexicons/app/chess/reject.json',
].map((path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')));

// Register the real strongRef dependency so nested URI and CID validation runs.
const lexicons = new Lexicons(structuredClone(schemas));
const GAME = 'app.chess.game';
const REJECT = 'app.chess.reject';
const ALICE = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz';
const BOB = 'did:plc:z72i7hdynmk6r22z27h6tvur';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GAME_REF = {
  uri: `at://${ALICE}/${GAME}/3k2xw7ymrvc2j`,
  cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
};

function game(overrides = {}) {
  return {
    $type: GAME,
    opponent: BOB,
    color: 'white',
    pgn: '',
    fen: START_FEN,
    status: 'active',
    ...overrides,
  };
}

function reject(overrides = {}) {
  return {
    $type: REJECT,
    subject: { ...GAME_REF },
    reason: 'illegalMove',
    ...overrides,
  };
}

function validate(record) {
  return lexicons.assertValidRecord(record.$type, record);
}

describe('Option 1 Lexicon documents', () => {
  it.each(schemas)('$id is a valid Lexicon v1 document', (schema) => {
    expect(() => lexiconDoc.parse(schema)).not.toThrow();
  });

  it.each([GAME, REJECT])('%s uses a TID key for independently addressable records', (id) => {
    expect(lexicons.getDef(id)).toMatchObject({ type: 'record', key: 'tid' });
  });

  it('requires a matching $type discriminator', () => {
    for (const [id, record] of [[GAME, game()], [REJECT, reject()]]) {
      delete record.$type;
      expect(() => lexicons.assertValidRecord(id, record)).toThrow();
      record.$type = 'app.chess.move';
      expect(() => lexicons.assertValidRecord(id, record)).toThrow();
    }
  });

  it('permits extra fields for compatible schema evolution', () => {
    expect(() => validate(game({ clientVersion: '1' }))).not.toThrow();
    expect(() => validate(reject({ clientVersion: '1' }))).not.toThrow();
  });

  it('does not treat null as omission or an empty value', () => {
    for (const field of ['opponent', 'color', 'pgn', 'fen', 'status', 'challenge']) {
      expect(() => validate(game({ [field]: null }))).toThrow();
    }
    for (const field of ['subject', 'reason', 'message']) {
      expect(() => validate(reject({ [field]: null }))).toThrow();
    }
  });
});

describe('game record', () => {
  it('accepts a starting challenge without a challenge reference', () => {
    expect(() => validate(game())).not.toThrow();
  });

  it('accepts an acceptance with the opposite color and a versioned challenge', () => {
    expect(() => validate(game({
      opponent: ALICE,
      color: 'black',
      challenge: { ...GAME_REF },
    }))).not.toThrow();
  });

  it('accepts a full-history move update', () => {
    expect(() => validate(game({
      pgn: '1. e4 e5 2. Nf3 *',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    }))).not.toThrow();
  });

  it('accepts resignation without requiring a new move', () => {
    expect(() => validate(game({ status: 'resigned' }))).not.toThrow();
  });

  it.each(['opponent', 'color', 'pgn', 'fen', 'status'])('requires %s', (field) => {
    const record = game();
    delete record[field];
    expect(() => validate(record)).toThrow();
  });

  it.each([
    ['opponent', 'bob.bsky.social'],
    ['opponent', ''],
    ['color', 'w'],
    ['color', 'red'],
    ['pgn', []],
    ['fen', ''],
    ['fen', 42],
    ['status', 'checkmate'],
    ['status', 'draw'],
  ])('rejects invalid %s value %j', (field, value) => {
    expect(() => validate(game({ [field]: value }))).toThrow();
  });

  it('bounds PGN in UTF-8 bytes while allowing empty starting history', () => {
    expect(() => validate(game({ pgn: 'é'.repeat(131072) }))).not.toThrow();
    expect(() => validate(game({ pgn: 'é'.repeat(131072) + 'a' }))).toThrow();
  });

  it('bounds FEN length', () => {
    expect(() => validate(game({ fen: 'a'.repeat(256) }))).not.toThrow();
    expect(() => validate(game({ fen: 'a'.repeat(257) }))).toThrow();
  });

  it('leaves PGN legality and PGN/FEN agreement to the client engine', () => {
    // Lexicon has no chess-specific string format or cross-field constraints.
    expect(() => validate(game({ pgn: 'not PGN', fen: 'not FEN' }))).not.toThrow();
  });
});

describe('reject record', () => {
  it.each(['wrongTurn', 'badPrev', 'illegalMove', 'badFEN'])('accepts reason %s', (reason) => {
    expect(() => validate(reject({ reason }))).not.toThrow();
  });

  it('accepts an optional plain-text explanation', () => {
    expect(() => validate(reject({ message: 'Please replay your last move.' }))).not.toThrow();
    expect(() => validate(reject({ message: '' }))).not.toThrow();
  });

  it.each(['subject', 'reason'])('requires %s', (field) => {
    const record = reject();
    delete record[field];
    expect(() => validate(record)).toThrow();
  });

  it.each(['timeout', 'desynchronized', 'customReason'])('accepts future reason %j', (reason) => {
    expect(() => validate(reject({ reason }))).not.toThrow();
  });

  it.each(['', 42, []])('rejects invalid reason %j', (reason) => {
    expect(() => validate(reject({ reason }))).toThrow();
  });

  it('bounds explanations by grapheme count and UTF-8 bytes', () => {
    expect(() => validate(reject({ message: 'a'.repeat(200) }))).not.toThrow();
    expect(() => validate(reject({ message: 'a'.repeat(201) }))).toThrow();
    expect(() => validate(reject({ message: '👩‍💻'.repeat(181) }))).not.toThrow();
    expect(() => validate(reject({ message: '👩‍💻'.repeat(182) }))).toThrow();
    expect(() => validate(reject({ message: 42 }))).toThrow();
  });
});

describe.each([
  ['game.challenge', (ref) => game({ challenge: ref })],
  ['reject.subject', (ref) => reject({ subject: ref })],
])('%s strong reference', (_name, recordWithRef) => {
  it.each([
    ['URI only', GAME_REF.uri],
    ['missing CID', { uri: GAME_REF.uri }],
    ['missing URI', { cid: GAME_REF.cid }],
    ['malformed URI', { ...GAME_REF, uri: 'https://example.com/game' }],
    ['malformed CID', { ...GAME_REF, cid: 'not-a-cid' }],
    ['null', null],
  ])('rejects %s', (_case, ref) => {
    expect(() => validate(recordWithRef(ref))).toThrow();
  });
});
