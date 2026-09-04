// Combat engine for Kill a Tower.
// UI-agnostic: it mutates state.combat and calls the provided `hooks` callbacks
// so the renderer can animate/redraw. Returns control via those callbacks.
import { state, combatRng } from './state.js';
import { getCard } from './cards.js';
import { makeEnemyInstance } from './enemies.js';

// Passive relic modifiers, summed across owned relics.
function relicPassive(key) {
  let total = 0;
  for (const r of state.relics) {
    if (r.passive && typeof r.passive[key] === 'number') total += r.passive[key];
  }
  return total;
}

// ---- combat lifecycle ----
export function initCombat(enemyIds, isBoss = false) {
  // Per-combat deterministic RNG derived from the run seed + this node index,
  // so a fight is reproducible given a fixed run seed.
  const rng = combatRng(state.nodeIndex);
  const c = {
    isBoss,
    rng,
    energy: state.maxEnergy,
    block: 0,
    statuses: { str: 0, dex: 0, weak: 0, vulnerable: 0 },
    powers: { noxious: 0 },       // player powers active this combat
    enemies: enemyIds.map(makeEnemyInstance),
    drawPile: rng.shuffle(state.deck),
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 0,
    firstCardPlayedThisTurn: false,
    cardsPlayedThisTurn: 0,       // used by conditional ops
    over: false,
    result: null,                 // 'win' | 'lose'
    log: [],
  };
  state.combat = c;
  // Innate cards start on top of the draw pile so they are drawn first turn.
  // (Data-driven: any card def flagged { innate:true }.)
  moveInnateToTop(c);
  return c;
}

// Reorder the draw pile so innate cards end up at the top (drawn first).
// drawPile is drawn from the END (pop), so "top" == end of the array.
function moveInnateToTop(c) {
  const innate = [];
  const rest = [];
  for (const id of c.drawPile) {
    (getCard(id).innate ? innate : rest).push(id);
  }
  // rest first, innate last -> innate popped first.
  c.drawPile = rest.concat(innate);
}

// Build the api object that relics/enemies use to affect combat.
function makeApi(events) {
  const c = state.combat;
  return {
    // player-side
    gainBlock: (n) => { c.block += Math.max(0, n); events.onPlayerBlock?.(n); },
    gainEnergy: (n) => { c.energy += n; },
    gainDex: (n) => { c.statuses.dex += n; },
    gainStr: (n) => { c.statuses.str += n; },
    draw: (n) => drawCards(n, events),
    poisonRandomEnemy: (n) => {
      const alive = c.enemies.filter((e) => e.hp > 0);
      if (!alive.length) return;
      const e = c.rng.pick(alive);
      applyPoison(e, n, events);
    },
    // enemy-side (act on the player)
    applyWeakPlayer: (n) => { c.statuses.weak += n; events.onPlayerDebuff?.('Weak', n); },
    applyVulnPlayer: (n) => { c.statuses.vulnerable += n; events.onPlayerDebuff?.('Vulnerable', n); },
    // enemy self-buffs — bound to a specific enemy via api.forEnemy
    _enemy: null,
    selfGainStr(n) { this._enemy.statuses.str += n; },
    selfGainBlock(n) { this._enemy.block += n; },
    forEnemy(e) { this._enemy = e; return this; },
  };
}

export function startCombatHooks(events) {
  const c = state.combat;
  const api = makeApi(events);
  // Relic onCombatStart hooks
  for (const r of state.relics) {
    r.hooks?.onCombatStart?.(state, api);
  }
  startPlayerTurn(events, true);
}

// ---- damage / status math ----
function playerAttackDamage(base, targetEnemy) {
  const c = state.combat;
  let dmg = base + c.statuses.str;
  if (c.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);         // we are weakened -> 25% less
  if (targetEnemy.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5); // target vulnerable -> +50%
  return Math.max(0, dmg);
}

function enemyAttackDamage(enemy, base) {
  const c = state.combat;
  let dmg = base + enemy.statuses.str;
  if (enemy.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);     // enemy weakened
  if (c.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);    // player vulnerable
  return Math.max(0, dmg);
}

function dealDamageToEnemy(enemy, amount, events) {
  if (enemy.hp <= 0) return;
  let remaining = amount;
  if (enemy.block > 0) {
    const absorbed = Math.min(enemy.block, remaining);
    enemy.block -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    enemy.hp = Math.max(0, enemy.hp - remaining);
    events.onEnemyDamaged?.(enemy, remaining);
  }
  if (enemy.hp <= 0) events.onEnemyDied?.(enemy);
}

function dealDamageToPlayer(amount, events) {
  const c = state.combat;
  let remaining = amount;
  if (c.block > 0) {
    const absorbed = Math.min(c.block, remaining);
    c.block -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    state.hp = Math.max(0, state.hp - remaining);
    events.onPlayerDamaged?.(remaining);
  }
}

function applyPoison(enemy, stacks, events) {
  if (enemy.hp <= 0) return;
  const bonus = relicPassive('poisonBonus');
  const total = stacks + (stacks > 0 ? bonus : 0);
  enemy.statuses.poison += total;
  events.onEnemyPoisoned?.(enemy, total);
}

// ---- piles ----
function drawCards(n, events) {
  const c = state.combat;
  for (let i = 0; i < n; i++) {
    if (c.drawPile.length === 0) {
      if (c.discardPile.length === 0) break;
      c.drawPile = c.rng.shuffle(c.discardPile);
      c.discardPile = [];
    }
    const id = c.drawPile.pop();
    c.hand.push(id);
  }
  events.onHandChanged?.();
}

// ---- turn flow ----
export function startPlayerTurn(events, isFirst = false) {
  const c = state.combat;
  c.turn++;
  c.block = 0;                 // block resets (Silent has no barricade in slice)
  c.energy = state.maxEnergy + relicPassive('bonusEnergy');
  c.firstCardPlayedThisTurn = false;
  c.cardsPlayedThisTurn = 0;

  const api = makeApi(events);

  // Player powers: Noxious Fumes applies poison to all enemies each turn.
  if (c.powers.noxious > 0) {
    for (const e of c.enemies) applyPoison(e, c.powers.noxious, events);
  }

  // First-turn relic hooks (e.g. Crooked Coin)
  if (isFirst) {
    for (const r of state.relics) r.hooks?.onFirstTurn?.(state, api);
  }

  // Draw hand (5 + relic bonus)
  const drawCount = 5 + relicPassive('bonusDraw');
  drawCards(drawCount, events);

  // Set enemy intents for this round
  for (const e of c.enemies) {
    if (e.hp > 0) {
      e.turn++;
      e.intent = e.pickMove(e.turn);
    }
  }

  events.onTurnStart?.();
  events.render?.();
}

export function canPlayCard(cardId) {
  const c = state.combat;
  const card = getCard(cardId);
  return effectiveCost(card) <= c.energy;
}

function effectiveCost(card) {
  const c = state.combat;
  let cost = card.cost;
  if (!c.firstCardPlayedThisTurn) {
    cost = Math.max(0, cost - relicPassive('firstCardDiscount'));
  }
  return cost;
}

// Play a card from hand at index, targeting enemy instance `target` (or null).
export function playCard(handIndex, target, events) {
  const c = state.combat;
  if (c.over) return false;
  const cardId = c.hand[handIndex];
  const card = getCard(cardId);
  const cost = effectiveCost(card);
  if (cost > c.energy) return false;

  c.energy -= cost;
  c.firstCardPlayedThisTurn = true;
  c.cardsPlayedThisTurn++;

  // remove from hand
  c.hand.splice(handIndex, 1);

  applyEffects(card, target, events);

  // Where does the card go after being played?
  //   exhaust:true -> exhaustPile (removed from the deck for the rest of combat)
  //   type 'power' -> stays "in play" (neither discard nor hand)
  //   otherwise    -> discard
  if (card.exhaust) {
    c.exhaustPile.push(cardId);
    events.onCardExhausted?.(card);
  } else if (card.type !== 'power') {
    c.discardPile.push(cardId);
  }

  events.onHandChanged?.();
  checkCombatEnd(events);
  events.render?.();
  return true;
}

function applyEffects(card, target, events) {
  const c = state.combat;
  const api = makeApi(events);
  applyEffectList(card.effects, target, api, events);
}

// Interpret an ordered list of effect ops. Extracted so conditional ops
// ({op:'if'}) can recurse into their `then`/`else` branches with the same
// target/api/events context. All ops are data-driven — no per-card logic.
function applyEffectList(effects, target, api, events) {
  const c = state.combat;
  for (const eff of effects) {
    switch (eff.op) {
      case 'damage':
        if (target) dealDamageToEnemy(target, playerAttackDamage(eff.amount, target), events);
        break;
      case 'damageAll':
        for (const e of c.enemies) if (e.hp > 0) dealDamageToEnemy(e, playerAttackDamage(eff.amount, e), events);
        break;
      case 'multiDamage': {
        // Deal `amount` damage `hits` times. Damage is recomputed per hit so
        // strength / vulnerable / weak scale each individual hit.
        if (target) {
          const hits = eff.hits || 1;
          for (let i = 0; i < hits; i++) {
            if (target.hp <= 0) break;
            dealDamageToEnemy(target, playerAttackDamage(eff.amount, target), events);
          }
          events.onMultiHit?.(target, hits);
        }
        break;
      }
      case 'block':
        api.gainBlock(eff.amount + c.statuses.dex);
        break;
      case 'blockPerCardPlayed':
        // Gain `per` block for each card already played this turn (this card
        // counts as played by the time effects resolve).
        api.gainBlock((eff.per || 1) * c.cardsPlayedThisTurn + c.statuses.dex);
        break;
      case 'poison':
        if (target) applyPoison(target, eff.amount, events);
        break;
      case 'poisonAll':
        for (const e of c.enemies) if (e.hp > 0) applyPoison(e, eff.amount, events);
        break;
      case 'doublePoison':
        if (target) { const add = target.statuses.poison; applyPoison(target, add, events); }
        break;
      case 'damagePerPoison': {
        // Deal `per` damage for each poison stack on the target. Does NOT
        // consume the poison. Scales with str/vuln/weak like normal attacks.
        // BLOCK INTERACTION (intended): this is an ATTACK-style payoff. It
        // routes through dealDamageToEnemy and IS ABSORBED by enemy block, and
        // is additionally scaled by playerAttackDamage (str/vuln/weak). This is
        // deliberately DIFFERENT from the poison damage-over-time tick
        // (tickPoison), which subtracts straight from hp and IGNORES block.
        if (target && target.statuses.poison > 0) {
          const base = (eff.per || 1) * target.statuses.poison;
          dealDamageToEnemy(target, playerAttackDamage(base, target), events);
        }
        break;
      }
      case 'detonatePoison': {
        // Deal damage equal to the target's poison stacks (times optional
        // `mult`) then REMOVE all poison from the target.
        // BLOCK INTERACTION (intended): detonation is an ATTACK-style payoff.
        // It routes through dealDamageToEnemy and IS ABSORBED by enemy block
        // (the raw poison total is not scaled by str/vuln/weak, but block still
        // applies). This is deliberately DIFFERENT from the poison
        // damage-over-time tick (tickPoison), which subtracts straight from hp
        // and IGNORES block. Payoff attacks respect block; the DoT tick does not.
        if (target && target.statuses.poison > 0) {
          const dmg = target.statuses.poison * (eff.mult || 1);
          target.statuses.poison = 0;
          dealDamageToEnemy(target, dmg, events);
          events.onDetonate?.(target, dmg);
        }
        break;
      }
      case 'weak':
        if (target) { target.statuses.weak += eff.amount; events.onEnemyDebuff?.(target, 'Weak', eff.amount); }
        break;
      case 'weakAll':
        for (const e of c.enemies) if (e.hp > 0) { e.statuses.weak += eff.amount; events.onEnemyDebuff?.(e, 'Weak', eff.amount); }
        break;
      case 'vulnerable':
        if (target) { target.statuses.vulnerable += eff.amount; events.onEnemyDebuff?.(target, 'Vulnerable', eff.amount); }
        break;
      case 'draw':
        drawCards(eff.amount, events);
        break;
      case 'drawIf':
        if (evalCond(eff.cond, target)) drawCards(eff.amount, events);
        break;
      case 'discardRandom': {
        // Discard up to `amount` random cards from hand (using the combat RNG
        // so it stays deterministic).
        let n = eff.amount || 1;
        while (n-- > 0 && c.hand.length > 0) {
          const idx = c.rng.int(c.hand.length);
          const [id] = c.hand.splice(idx, 1);
          c.discardPile.push(id);
        }
        events.onHandChanged?.();
        break;
      }
      case 'exhaustHand': {
        // Move the entire remaining hand to the exhaust pile.
        while (c.hand.length > 0) {
          const id = c.hand.pop();
          c.exhaustPile.push(id);
          events.onCardExhausted?.(getCard(id));
        }
        events.onHandChanged?.();
        break;
      }
      case 'if':
        // Conditional: evaluate cond against the current target/combat and
        // run the matching branch of effects.
        if (evalCond(eff.cond, target)) {
          if (eff.then) applyEffectList(eff.then, target, api, events);
        } else if (eff.else) {
          applyEffectList(eff.else, target, api, events);
        }
        break;
      case 'energy':
        c.energy += eff.amount;
        break;
      case 'gainStr':
        c.statuses.str += eff.amount;
        break;
      case 'gainDex':
        c.statuses.dex += eff.amount;
        break;
      case 'power':
        c.powers[eff.power] = (c.powers[eff.power] || 0) + eff.amount;
        break;
      default:
        console.warn('Unknown effect op', eff.op);
    }
  }
}

// Evaluate a condition object against the current target / combat state.
// Supported shapes (all optional; all present keys must be true):
//   { poisoned: true }        -> target has >0 poison
//   { targetHpBelow: N }      -> target hp < N
//   { targetHpBelowPct: P }   -> target hp/maxHp < P (0..1)
//   { block: '>=N' | '>N' }   -> player block comparison
//   { cardsPlayed: '>=N' }    -> cards played this turn comparison
function evalCond(cond, target) {
  const c = state.combat;
  if (!cond) return true;
  if (cond.poisoned && !(target && target.statuses.poison > 0)) return false;
  if (typeof cond.targetHpBelow === 'number' && !(target && target.hp < cond.targetHpBelow)) return false;
  if (typeof cond.targetHpBelowPct === 'number' &&
      !(target && (target.hp / target.maxHp) < cond.targetHpBelowPct)) return false;
  if (cond.block != null && !cmp(c.block, cond.block)) return false;
  if (cond.cardsPlayed != null && !cmp(c.cardsPlayedThisTurn, cond.cardsPlayed)) return false;
  return true;
}

// Compare a numeric value against a string expression like '>=3', '>2', '<5', '==1'.
function cmp(value, expr) {
  const m = String(expr).match(/^\s*(>=|<=|==|>|<)?\s*(-?\d+)\s*$/);
  if (!m) return false;
  const op = m[1] || '>=';
  const n = Number(m[2]);
  switch (op) {
    case '>=': return value >= n;
    case '<=': return value <= n;
    case '==': return value === n;
    case '>': return value > n;
    case '<': return value < n;
    default: return false;
  }
}

// End the player's turn: discard hand, tick poison, run enemy turns, then start next.
export function endTurn(events) {
  const c = state.combat;
  if (c.over) return;

  // discard hand, except cards flagged { retain:true } which stay in hand.
  const retained = [];
  for (const id of c.hand) {
    if (getCard(id).retain) retained.push(id);
    else c.discardPile.push(id);
  }
  c.hand = retained;
  events.onHandChanged?.();

  // Poison ticks on enemies at end of player's turn
  tickPoison(events);
  checkCombatEnd(events);
  if (c.over) { events.render?.(); return; }

  // Enemy phase resolves synchronously. The UI layer decides whether to
  // animate the resulting steps; the engine state is always up to date.
  runEnemyTurns(events);
  if (c.over) { events.render?.(); return; }

  // decrement player debuffs at end of round
  if (c.statuses.weak > 0) c.statuses.weak--;
  if (c.statuses.vulnerable > 0) c.statuses.vulnerable--;
  startPlayerTurn(events);
}

function tickPoison(events) {
  const c = state.combat;
  for (const e of c.enemies) {
    if (e.hp > 0 && e.statuses.poison > 0) {
      const dmg = e.statuses.poison;
      e.hp = Math.max(0, e.hp - dmg);          // poison ignores block
      events.onEnemyPoisonTick?.(e, dmg);
      e.statuses.poison = Math.max(0, e.statuses.poison - 1); // -1 stack per turn
      if (e.hp <= 0) events.onEnemyDied?.(e);
    }
  }
}

// Resolve each living enemy's move synchronously (no timers in the engine).
function runEnemyTurns(events) {
  const c = state.combat;
  const living = c.enemies.filter((e) => e.hp > 0);
  for (const e of living) {
    if (c.over) return;
    if (e.hp <= 0) continue;
    resolveEnemyMove(e, events);
    checkCombatEnd(events);
    if (c.over) return;
    // decrement this enemy's weak after acting
    if (e.statuses.weak > 0) e.statuses.weak--;
  }
}

function resolveEnemyMove(enemy, events) {
  const c = state.combat;
  const move = enemy.intent || enemy.pickMove(enemy.turn);
  enemy.block = 0; // enemy block decays at start of its turn
  const api = makeApi(events).forEnemy(enemy);

  events.onEnemyAct?.(enemy, move);

  if (move.intent === 'attack' && typeof move.damage === 'number') {
    const dmg = enemyAttackDamage(enemy, move.damage);
    dealDamageToPlayer(dmg, events);
  }
  if (typeof move.effect === 'function') {
    move.effect(api);
  }
}

function checkCombatEnd(events) {
  const c = state.combat;
  if (c.over) return;
  if (state.hp <= 0) {
    c.over = true; c.result = 'lose';
    events.onCombatEnd?.('lose');
    return;
  }
  if (c.enemies.every((e) => e.hp <= 0)) {
    c.over = true; c.result = 'win';
    events.onCombatEnd?.('win');
  }
}

// expose for renderer
export { effectiveCost };
