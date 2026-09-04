// Tests for the NEW data-driven keywords / ops added in FEAT-002.
// Each test drives the real engine and would fail if the mechanic were reverted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, newRun, Combat, freshCombat, startedCombat, loadHand, firstEnemy, recordingEvents } from './helpers.js';
import { getCard, upgradeCard, CARD_DB } from '../js/cards.js';

// ---- multi-hit with per-hit scaling ----
test('multiDamage deals amount * hits with no modifiers', () => {
  const { events } = freshCombat(['bruteGuard']);
  const e = firstEnemy();
  const hp0 = e.hp;
  loadHand(['flurryOfKnives']); // 3 dmg x3
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 9);
});

test('multiDamage recomputes vulnerable per hit', () => {
  // vulnerable makes each 3-dmg hit floor(3*1.5)=4, x3 = 12
  const { events } = freshCombat(['bruteGuard']);
  const e = firstEnemy();
  e.statuses.vulnerable = 5;
  const hp0 = e.hp;
  loadHand(['flurryOfKnives']);
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 12);
  assert.ok((events._calls.onMultiHit || []).length === 1, 'onMultiHit fired');
});

test('multiDamage stops early if the target dies mid-combo', () => {
  const { events } = freshCombat(['spider']);
  const e = firstEnemy();
  e.hp = 5; // flurry is 3x3; first hit -> 2, second -> dead, third should not run
  loadHand(['flurryOfKnives']);
  Combat.playCard(0, e, events);
  assert.equal(e.hp, 0);
  // Only enemies-damaged events up to death; combat should register a win.
  assert.equal(state.combat.result, 'win');
});

// ---- exhaust ----
test('exhaust card goes to exhaustPile, not discardPile', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.discardPile = [];
  c.exhaustPile = [];
  loadHand(['adrenaline']); // exhaust:true skill
  Combat.playCard(0, null, events);
  assert.ok(c.exhaustPile.includes('adrenaline'));
  assert.ok(!c.discardPile.includes('adrenaline'));
  assert.ok((events._calls.onCardExhausted || []).length >= 1);
});

test('exhausted cards are not reshuffled back into the draw pile', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.drawPile = [];
  c.discardPile = [];
  c.exhaustPile = [];
  loadHand(['backstab']); // exhaust:true
  const e = firstEnemy();
  Combat.playCard(0, e, events);
  // Now draw: draw pile empty, discard empty -> nothing to reshuffle from.
  Combat.startPlayerTurn(events); // triggers draw from empty piles
  assert.ok(!c.drawPile.includes('backstab'));
  assert.ok(!c.hand.includes('backstab'));
  assert.ok(c.exhaustPile.includes('backstab'));
});

// ---- retain ----
test('retain card stays in hand through endTurn; others are discarded', () => {
  // Kill the enemy first so endTurn ends the combat right after the discard
  // step (poison tick -> checkCombatEnd -> return) without drawing a new hand,
  // which would otherwise repopulate c.hand and mask the retain behavior.
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.discardPile = [];
  firstEnemy().hp = 0; // combat ends after the discard step in endTurn
  // preparation has retain:true; strike does not.
  c.hand = ['preparation', 'strike'];
  Combat.endTurn(events);
  assert.ok(c.hand.includes('preparation'), 'retain card kept in hand');
  assert.ok(!c.hand.includes('strike'), 'non-retain card removed from hand');
  assert.ok(c.discardPile.includes('strike'), 'non-retain card went to discard');
});

// ---- innate ----
test('innate card is guaranteed in the opening hand', () => {
  // backstab is innate. Put it in the deck (starter deck has no innate card),
  // then let initCombat's moveInnateToTop + startPlayerTurn draw the opener.
  // Use a large non-innate filler so a random shuffle would only rarely place
  // backstab in the top 5 — proving the innate placement, not luck.
  newRun(4242);
  state.deck = ['backstab', ...Array(20).fill('strike')];
  const events = recordingEvents();
  Combat.initCombat(['cultist'], false);
  Combat.startCombatHooks(events);
  assert.ok(state.combat.hand.includes('backstab'), 'innate backstab present in opening hand');
});

// ---- conditional if/then/else ----
test('conditional then-branch runs when target is poisoned', () => {
  const { events } = freshCombat(['cultist']);
  const e = firstEnemy();
  e.statuses.poison = 3; // poisoned -> then branch applies 4 poison (total 7)
  loadHand(['envenomedEdge']); // 5 dmg + if poisoned: +4 else +2
  const hp0 = e.hp;
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 5);
  assert.equal(e.statuses.poison, 3 + 4);
});

test('conditional else-branch runs when target is NOT poisoned', () => {
  const { events } = freshCombat(['cultist']);
  const e = firstEnemy();
  e.statuses.poison = 0; // else branch applies 2 poison
  loadHand(['envenomedEdge']);
  const hp0 = e.hp;
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 5);
  assert.equal(e.statuses.poison, 2);
});

test('finisher execute threshold (targetHpBelowPct) branches correctly', () => {
  // Above threshold: 12 dmg. Below 35%: 24 dmg.
  let { events } = freshCombat(['ironColossus']); // maxHp 140
  let e = firstEnemy();
  e.hp = 140; // full -> above threshold
  loadHand(['finisher']);
  Combat.playCard(0, e, events);
  assert.equal(e.hp, 140 - 12);

  ({ events } = freshCombat(['ironColossus']));
  e = firstEnemy();
  e.hp = 40; // 40/140 = 0.285 < 0.35 -> execute for 24
  loadHand(['finisher']);
  Combat.playCard(0, e, events);
  assert.equal(e.hp, 40 - 24);
});

// ---- poison payoff ----
test('damagePerPoison scales with poison and does NOT consume it', () => {
  const { events } = freshCombat(['bruteGuard']);
  const e = firstEnemy();
  e.statuses.poison = 6;
  const hp0 = e.hp;
  loadHand(['toxicPayoff']); // 2 dmg per poison -> 12
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 12);
  assert.equal(e.statuses.poison, 6, 'poison not consumed');
});

test('detonatePoison deals poison*mult then clears poison', () => {
  const { events } = freshCombat(['bruteGuard']);
  const e = firstEnemy();
  e.statuses.poison = 5;
  const hp0 = e.hp;
  loadHand(['venomBurst']); // detonate mult 2 -> 10 dmg, poison cleared, exhaust
  Combat.playCard(0, e, events);
  assert.equal(e.hp, hp0 - 10);
  assert.equal(e.statuses.poison, 0, 'poison cleared after detonation');
  assert.ok(state.combat.exhaustPile.includes('venomBurst'));
  assert.ok((events._calls.onDetonate || []).length === 1);
});

// ---- blockPerCardPlayed ----
test('blockPerCardPlayed scales with cards played this turn', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.block = 0;
  c.cardsPlayedThisTurn = 0;
  CARD_DB.__test_bp = {
    id: '__test_bp', name: 'BP', cost: 0, type: 'skill', target: 'self', art: '🛡',
    effects: [{ op: 'blockPerCardPlayed', per: 2 }], text: () => 'block per card',
  };
  try {
    // Play two 0-cost strikes-equivalents first to bump the counter.
    c.hand = ['defend', 'defend', '__test_bp'];
    Combat.playCard(0, null, events); // cardsPlayed -> 1
    Combat.playCard(0, null, events); // cardsPlayed -> 2
    const blockBefore = c.block;
    Combat.playCard(0, null, events); // this is card #3 -> per(2)*3 = 6 block
    assert.equal(c.block - blockBefore, 6);
  } finally {
    delete CARD_DB.__test_bp;
  }
});

// ---- drawIf ----
test('drawIf draws only when the condition holds', () => {
  const { events } = freshCombat(['cultist']);
  const c = state.combat;
  c.drawPile = ['strike', 'strike', 'strike', 'strike'];
  c.discardPile = [];
  // reflex: drawIf cardsPlayed >=1 amount 2, gainDex 1. First card played this
  // turn -> cardsPlayedThisTurn becomes 1 before effects resolve, so it draws.
  c.hand = ['reflex'];
  c.cardsPlayedThisTurn = 0;
  Combat.playCard(0, null, events);
  assert.equal(c.hand.length, 2, 'drew 2 because a card was played this turn');
  assert.equal(c.statuses.dex, 1);
});

// ---- card upgrade resolver ----
test('upgradeCard returns a merged upgraded def without mutating CARD_DB', () => {
  const base = getCard('strike');
  const up = upgradeCard('strike');
  assert.equal(up.isUpgraded, true);
  assert.equal(up.effects[0].amount, 9);        // upgraded damage
  assert.equal(base.effects[0].amount, 6);      // base unchanged
  assert.equal(CARD_DB.strike.effects[0].amount, 6, 'CARD_DB not mutated');
});

test('upgraded card actually deals its upgraded damage when played', () => {
  // Register the upgraded strike as a playable card and confirm 9 dmg.
  const { events } = freshCombat(['bruteGuard']);
  const up = upgradeCard('strike');
  CARD_DB.__test_up = { ...up, id: '__test_up', target: 'enemy', type: 'attack' };
  try {
    const e = firstEnemy();
    const hp0 = e.hp;
    loadHand(['__test_up']);
    Combat.playCard(0, e, events);
    assert.equal(e.hp, hp0 - 9);
  } finally {
    delete CARD_DB.__test_up;
  }
});
