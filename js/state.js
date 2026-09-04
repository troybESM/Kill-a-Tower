// Global run state, shared across screens. A single mutable object.
import { makeStarterDeck } from './cards.js';

export const PLAYER_MAX_HP = 70;

export const state = {
  // Run-level
  maxHp: PLAYER_MAX_HP,
  hp: PLAYER_MAX_HP,
  gold: 0,
  relics: [],            // array of relic definition objects
  deck: [],              // array of card ids (the master deck)
  maxEnergy: 3,

  // Map
  nodes: [],             // array of node objects {type,label,index,done,current}
  nodeIndex: 0,

  // Combat-scoped (reset each fight, see combat.js initCombat)
  combat: null,
};

export function newRun() {
  state.maxHp = PLAYER_MAX_HP;
  state.hp = PLAYER_MAX_HP;
  state.gold = 0;
  state.relics = [];
  state.deck = makeStarterDeck();
  state.maxEnergy = 3;
  state.nodeIndex = 0;
  state.combat = null;
  buildMap();
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
