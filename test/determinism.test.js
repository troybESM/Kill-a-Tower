// Shuffle / draw determinism through the real engine + state seeding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, newRun, Combat, recordingEvents } from './helpers.js';

test('initCombat produces identical drawPile order for the same seed', () => {
  newRun(2024);
  Combat.initCombat(['cultist'], false);
  const order1 = [...state.combat.drawPile];

  newRun(2024);
  Combat.initCombat(['cultist'], false);
  const order2 = [...state.combat.drawPile];

  assert.deepEqual(order1, order2);
});

test('different seeds generally produce different drawPile order', () => {
  newRun(1);
  Combat.initCombat(['cultist'], false);
  const a = [...state.combat.drawPile];
  newRun(999999);
  Combat.initCombat(['cultist'], false);
  const b = [...state.combat.drawPile];
  assert.notDeepEqual(a, b);
});

test('drawPile is a permutation of the run deck', () => {
  newRun(77);
  Combat.initCombat(['cultist'], false);
  const sorted = (arr) => [...arr].sort();
  assert.deepEqual(sorted(state.combat.drawPile), sorted(state.deck));
});

test('discard -> draw reshuffle is deterministic given the seed', () => {
  // Draw entire pile into hand, discard it, then draw again; the reshuffled
  // order must be identical across two identically-seeded runs.
  function run() {
    newRun(31337);
    const events = recordingEvents();
    Combat.initCombat(['cultist'], false);
    const c = state.combat;
    // Move whole draw pile to discard, empty hand, then draw 3 (forces reshuffle)
    c.discardPile = [...c.drawPile];
    c.drawPile = [];
    c.hand = [];
    Combat.startPlayerTurn(events); // draws 5, triggering reshuffle of discard
    return [...c.hand];
  }
  assert.deepEqual(run(), run());
});
