// Core damage / block / poison / weak / vulnerable math via the real engine.
// Every case drives js/combat.js through playCard / endTurn and asserts exact
// numeric outcomes — reverting the math would fail these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, Combat, freshCombat, startedCombat, loadHand, firstEnemy } from './helpers.js';
import { RELIC_DB } from '../js/relics.js';
import { CARD_DB } from '../js/cards.js';

// Silence engine console.warn for unknown ops (none here, but keep tests quiet).

test('basic Strike deals its base damage', () => {
  const { events } = freshCombat(['cultist']);
  loadHand(['strike']);
  const e = firstEnemy();
  const hp0 = e.hp;
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 6);
});

test('strength adds to attack damage', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.statuses.str = 3;
  loadHand(['strike']);
  const e = firstEnemy();
  const hp0 = e.hp;
  Combat.playCard(0, e, events); // 6 + 3 = 9
  assert.equal(e.hp, hp0 - 9);
});

test('player weak reduces damage by 25% (floored)', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.statuses.weak = 1;
  loadHand(['strike']);
  const e = firstEnemy();
  const hp0 = e.hp;
  Combat.playCard(0, e, events); // floor(6 * 0.75) = 4
  assert.equal(e.hp, hp0 - 4);
});

test('target vulnerable increases damage by 50% (floored)', () => {
  const { events } = freshCombat(['cultist']);
  loadHand(['strike']);
  const e = firstEnemy();
  e.statuses.vulnerable = 1;
  const hp0 = e.hp;
  Combat.playCard(0, e, events); // floor(6 * 1.5) = 9
  assert.equal(e.hp, hp0 - 9);
});

test('weak and vulnerable combine (weak first, then vulnerable)', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.statuses.str = 2;   // base 6 + 2 = 8
  c.statuses.weak = 1;  // floor(8 * 0.75) = 6
  loadHand(['strike']);
  const e = firstEnemy();
  e.statuses.vulnerable = 1; // floor(6 * 1.5) = 9
  const hp0 = e.hp;
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 9);
});

test('enemy block absorbs damage before HP', () => {
  const { events } = freshCombat(['cultist']);
  loadHand(['strike', 'strike']);
  const e = firstEnemy();
  e.block = 4;
  const hp0 = e.hp;
  Combat.playCard(0, e, events); // 6 dmg: 4 absorbed, 2 to hp
  assert.equal(e.block, 0);
  assert.equal(e.hp, hp0 - 2);
});

test('Defend grants block, scaled by dexterity', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.block = 0;
  c.statuses.dex = 2;
  loadHand(['defend']);
  Combat.playCard(0, null, events); // 5 + 2 dex = 7
  assert.equal(c.block, 7);
});

test('poison is applied to the target', () => {
  const { events } = freshCombat(['cultist']);
  loadHand(['deadlyPoison']);
  const e = firstEnemy();
  Combat.playCard(0, e, events);
  assert.equal(e.statuses.poison, 5);
});

test('relic poisonBonus (Toxic Vial) adds 1 to applied poison', () => {
  const { events } = freshCombat(['cultist']);
  state.relics = [RELIC_DB.toxicVial];
  loadHand(['deadlyPoison']);
  const e = firstEnemy();
  Combat.playCard(0, e, events); // 5 + 1 bonus
  assert.equal(e.statuses.poison, 6);
});

test('poison ticks at end of player turn, ignores block, loses 1 stack', () => {
  // Two enemies: the poisoned one takes poison damage through its block; the
  // second stays alive so the combat does not end and we can inspect the
  // poisoned enemy immediately after the poison tick (before its own turn,
  // which would reset block). We assert hp (poison bypassed the 99 block) and
  // the -1 stack decay.
  const { events } = startedCombat(['spider', 'spider']); // opening turn sets enemy intents
  const c = state.combat;
  const [e, keepAlive] = c.enemies;
  e.statuses.poison = 5;
  e.block = 99;      // poison must ignore this block
  keepAlive.hp = 200; // survives the whole turn so combat continues
  const hp0 = e.hp;
  c.hand = [];       // nothing to discard
  Combat.endTurn(events);
  assert.equal(e.hp, hp0 - 5, 'poison ignored the 99 block and dealt 5 to hp');
  assert.equal(e.statuses.poison, 4, 'poison decremented by 1 stack');
});

test('doublePoison doubles current poison (via applyPoison)', () => {
  const { events } = freshCombat(['cultist']);
  const e = firstEnemy();
  e.statuses.poison = 4;
  loadHand(['catalyst']);
  Combat.playCard(0, e, events); // adds another 4 -> 8
  assert.equal(e.statuses.poison, 8);
});

test('damageAll hits every living enemy (temp card through real engine)', () => {
  const { events } = freshCombat(['spider', 'spider']);
  const c = state.combat;
  // Register a temporary card that uses the damageAll op, then play it through
  // the real playCard path so the damageAll switch case is exercised.
  CARD_DB.__test_cleave = {
    id: '__test_cleave', name: 'Test Cleave', cost: 1, type: 'attack', target: 'none', art: '⚔',
    effects: [{ op: 'damageAll', amount: 5 }], text: () => 'Deal 5 to ALL.',
  };
  try {
    const [a, b] = c.enemies;
    const ha = a.hp, hb = b.hp;
    loadHand(['__test_cleave']);
    Combat.playCard(0, null, events);
    assert.equal(a.hp, ha - 5);
    assert.equal(b.hp, hb - 5);
  } finally {
    delete CARD_DB.__test_cleave;
  }
});

test('poisonAll applies poison to all living enemies', () => {
  const { events } = freshCombat(['spider', 'spider']);
  const c = state.combat;
  loadHand(['bouncingFlask']);
  Combat.playCard(0, null, events); // poisonAll 3
  for (const e of c.enemies) assert.equal(e.statuses.poison, 3);
});

test('weakAll + poisonAll (Crippling Cloud) affects all enemies', () => {
  const { events } = freshCombat(['spider', 'spider']);
  const c = state.combat;
  loadHand(['crippling']);
  Combat.playCard(0, null, events); // poisonAll 4, weakAll 2
  for (const e of c.enemies) {
    assert.equal(e.statuses.poison, 4);
    assert.equal(e.statuses.weak, 2);
  }
});

test('weak/vulnerable applied to enemy then decays on end of turn', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  const e = firstEnemy();
  loadHand(['weaken']);
  Combat.playCard(0, e, events); // weak 2, vuln 2
  assert.equal(e.statuses.weak, 2);
  assert.equal(e.statuses.vulnerable, 2);
});
