// Win / lose condition coverage through the real engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, Combat, freshCombat, loadHand, firstEnemy } from './helpers.js';

test('killing the last enemy sets over/result win and fires onCombatEnd(win)', () => {
  const { events } = freshCombat(['spider']);
  const c = state.combat;
  const e = firstEnemy();
  e.hp = 6; // one strike kills
  loadHand(['strike']);
  Combat.playCard(0, e, events);
  assert.equal(c.over, true);
  assert.equal(c.result, 'win');
  const ends = events._calls.onCombatEnd || [];
  assert.ok(ends.some((a) => a[0] === 'win'), 'onCombatEnd("win") fired');
});

test('win requires ALL enemies dead', () => {
  const { events } = freshCombat(['spider', 'spider']);
  const c = state.combat;
  const [a, b] = c.enemies;
  a.hp = 6; b.hp = 30;
  loadHand(['strike']);
  Combat.playCard(0, a, events);
  assert.equal(c.over, false, 'still one enemy alive');
  assert.equal(c.result, null);
});

test('player at 0 hp results in a loss during the enemy phase', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  state.hp = 3;  // cultist turn-1 buffs then hits; force a lethal state instead
  c.block = 0;
  // Force the cultist onto its Dark Strike (6 dmg) by advancing its turn.
  const e = firstEnemy();
  e.turn = 1;
  e.intent = e.pickMove(2); // Dark Strike, 6 dmg > 3 hp
  c.hand = [];
  Combat.endTurn(events);
  assert.equal(state.hp, 0);
  assert.equal(c.over, true);
  assert.equal(c.result, 'lose');
  const ends = events._calls.onCombatEnd || [];
  assert.ok(ends.some((a) => a[0] === 'lose'), 'onCombatEnd("lose") fired');
});

test('lethal poison tick on end of turn wins the combat', () => {
  const { events } = freshCombat(['spider']);
  const c = state.combat;
  const e = firstEnemy();
  e.hp = 4;
  e.statuses.poison = 4; // poison tick deals 4 -> dead at end of player turn
  c.hand = [];
  Combat.endTurn(events);
  assert.equal(e.hp, 0);
  assert.equal(c.over, true);
  assert.equal(c.result, 'win');
  // enemy phase must NOT have run after the poison-tick win.
  assert.ok((events._calls.onEnemyAct || []).length === 0, 'enemy did not act after poison win');
});
