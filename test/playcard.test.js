// playCard energy handling, effectiveCost, relic discount, rejection, reshuffle,
// and a couple of signature cards played against a real enemy instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, Combat, freshCombat, loadHand, firstEnemy, makeEnemyInstance } from './helpers.js';
import { RELIC_DB } from '../js/relics.js';
import { getCard } from '../js/cards.js';

test('playCard deducts the card cost from energy', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.energy = 3;
  loadHand(['deadlyPoison']); // cost 1
  Combat.playCard(0, firstEnemy(), events);
  assert.equal(c.energy, 2);
});

test('effectiveCost applies relic firstCardDiscount only on the first card', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  state.relics = [RELIC_DB.brokenHourglass]; // firstCardDiscount 1
  c.energy = 3;
  c.firstCardPlayedThisTurn = false;
  // strike cost 1 -> discounted to 0 on first play
  assert.equal(Combat.effectiveCost(getCard('strike')), 0);
  loadHand(['strike', 'strike']);
  Combat.playCard(0, firstEnemy(), events);
  assert.equal(c.energy, 3, 'first card was free');
  // second card: full cost 1
  assert.equal(Combat.effectiveCost(getCard('strike')), 1);
  Combat.playCard(0, firstEnemy(), events);
  assert.equal(c.energy, 2);
});

test('canPlayCard is false and hand unchanged when energy is insufficient', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.energy = 1;
  loadHand(['crippling']); // cost 2
  assert.equal(Combat.canPlayCard('crippling'), false);
  const handBefore = [...c.hand];
  const ok = Combat.playCard(0, null, events);
  assert.equal(ok, false, 'playCard rejected');
  assert.deepEqual(c.hand, handBefore, 'hand unchanged');
  assert.equal(c.energy, 1, 'energy unchanged');
});

test('drawing from an empty drawPile triggers a reshuffle of the discard pile', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.drawPile = [];
  c.discardPile = ['strike', 'defend', 'neutralize'];
  c.hand = [];
  // Use a card effect that draws — daggerThrow draws 1. Put it in hand first.
  c.hand = ['daggerThrow'];
  const e = firstEnemy();
  Combat.playCard(0, e, events); // deals damage + draw 1 -> forces reshuffle
  // The 3 discard cards were reshuffled into the draw pile; 1 was drawn to hand.
  assert.equal(c.hand.length, 1, 'drew one card after reshuffle');
  assert.equal(c.drawPile.length, 2, 'two cards remain in the reshuffled draw pile');
  // daggerThrow itself is discarded after resolving.
  assert.deepEqual(c.discardPile, ['daggerThrow']);
});

test('signature poison-payoff played against a real enemy instance', () => {
  const { events } = freshCombat(['bruteGuard']);
  const e = firstEnemy();
  assert.equal(e.constructor, makeEnemyInstance('bruteGuard').constructor);
  e.statuses.poison = 4;
  const hp0 = e.hp;
  loadHand(['toxicPayoff']); // 2 per poison -> 8
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 8);
});

test('signature multi-hit played against a real enemy instance', () => {
  const { events } = freshCombat(['ironColossus']);
  const e = firstEnemy();
  const hp0 = e.hp;
  loadHand(['bladeDance']); // 4 dmg x2 = 8
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 8);
});

test('signature conditional card played against a real enemy instance', () => {
  const { events } = freshCombat(['cultist']);
  const e = firstEnemy();
  e.statuses.poison = 1; // poisoned -> then branch (+4)
  loadHand(['envenomedEdge']);
  const hp0 = e.hp;
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 5);
  assert.equal(e.statuses.poison, 5);
});

test('power cards stay in play (not discarded, not exhausted)', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.discardPile = [];
  c.exhaustPile = [];
  loadHand(['noxiousFumes']); // type power
  Combat.playCard(0, null, events);
  assert.ok(!c.discardPile.includes('noxiousFumes'));
  assert.ok(!c.exhaustPile.includes('noxiousFumes'));
  assert.equal(c.powers.noxious, 2);
});
