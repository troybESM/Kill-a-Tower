// Card definitions for The Silent (poison & slyness).
// Each card has: id, name, cost, type (attack|skill|power), target (enemy|self|none),
// art (emoji), effects[] (interpreted by combat engine), and a text() renderer.
//
// Optional CARD-LEVEL KEYWORD FLAGS (interpreted by combat.js, data-driven):
//   exhaust: true    on play the card goes to the exhaustPile (out of the deck
//                    for the rest of combat) instead of the discard pile.
//   retain: true     the card is NOT discarded from hand at end of turn.
//   innate: true     the card is guaranteed to be in the opening hand (it is
//                    moved to the top of the shuffled draw pile in initCombat).
//   upgraded: {...}   a partial card def that getCard(id,{upgraded:true}) /
//                    upgradeCard(id) merges over the base def (see below).
//
// Effect ops understood by the combat engine (see combat.js applyEffectList):
//   { op:'damage', amount }              deal attack damage to target (scaled by str/vuln/weak)
//   { op:'damageAll', amount }           damage ALL enemies
//   { op:'multiDamage', amount, hits }   deal `amount` damage `hits` times; each hit
//                                        recomputes str/vuln/weak scaling independently
//   { op:'block', amount }               gain block (scaled by dex)
//   { op:'blockPerCardPlayed', per }     gain `per` block per card played this turn (+dex)
//   { op:'poison', amount }              apply poison stacks to target
//   { op:'poisonAll', amount }           apply poison to ALL enemies
//   { op:'doublePoison' }                double the target's poison stacks
//   { op:'damagePerPoison', per }        deal `per` damage per poison stack on target (does not consume)
//   { op:'detonatePoison', mult }        deal (poison * mult) damage and REMOVE all target poison
//   { op:'weak', amount }                apply weak to target
//   { op:'weakAll', amount }             apply weak to ALL enemies
//   { op:'vulnerable', amount }          apply vulnerable to target
//   { op:'draw', amount }                draw cards
//   { op:'drawIf', cond, amount }        draw `amount` cards if `cond` holds
//   { op:'discardRandom', amount }       discard `amount` random cards from hand (seeded)
//   { op:'exhaustHand' }                 move the whole remaining hand to the exhaust pile
//   { op:'energy', amount }              gain energy this turn
//   { op:'gainStr', amount }             gain strength (self)
//   { op:'gainDex', amount }             gain dexterity (self)
//   { op:'power', power, amount }        activate a player power for the combat
//   { op:'if', cond, then:[...], else:[...] }  run `then` (or `else`) based on cond
//
// Condition objects (used by 'if' and 'drawIf'), all present keys must hold:
//   { poisoned:true }         target has > 0 poison
//   { targetHpBelow:N }       target hp < N
//   { targetHpBelowPct:P }    target hp / maxHp < P  (0..1)
//   { block:'>=N' }           player block comparison ('>=','<=','==','>','<')
//   { cardsPlayed:'>=N' }     cards played this turn comparison

export const CARD_DB = {
  // --- Starter attacks ---
  strike: {
    id: 'strike', name: 'Strike', cost: 1, type: 'attack', target: 'enemy', art: '🗡',
    effects: [{ op: 'damage', amount: 6 }],
    text: () => `Deal <b>6</b> damage.`,
    upgraded: { effects: [{ op: 'damage', amount: 9 }], text: () => `Deal <b>9</b> damage.` },
  },
  defend: {
    id: 'defend', name: 'Defend', cost: 1, type: 'skill', target: 'self', art: '🛡',
    effects: [{ op: 'block', amount: 5 }],
    text: () => `Gain <b class="kw-block">5</b> Block.`,
    upgraded: { effects: [{ op: 'block', amount: 8 }], text: () => `Gain <b class="kw-block">8</b> Block.` },
  },
  neutralize: {
    id: 'neutralize', name: 'Neutralize', cost: 0, type: 'attack', target: 'enemy', art: '🔪',
    effects: [{ op: 'damage', amount: 3 }, { op: 'weak', amount: 1 }],
    text: () => `Deal <b>3</b> damage. Apply <b>1</b> Weak.`,
    upgraded: {
      effects: [{ op: 'damage', amount: 4 }, { op: 'weak', amount: 2 }],
      text: () => `Deal <b>4</b> damage. Apply <b>2</b> Weak.`,
    },
  },
  // --- Poison core ---
  deadlyPoison: {
    id: 'deadlyPoison', name: 'Deadly Poison', cost: 1, type: 'skill', target: 'enemy', art: '🧪',
    effects: [{ op: 'poison', amount: 5 }],
    text: () => `Apply <b class="kw-poison">5</b> Poison.`,
    upgraded: { effects: [{ op: 'poison', amount: 7 }], text: () => `Apply <b class="kw-poison">7</b> Poison.` },
  },
  bouncingFlask: {
    id: 'bouncingFlask', name: 'Bouncing Flask', cost: 2, type: 'skill', target: 'none', art: '⚗',
    effects: [{ op: 'poisonAll', amount: 3 }],
    text: () => `Apply <b class="kw-poison">3</b> Poison to <b>ALL</b> enemies.`,
    upgraded: {
      effects: [{ op: 'poisonAll', amount: 4 }],
      text: () => `Apply <b class="kw-poison">4</b> Poison to <b>ALL</b> enemies.`,
    },
  },
  corpseExplosion: {
    id: 'corpseExplosion', name: 'Corpse Explosion', cost: 2, type: 'skill', target: 'enemy', art: '💥',
    effects: [{ op: 'poison', amount: 6 }],
    text: () => `Apply <b class="kw-poison">6</b> Poison.`,
    upgraded: { effects: [{ op: 'poison', amount: 9 }], text: () => `Apply <b class="kw-poison">9</b> Poison.` },
  },
  catalyst: {
    id: 'catalyst', name: 'Catalyst', cost: 1, type: 'skill', target: 'enemy', art: '☠',
    effects: [{ op: 'doublePoison' }],
    text: () => `<b>Double</b> the target's <b class="kw-poison">Poison</b>.`,
    upgraded: {
      cost: 1, exhaust: false,
      effects: [{ op: 'doublePoison' }, { op: 'poison', amount: 2 }],
      text: () => `<b>Double</b> the target's <b class="kw-poison">Poison</b>, then apply <b class="kw-poison">2</b>.`,
    },
  },
  // --- Poison PAYOFF (new) ---
  toxicPayoff: {
    id: 'toxicPayoff', name: 'Venom Lash', cost: 1, type: 'attack', target: 'enemy', art: '🐍',
    effects: [{ op: 'damagePerPoison', per: 2 }],
    text: () => `Deal <b>2</b> damage per <b class="kw-poison">Poison</b> on the target.`,
    upgraded: {
      effects: [{ op: 'damagePerPoison', per: 3 }],
      text: () => `Deal <b>3</b> damage per <b class="kw-poison">Poison</b> on the target.`,
    },
  },
  venomBurst: {
    id: 'venomBurst', name: 'Venom Burst', cost: 2, type: 'attack', target: 'enemy', art: '🧨', exhaust: true,
    effects: [{ op: 'detonatePoison', mult: 2 }],
    text: () => `<b>Detonate:</b> deal <b>2×</b> the target's <b class="kw-poison">Poison</b> as damage, then remove it. <b class="kw-exhaust">Exhaust</b>.`,
    upgraded: {
      effects: [{ op: 'detonatePoison', mult: 3 }],
      text: () => `<b>Detonate:</b> deal <b>3×</b> the target's <b class="kw-poison">Poison</b> as damage, then remove it. <b class="kw-exhaust">Exhaust</b>.`,
    },
  },
  // --- Conditional (new) ---
  envenomedEdge: {
    id: 'envenomedEdge', name: 'Envenomed Edge', cost: 1, type: 'attack', target: 'enemy', art: '🗡',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'if', cond: { poisoned: true }, then: [{ op: 'poison', amount: 4 }], else: [{ op: 'poison', amount: 2 }] },
    ],
    text: () => `Deal <b>5</b> damage. If the target is <b class="kw-poison">Poisoned</b>, apply <b class="kw-poison">4</b> Poison; otherwise apply <b class="kw-poison">2</b>.`,
    upgraded: {
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'if', cond: { poisoned: true }, then: [{ op: 'poison', amount: 6 }], else: [{ op: 'poison', amount: 3 }] },
      ],
      text: () => `Deal <b>7</b> damage. If the target is <b class="kw-poison">Poisoned</b>, apply <b class="kw-poison">6</b> Poison; otherwise apply <b class="kw-poison">3</b>.`,
    },
  },
  finisher: {
    id: 'finisher', name: 'Finisher', cost: 2, type: 'attack', target: 'enemy', art: '⚔',
    effects: [
      { op: 'if', cond: { targetHpBelowPct: 0.35 }, then: [{ op: 'damage', amount: 24 }], else: [{ op: 'damage', amount: 12 }] },
    ],
    text: () => `Deal <b>12</b> damage. If the target is below <b>35%</b> HP, deal <b>24</b> instead.`,
    upgraded: {
      effects: [
        { op: 'if', cond: { targetHpBelowPct: 0.5 }, then: [{ op: 'damage', amount: 30 }], else: [{ op: 'damage', amount: 15 }] },
      ],
      text: () => `Deal <b>15</b> damage. If the target is below <b>50%</b> HP, deal <b>30</b> instead.`,
    },
  },
  // --- Multi-hit (new) ---
  flurryOfKnives: {
    id: 'flurryOfKnives', name: 'Flurry of Knives', cost: 1, type: 'attack', target: 'enemy', art: '🔪',
    effects: [{ op: 'multiDamage', amount: 3, hits: 3 }],
    text: () => `Deal <b>3</b> damage <b>3</b> times.`,
    upgraded: {
      effects: [{ op: 'multiDamage', amount: 3, hits: 4 }],
      text: () => `Deal <b>3</b> damage <b>4</b> times.`,
    },
  },
  bladeDance: {
    id: 'bladeDance', name: 'Blade Dance', cost: 1, type: 'attack', target: 'enemy', art: '🌀',
    effects: [{ op: 'multiDamage', amount: 4, hits: 2 }],
    text: () => `Deal <b>4</b> damage <b>2</b> times.`,
    upgraded: {
      effects: [{ op: 'multiDamage', amount: 4, hits: 3 }],
      text: () => `Deal <b>4</b> damage <b>3</b> times.`,
    },
  },
  // --- Sly / agility ---
  survivor: {
    id: 'survivor', name: 'Survivor', cost: 1, type: 'skill', target: 'self', art: '🃏',
    effects: [{ op: 'block', amount: 8 }],
    text: () => `Gain <b class="kw-block">8</b> Block.`,
    upgraded: { effects: [{ op: 'block', amount: 12 }], text: () => `Gain <b class="kw-block">12</b> Block.` },
  },
  backstab: {
    id: 'backstab', name: 'Backstab', cost: 0, type: 'attack', target: 'enemy', art: '🩸', innate: true, exhaust: true,
    effects: [{ op: 'damage', amount: 11 }],
    text: () => `<b class="kw-innate">Innate.</b> Deal <b>11</b> damage. <b class="kw-exhaust">Exhaust</b>.`,
    upgraded: {
      effects: [{ op: 'damage', amount: 15 }],
      text: () => `<b class="kw-innate">Innate.</b> Deal <b>15</b> damage. <b class="kw-exhaust">Exhaust</b>.`,
    },
  },
  daggerThrow: {
    id: 'daggerThrow', name: 'Dagger Throw', cost: 1, type: 'attack', target: 'enemy', art: '🎯',
    effects: [{ op: 'damage', amount: 9 }, { op: 'draw', amount: 1 }],
    text: () => `Deal <b>9</b> damage. Draw <b>1</b> card.`,
    upgraded: {
      effects: [{ op: 'damage', amount: 12 }, { op: 'draw', amount: 1 }],
      text: () => `Deal <b>12</b> damage. Draw <b>1</b> card.`,
    },
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', cost: 0, type: 'skill', target: 'self', art: '⚡', exhaust: true,
    effects: [{ op: 'energy', amount: 2 }, { op: 'draw', amount: 2 }],
    text: () => `Gain <b>2</b> Energy. Draw <b>2</b> cards. <b class="kw-exhaust">Exhaust</b>.`,
    upgraded: {
      effects: [{ op: 'energy', amount: 3 }, { op: 'draw', amount: 2 }],
      text: () => `Gain <b>3</b> Energy. Draw <b>2</b> cards. <b class="kw-exhaust">Exhaust</b>.`,
    },
  },
  cloakAndDagger: {
    id: 'cloakAndDagger', name: 'Cloak & Dagger', cost: 1, type: 'skill', target: 'enemy', art: '🥷',
    effects: [{ op: 'block', amount: 6 }, { op: 'poison', amount: 2 }],
    text: () => `Gain <b class="kw-block">6</b> Block. Apply <b class="kw-poison">2</b> Poison.`,
    upgraded: {
      effects: [{ op: 'block', amount: 6 }, { op: 'poison', amount: 4 }],
      text: () => `Gain <b class="kw-block">6</b> Block. Apply <b class="kw-poison">4</b> Poison.`,
    },
  },
  preparation: {
    id: 'preparation', name: 'Preparation', cost: 0, type: 'skill', target: 'self', art: '📜', retain: true,
    effects: [{ op: 'draw', amount: 2 }, { op: 'discardRandom', amount: 1 }],
    text: () => `<b class="kw-retain">Retain.</b> Draw <b>2</b> cards, then discard <b>1</b> at random.`,
    upgraded: {
      retain: true,
      effects: [{ op: 'draw', amount: 2 }],
      text: () => `<b class="kw-retain">Retain.</b> Draw <b>2</b> cards.`,
    },
  },
  reflex: {
    id: 'reflex', name: 'Reflex', cost: 0, type: 'skill', target: 'self', art: '🌬', retain: true,
    effects: [{ op: 'drawIf', cond: { cardsPlayed: '>=1' }, amount: 2 }, { op: 'gainDex', amount: 1 }],
    text: () => `<b class="kw-retain">Retain.</b> Gain <b class="kw-block">1</b> Dexterity. If you've played a card this turn, draw <b>2</b>.`,
    upgraded: {
      retain: true,
      effects: [{ op: 'drawIf', cond: { cardsPlayed: '>=1' }, amount: 3 }, { op: 'gainDex', amount: 1 }],
      text: () => `<b class="kw-retain">Retain.</b> Gain <b class="kw-block">1</b> Dexterity. If you've played a card this turn, draw <b>3</b>.`,
    },
  },
  // --- Debuffs ---
  crippling: {
    id: 'crippling', name: 'Crippling Cloud', cost: 2, type: 'skill', target: 'none', art: '🌫',
    effects: [{ op: 'poisonAll', amount: 4 }, { op: 'weakAll', amount: 2 }],
    text: () => `Apply <b class="kw-poison">4</b> Poison and <b>2</b> Weak to <b>ALL</b> enemies.`,
    upgraded: {
      effects: [{ op: 'poisonAll', amount: 5 }, { op: 'weakAll', amount: 3 }],
      text: () => `Apply <b class="kw-poison">5</b> Poison and <b>3</b> Weak to <b>ALL</b> enemies.`,
    },
  },
  // --- Powers ---
  noxiousFumes: {
    id: 'noxiousFumes', name: 'Noxious Fumes', cost: 1, type: 'power', target: 'none', art: '☁',
    effects: [{ op: 'power', power: 'noxious', amount: 2 }],
    text: () => `<b>Power.</b> At the start of each turn, apply <b class="kw-poison">2</b> Poison to ALL enemies.`,
    upgraded: {
      effects: [{ op: 'power', power: 'noxious', amount: 3 }],
      text: () => `<b>Power.</b> At the start of each turn, apply <b class="kw-poison">3</b> Poison to ALL enemies.`,
    },
  },
  wraithForm: {
    id: 'wraithForm', name: 'Wraith Form', cost: 1, type: 'power', target: 'self', art: '👻',
    effects: [{ op: 'gainDex', amount: 3 }],
    text: () => `<b>Power.</b> Gain <b class="kw-block">3</b> Dexterity.`,
    upgraded: { effects: [{ op: 'gainDex', amount: 4 }], text: () => `<b>Power.</b> Gain <b class="kw-block">4</b> Dexterity.` },
  },
  weaken: {
    id: 'weaken', name: 'Weaken', cost: 1, type: 'skill', target: 'enemy', art: '📉',
    effects: [{ op: 'weak', amount: 2 }, { op: 'vulnerable', amount: 2 }],
    text: () => `Apply <b>2</b> Weak and <b>2</b> Vulnerable.`,
    upgraded: {
      effects: [{ op: 'weak', amount: 3 }, { op: 'vulnerable', amount: 3 }],
      text: () => `Apply <b>3</b> Weak and <b>3</b> Vulnerable.`,
    },
  },
};

// Allowed distinct-card-count window (spec .kiro/specs/browser-game/requirements.md
// Req 4.2/4.3). The game must fail to start (visible error, not a blank screen)
// if the count is outside this range — see validateCardDb() / assertCardDbValid().
export const CARD_COUNT_MIN = 15;
export const CARD_COUNT_MAX = 24;

// Validate the content set at load time. Returns an array of human-readable
// problems (empty === valid) so the caller can surface an on-screen error.
export function validateCardDb(db = CARD_DB) {
  const problems = [];
  const ids = Object.keys(db);
  const count = ids.length;
  if (count < CARD_COUNT_MIN || count > CARD_COUNT_MAX) {
    problems.push(`Card count ${count} is outside the allowed range ${CARD_COUNT_MIN}-${CARD_COUNT_MAX}.`);
  }
  const seen = new Set();
  for (const key of ids) {
    const card = db[key];
    if (!card || card.id !== key) problems.push(`Card "${key}" has a missing or mismatched id.`);
    if (seen.has(card?.id)) problems.push(`Duplicate card id "${card.id}".`);
    seen.add(card?.id);
    if (typeof card?.text !== 'function') problems.push(`Card "${key}" is missing a text() renderer.`);
  }
  return problems;
}

// Throw if the content set is invalid. Callers (main.js boot) catch this and
// render an on-screen error rather than a blank screen (spec Req 2.3/4.3).
export function assertCardDbValid() {
  const problems = validateCardDb();
  if (problems.length) {
    throw new Error('Invalid card content:\n- ' + problems.join('\n- '));
  }
}

// The Silent's starting deck (Slay the Spire-inspired):
// 5 Strike, 5 Defend, 1 Neutralize, 1 Deadly Poison. (12 cards — spec Req 4.1: 8-12.)
export function makeStarterDeck() {
  const deck = [];
  for (let i = 0; i < 5; i++) deck.push('strike');
  for (let i = 0; i < 5; i++) deck.push('defend');
  deck.push('neutralize');
  deck.push('deadlyPoison');
  return deck;
}

// Cards that can appear as combat rewards (everything but the basic starters).
export const REWARD_POOL = [
  'deadlyPoison', 'bouncingFlask', 'corpseExplosion', 'catalyst',
  'toxicPayoff', 'venomBurst', 'envenomedEdge', 'finisher',
  'flurryOfKnives', 'bladeDance',
  'survivor', 'backstab', 'daggerThrow', 'adrenaline', 'cloakAndDagger',
  'preparation', 'reflex', 'crippling', 'noxiousFumes', 'wraithForm', 'weaken',
];

// Resolve a card definition by id. Pass { upgraded:true } to get the upgraded
// variant: the base def merged with its `upgraded` block (a shallow override of
// effects/text/cost/flags). Upgrading is a pure operation — no map node is
// required, so this mechanism is available to the engine/tests today and can be
// wired to a future "campfire/upgrade" map node without engine changes.
export function getCard(id, opts) {
  const c = CARD_DB[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  if (opts && opts.upgraded && c.upgraded) {
    return { ...c, ...c.upgraded, id: c.id, name: c.name, upgraded: undefined, isUpgraded: true };
  }
  return c;
}

// Pure resolver: return the upgraded def for a card id (or the base def if the
// card has no upgraded variant). Never mutates CARD_DB.
export function upgradeCard(id) {
  return getCard(id, { upgraded: true });
}
