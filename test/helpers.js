// Shared helpers for the Kill a Tower dev test suite.
//
// The combat engine mutates a single shared `state` singleton (js/state.js).
// Tests must reset that state between cases. newRun(seed) resets run-level
// fields and seeds a deterministic RNG; initCombat then derives a per-combat
// RNG from state.seed ^ state.nodeIndex, so combats are reproducible.
//
// These helpers keep the tests exercising the REAL engine (no mocking): they
// build a real combat via initCombat, then hand-place cards into the hand/piles
// so a specific mechanic can be driven deterministically.

import { state, newRun } from '../js/state.js';
import * as Combat from '../js/combat.js';
import { makeEnemyInstance } from '../js/enemies.js';

export { state, newRun, Combat };

// A no-op events object. Every engine callback is optional-chained, so an empty
// object is safe — but we use a recording proxy-like object so tests can also
// assert that specific callbacks fired.
export function recordingEvents() {
  const calls = {};
  return new Proxy(
    { _calls: calls },
    {
      get(target, prop) {
        if (prop === '_calls') return calls;
        // Return a function that records the call under its own name.
        return (...args) => {
          (calls[prop] ||= []).push(args);
        };
      },
    }
  );
}

// Reset the run to a fixed seed and start a fresh combat against `enemyIds`.
// Returns { c, events } where c === state.combat. Does NOT run startCombatHooks
// or draw a hand — callers that want the natural opening hand should call
// Combat.startCombatHooks(events).
export function freshCombat(enemyIds, { seed = 123, isBoss = false } = {}) {
  newRun(seed);
  const events = recordingEvents();
  Combat.initCombat(enemyIds, isBoss);
  return { c: state.combat, events };
}

// Start a combat AND run the opening hooks + first player turn (draws a hand).
export function startedCombat(enemyIds, opts = {}) {
  const { c, events } = freshCombat(enemyIds, opts);
  Combat.startCombatHooks(events);
  return { c, events };
}

// Place a single card into an empty hand and return its hand index (0).
// Clears the hand first so tests know exactly what is at index 0.
export function loadHand(cardIds) {
  const c = state.combat;
  c.hand = [...cardIds];
  return c.hand;
}

// The first living enemy (convenience for single-enemy fights).
export function firstEnemy() {
  return state.combat.enemies.find((e) => e.hp > 0) || state.combat.enemies[0];
}

export { makeEnemyInstance };
