// Global run state, shared across screens. A single mutable object.
import { makeStarterDeck } from './cards.js';
import { makeRng } from './rng.js';

export const PLAYER_MAX_HP = 70;

export const state = {
  // Run-level
  maxHp: PLAYER_MAX_HP,
  hp: PLAYER_MAX_HP,
  gold: 0,
  relics: [],            // array of relic definition objects
  deck: [],              // array of card ids (the master deck)
  maxEnergy: 3,

  // Determinism: a fixed seed per run + a run-level RNG derived from it.
  // Determinism only needs to hold WITHIN a run given this seed.
  seed: 0,
  rng: null,             // run-level RNG (relic/reward/encounter rolls)

  // Map
  nodes: [],             // array of node objects {type,label,index,done,current}
  nodeIndex: 0,

  // Combat-scoped (reset each fight, see combat.js initCombat)
  combat: null,
};

// Generate a fresh run seed. The single Math.random call here is the one-time
// seed generation at run start (allowed) — everything downstream is seeded.
function generateSeed() {
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}

export function newRun(seed) {
  state.maxHp = PLAYER_MAX_HP;
  state.hp = PLAYER_MAX_HP;
  state.gold = 0;
  state.relics = [];
  state.deck = makeStarterDeck();
  state.maxEnergy = 3;
  state.nodeIndex = 0;
  state.combat = null;
  // Seed the run. An explicit seed (e.g. from tests) is honored; otherwise a
  // fresh one is generated. The run-level RNG is reset from the seed.
  state.seed = (seed != null) ? seed : generateSeed();
  state.rng = makeRng(state.seed);
  buildMap();
}

// Derive a reproducible per-combat RNG from the run seed + a combat key
// (e.g. the node index), so each combat is independently reproducible.
export function combatRng(key) {
  return makeRng((state.seed >>> 0) ^ (Number(key) || 0) * 0x9e3779b1);
}

// Single path: Starting Relic -> Fight -> Fight -> Boss.
export function buildMap() {
  state.nodes = [
    { type: 'relic', icon: '💠', label: 'Starting Relic', desc: 'Choose a relic' },
    { type: 'fight', icon: '⚔', label: 'Battle I', desc: 'Enemy encounter', fightIndex: 0 },
    { type: 'fight', icon: '⚔', label: 'Battle II', desc: 'Enemy encounter', fightIndex: 1 },
    { type: 'boss', icon: '☠', label: 'Boss', desc: 'The tower guardian' },
  ].map((n, i) => ({ ...n, index: i, done: false }));
  state.nodeIndex = 0;
}

export function currentNode() {
  return state.nodes[state.nodeIndex];
}

export function advanceNode() {
  if (state.nodeIndex < state.nodes.length) {
    state.nodes[state.nodeIndex].done = true;
    state.nodeIndex++;
  }
}

export function isRunComplete() {
  return state.nodeIndex >= state.nodes.length;
}
