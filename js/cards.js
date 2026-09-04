// Card definitions for The Silent (poison & slyness).
// Each card has: id, name, cost, type (attack|skill|power), target (enemy|self|none),
// art (emoji), effects[] (interpreted by combat engine), and a text() renderer.
//
// Effect ops understood by the combat engine (see combat.js applyEffects):
//   { op:'damage', amount }              deal attack damage to target (scaled by str/vuln/weak)
//   { op:'block', amount }               gain block (scaled by dex)
//   { op:'poison', amount }              apply poison stacks to target
//   { op:'weak', amount }                apply weak to target
//   { op:'vulnerable', amount }          apply vulnerable to target
//   { op:'draw', amount }                draw cards
//   { op:'energy', amount }              gain energy this turn
//   { op:'gainStr', amount }             gain strength (self)
//   { op:'gainDex', amount }             gain dexterity (self)
//   { op:'poisonAll', amount }           apply poison to ALL enemies
//   { op:'damageAll', amount }           damage ALL enemies
//   { op:'doublePoison' }                double target's poison stacks
//   { op:'hitsPerPoison', dmgPer }       (special handled inline) not used yet

export const CARD_DB = {
  // --- Starter attacks ---
  strike: {
    id: 'strike', name: 'Strike', cost: 1, type: 'attack', target: 'enemy', art: '🗡',
    effects: [{ op: 'damage', amount: 6 }],
    text: () => `Deal <b>6</b> damage.`,
  },
  defend: {
    id: 'defend', name: 'Defend', cost: 1, type: 'skill', target: 'self', art: '🛡',
    effects: [{ op: 'block', amount: 5 }],
    text: () => `Gain <b class="kw-block">5</b> Block.`,
  },
  neutralize: {
    id: 'neutralize', name: 'Neutralize', cost: 0, type: 'attack', target: 'enemy', art: '🔪',
    effects: [{ op: 'damage', amount: 3 }, { op: 'weak', amount: 1 }],
    text: () => `Deal <b>3</b> damage. Apply <b>1</b> Weak.`,
  },
  // --- Poison core ---
  deadlyPoison: {
    id: 'deadlyPoison', name: 'Deadly Poison', cost: 1, type: 'skill', target: 'enemy', art: '🧪',
    effects: [{ op: 'poison', amount: 5 }],
    text: () => `Apply <b class="kw-poison">5</b> Poison.`,
  },
  bouncingFlask: {
    id: 'bouncingFlask', name: 'Bouncing Flask', cost: 2, type: 'skill', target: 'none', art: '⚗',
    effects: [{ op: 'poisonAll', amount: 3 }],
    text: () => `Apply <b class="kw-poison">3</b> Poison to <b>ALL</b> enemies.`,
  },
  corpseExplosion: {
    id: 'corpseExplosion', name: 'Corpse Explosion', cost: 2, type: 'skill', target: 'enemy', art: '💥',
    effects: [{ op: 'poison', amount: 6 }],
    text: () => `Apply <b class="kw-poison">6</b> Poison.`,
  },
  catalyst: {
    id: 'catalyst', name: 'Catalyst', cost: 1, type: 'skill', target: 'enemy', art: '☠',
    effects: [{ op: 'doublePoison' }],
    text: () => `<b>Double</b> the target's <b class="kw-poison">Poison</b>.`,
  },
  // --- Sly / agility ---
  survivor: {
    id: 'survivor', name: 'Survivor', cost: 1, type: 'skill', target: 'self', art: '🃏',
    effects: [{ op: 'block', amount: 8 }],
    text: () => `Gain <b class="kw-block">8</b> Block.`,
  },
  backstab: {
    id: 'backstab', name: 'Backstab', cost: 1, type: 'attack', target: 'enemy', art: '🩸',
    effects: [{ op: 'damage', amount: 11 }],
    text: () => `Deal <b>11</b> damage.`,
  },
  daggerThrow: {
    id: 'daggerThrow', name: 'Dagger Throw', cost: 1, type: 'attack', target: 'enemy', art: '🎯',
    effects: [{ op: 'damage', amount: 9 }, { op: 'draw', amount: 1 }],
    text: () => `Deal <b>9</b> damage. Draw <b>1</b> card.`,
  },
  bladeDance: {
    id: 'bladeDance', name: 'Blade Dance', cost: 1, type: 'attack', target: 'enemy', art: '🌀',
    effects: [{ op: 'damage', amount: 4 }, { op: 'damage', amount: 4 }],
    text: () => `Deal <b>4</b> damage twice.`,
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', cost: 0, type: 'skill', target: 'self', art: '⚡',
    effects: [{ op: 'energy', amount: 2 }, { op: 'draw', amount: 2 }],
    text: () => `Gain <b>2</b> Energy. Draw <b>2</b> cards.`,
  },
  cloakAndDagger: {
    id: 'cloakAndDagger', name: 'Cloak & Dagger', cost: 1, type: 'skill', target: 'enemy', art: '🥷',
    effects: [{ op: 'block', amount: 6 }, { op: 'poison', amount: 2 }],
    text: () => `Gain <b class="kw-block">6</b> Block. Apply <b class="kw-poison">2</b> Poison.`,
  },
  // --- Debuffs ---
  crippling: {
    id: 'crippling', name: 'Crippling Cloud', cost: 2, type: 'skill', target: 'none', art: '🌫',
    effects: [{ op: 'poisonAll', amount: 4 }, { op: 'weakAll', amount: 2 }],
    text: () => `Apply <b class="kw-poison">4</b> Poison and <b>2</b> Weak to <b>ALL</b> enemies.`,
  },
  // --- Powers ---
  noxiousFumes: {
    id: 'noxiousFumes', name: 'Noxious Fumes', cost: 1, type: 'power', target: 'none', art: '☁',
    effects: [{ op: 'power', power: 'noxious', amount: 2 }],
    text: () => `<b>Power.</b> At the start of each turn, apply <b class="kw-poison">2</b> Poison to ALL enemies.`,
  },
  wraithForm: {
    id: 'wraithForm', name: 'Wraith Form', cost: 1, type: 'power', target: 'self', art: '👻',
    effects: [{ op: 'gainDex', amount: 3 }],
    text: () => `<b>Power.</b> Gain <b class="kw-block">3</b> Dexterity.`,
  },
  weaken: {
    id: 'weaken', name: 'Weaken', cost: 1, type: 'skill', target: 'enemy', art: '📉',
    effects: [{ op: 'weak', amount: 2 }, { op: 'vulnerable', amount: 2 }],
    text: () => `Apply <b>2</b> Weak and <b>2</b> Vulnerable.`,
  },
};

// The Silent's starting deck (Slay the Spire-inspired):
// 5 Strike, 5 Defend, 1 Neutralize, 1 Deadly Poison.
export function makeStarterDeck() {
  const deck = [];
  for (let i = 0; i < 5; i++) deck.push('strike');
  for (let i = 0; i < 5; i++) deck.push('defend');
  deck.push('neutralize');
  deck.push('deadlyPoison');
  return deck;
}

// Cards that can appear as combat rewards.
export const REWARD_POOL = [
  'deadlyPoison', 'bouncingFlask', 'corpseExplosion', 'catalyst',
  'survivor', 'backstab', 'daggerThrow', 'bladeDance', 'adrenaline',
  'cloakAndDagger', 'crippling', 'noxiousFumes', 'wraithForm', 'weaken',
];

export function getCard(id) {
  const c = CARD_DB[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}
