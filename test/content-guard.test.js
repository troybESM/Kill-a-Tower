// Content-count guard coverage (spec Req 4.2/4.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_DB, CARD_COUNT_MIN, CARD_COUNT_MAX,
  validateCardDb, assertCardDbValid, makeStarterDeck,
} from '../js/cards.js';

test('CARD_DB size is within the allowed range', () => {
  const count = Object.keys(CARD_DB).length;
  assert.ok(count >= CARD_COUNT_MIN && count <= CARD_COUNT_MAX,
    `card count ${count} within ${CARD_COUNT_MIN}-${CARD_COUNT_MAX}`);
});

test('validateCardDb reports no problems for the real content set', () => {
  assert.deepEqual(validateCardDb(), []);
});

test('assertCardDbValid does not throw for the real content set', () => {
  assert.doesNotThrow(() => assertCardDbValid());
});

test('validateCardDb flags a too-small content set', () => {
  const tiny = { strike: CARD_DB.strike, defend: CARD_DB.defend };
  const problems = validateCardDb(tiny);
  assert.ok(problems.length >= 1);
  assert.ok(problems.some((p) => /outside the allowed range/.test(p)));
});

test('validateCardDb flags a mismatched id', () => {
  const bad = { ...cloneWithin(), wrongKey: { ...CARD_DB.strike } }; // id 'strike' != key 'wrongKey'
  const problems = validateCardDb(bad);
  assert.ok(problems.some((p) => /mismatched id/.test(p)));
});

test('validateCardDb flags a missing text() renderer', () => {
  const set = cloneWithin();
  const key = Object.keys(set)[0];
  set[key] = { ...set[key], text: undefined };
  const problems = validateCardDb(set);
  assert.ok(problems.some((p) => /missing a text\(\) renderer/.test(p)));
});

test('starter deck stays within spec Req 4.1 (8-12 cards)', () => {
  const deck = makeStarterDeck();
  assert.ok(deck.length >= 8 && deck.length <= 12, `starter deck ${deck.length} cards`);
});

// Build a shallow copy of the real CARD_DB (enough cards to stay in range so
// only the injected fault is reported).
function cloneWithin() {
  const out = {};
  for (const k of Object.keys(CARD_DB)) out[k] = CARD_DB[k];
  return out;
}
