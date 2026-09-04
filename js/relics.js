// Relic definitions. One is granted at the "Starting Relic" node (player picks from 5 random).
// Relics hook into the combat engine via named triggers checked in combat.js:
//   onCombatStart(state)      -> called at the start of each combat
//   onTurnStart(state)        -> start of each player turn
//   onPlayCard(state, card)   -> when a card is played
//   modifiers: passive numeric flags read directly (e.g. bonusEnergy, startBlock)
//
// Keeping effects data-driven so the engine can interpret them.

export const RELIC_DB = {
  snakeRing: {
    id: 'snakeRing', name: 'Serpent Ring', emoji: '💍',
    desc: 'At the start of each combat, apply 3 Poison to a random enemy.',
    hooks: { onCombatStart: (S, api) => api.poisonRandomEnemy(3) },
  },
  toxicVial: {
    id: 'toxicVial', name: 'Toxic Vial', emoji: '🧫',
    desc: 'Whenever you apply Poison, apply 1 additional Poison.',
    passive: { poisonBonus: 1 },
  },
  wingedBoots: {
    id: 'wingedBoots', name: 'Winged Boots', emoji: '🥾',
    desc: 'At the start of each turn, gain 1 additional card draw (draw 6 instead of 5).',
    passive: { bonusDraw: 1 },
  },
  brokenHourglass: {
    id: 'brokenHourglass', name: 'Broken Hourglass', emoji: '⏳',
    desc: 'The first card you play each turn costs 1 less Energy (min 0).',
    passive: { firstCardDiscount: 1 },
  },
  bloodChalice: {
    id: 'bloodChalice', name: 'Blood Chalice', emoji: '🍷',
    desc: 'Start each combat with 6 Block.',
    hooks: { onCombatStart: (S, api) => api.gainBlock(6) },
  },
  crookedCoin: {
    id: 'crookedCoin', name: 'Crooked Coin', emoji: '🪙',
    desc: 'Start each combat by drawing 1 extra card and gaining 1 Energy on turn 1.',
    hooks: { onFirstTurn: (S, api) => { api.gainEnergy(1); api.draw(1); } },
  },
  venomFang: {
    id: 'venomFang', name: 'Venom Fang', emoji: '🦷',
    desc: 'Gain 1 Dexterity at the start of each combat.',
    hooks: { onCombatStart: (S, api) => api.gainDex(1) },
  },
};

// Return `count` random distinct relics for the starting-relic choice.
// Uses a seeded RNG (the run-level state.rng) for reproducibility.
export function randomRelicChoices(rng, count = 5) {
  const ids = Object.keys(RELIC_DB);
  const shuffled = rng.shuffle(ids);
  return shuffled.slice(0, count).map((id) => RELIC_DB[id]);
}

export function getRelic(id) {
  return RELIC_DB[id];
}
