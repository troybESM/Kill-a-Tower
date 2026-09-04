// Enemy & boss definitions.
// Each enemy has a moveset. A move has:
//   name, intent (attack|block|buff|debuff), and effect(api) that applies it.
//   For attacks, include `damage` so the intent display + weak scaling work.
// pickMove(turn, self) returns the next move (simple pattern/rotation AI).

function move(name, intent, opts = {}) {
  return { name, intent, ...opts };
}

export const ENEMY_DB = {
  // ---- Regular enemies (fight nodes) ----
  cultist: {
    id: 'cultist', name: 'Cultist', sprite: '🧟', maxHp: 48,
    // Turn 1 buffs, then ramps damage with strength.
    moves: [
      move('Incantation', 'buff', { effect: (api) => api.selfGainStr(3), desc: 'Gains 3 Strength' }),
      move('Dark Strike', 'attack', { damage: 6 }),
    ],
    pickMove(turn) { return turn === 1 ? this.moves[0] : this.moves[1]; },
  },
  spider: {
    id: 'spider', name: 'Fang Spider', sprite: '🕷', maxHp: 40,
    // Alternates a bite and a web (weak) with an occasional big lunge.
    moves: [
      move('Bite', 'attack', { damage: 7 }),
      move('Web', 'debuff', { effect: (api) => api.applyWeakPlayer(1), desc: 'Applies 1 Weak' }),
      move('Lunge', 'attack', { damage: 10 }),
    ],
    pickMove(turn) {
      const cycle = [0, 1, 0, 2];
      return this.moves[cycle[(turn - 1) % cycle.length]];
    },
  },
  bruteGuard: {
    id: 'bruteGuard', name: 'Tower Guard', sprite: '👹', maxHp: 55,
    moves: [
      move('Shield Up', 'block', { block: 8, effect: (api) => api.selfGainBlock(8), desc: 'Gains 8 Block' }),
      move('Smash', 'attack', { damage: 11 }),
      move('Cleave', 'attack', { damage: 8 }),
    ],
    pickMove(turn) {
      const cycle = [2, 0, 1];
      return this.moves[cycle[(turn - 1) % cycle.length]];
    },
  },

  // ---- Bosses ----
  hexQueen: {
    id: 'hexQueen', name: 'The Hex Queen', sprite: '👑', maxHp: 120, isBoss: true,
    // A caster boss: debuffs you, then unleashes big hits; occasionally heals via block.
    moves: [
      move('Curse', 'debuff', { effect: (api) => { api.applyWeakPlayer(2); api.applyVulnPlayer(2); }, desc: 'Applies 2 Weak & 2 Vulnerable' }),
      move('Hex Bolt', 'attack', { damage: 14 }),
      move('Ward', 'block', { block: 14, effect: (api) => api.selfGainBlock(14), desc: 'Gains 14 Block' }),
      move('Doom', 'attack', { damage: 20 }),
    ],
    pickMove(turn) {
      // Telegraphs Doom every 4th turn.
      const cycle = [0, 1, 2, 3];
      return this.moves[cycle[(turn - 1) % cycle.length]];
    },
  },
  ironColossus: {
    id: 'ironColossus', name: 'The Iron Colossus', sprite: '🤖', maxHp: 140, isBoss: true,
    // A bruiser boss: gains strength, huge slams, and an armor phase.
    moves: [
      move('Overclock', 'buff', { effect: (api) => api.selfGainStr(2), desc: 'Gains 2 Strength' }),
      move('Piston Punch', 'attack', { damage: 12 }),
      move('Fortify', 'block', { block: 16, effect: (api) => api.selfGainBlock(16), desc: 'Gains 16 Block' }),
      move('Meteor Slam', 'attack', { damage: 22 }),
    ],
    pickMove(turn) {
      const cycle = [0, 1, 2, 1, 3];
      return this.moves[cycle[(turn - 1) % cycle.length]];
    },
  },
};

export function makeEnemyInstance(id) {
  const def = ENEMY_DB[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return {
    def,
    id: def.id,
    name: def.name,
    sprite: def.sprite,
    maxHp: def.maxHp,
    hp: def.maxHp,
    block: 0,
    isBoss: !!def.isBoss,
    statuses: { poison: 0, weak: 0, vulnerable: 0, str: 0 },
    turn: 0,
    intent: null,
    // bind pickMove to this instance's def
    pickMove(turn) { return def.pickMove.call(def, turn); },
  };
}

export function randomBossId() {
  const bosses = ['hexQueen', 'ironColossus'];
  return bosses[Math.floor(Math.random() * bosses.length)];
}

// Encounters for the two fight nodes (single-enemy for the vertical slice,
// with one dual-enemy possibility for variety).
export function encounterForFight(index) {
  if (index === 0) {
    const options = [['cultist'], ['spider']];
    return options[Math.floor(Math.random() * options.length)];
  }
  const options = [['bruteGuard'], ['spider', 'spider']];
  return options[Math.floor(Math.random() * options.length)];
}
