// UI / renderer + screen flow for Kill a Tower.
import { state, newRun, currentNode, advanceNode } from './state.js';
import { getCard, REWARD_POOL } from './cards.js';
import { randomRelicChoices } from './relics.js';
import { randomBossId, encounterForFight } from './enemies.js';
import * as Combat from './combat.js';

// ---------- tiny DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1600);
}

function floatText(anchorEl, text, kind) {
  if (!anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const f = el('div', `float-text ft-${kind}`, text);
  f.style.left = rect.left + rect.width / 2 - 12 + 'px';
  f.style.top = rect.top + 20 + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

// ---------- combat interaction state ----------
let selectedHandIndex = null; // card awaiting a target

// ================= MAP =================
export function renderMap() {
  showScreen('map-screen');
  $('#map-hp').textContent = state.hp;
  $('#map-maxhp').textContent = state.maxHp;
  $('#map-gold').textContent = state.gold;
  $('#deck-count').textContent = state.deck.length;
  renderRelicTray($('#map-relics'));

  const track = $('#map-track');
  track.innerHTML = '';
  state.nodes.forEach((node, i) => {
    if (i > 0) {
      const conn = el('div', 'map-connector' + (state.nodes[i - 1].done ? ' done' : ''));
      track.appendChild(conn);
    }
    const isCurrent = i === state.nodeIndex;
    const cls = 'map-node ' + (node.done ? 'done' : isCurrent ? 'current' : 'locked');
    const n = el('div', cls, `
      <div class="node-icon">${node.icon}</div>
      <div class="node-title">${node.label}</div>
      <div class="node-desc">${node.desc}</div>
    `);
    if (isCurrent) {
      const badge = el('div', 'badge', node.type === 'boss' ? 'BOSS' : node.type === 'relic' ? 'PICK' : 'GO');
      n.appendChild(badge);
      n.addEventListener('click', () => enterNode(node));
    }
    track.appendChild(n);
  });
}

function enterNode(node) {
  if (node.type === 'relic') {
    renderRelicChoice();
  } else if (node.type === 'fight') {
    startFight(node.fightIndex, false);
  } else if (node.type === 'boss') {
    startFight(null, true);
  }
}

function renderRelicTray(container) {
  container.innerHTML = '';
  for (const r of state.relics) {
    const chip = el('div', 'relic-chip', `${r.emoji}<div class="tip"><b>${r.name}</b><br>${r.desc}</div>`);
    container.appendChild(chip);
  }
}

// ================= RELIC CHOICE =================
function renderRelicChoice() {
  showScreen('relic-screen');
  const wrap = $('#relic-choices');
  wrap.innerHTML = '';
  const choices = randomRelicChoices(5);
  for (const r of choices) {
    const card = el('div', 'relic-card', `
      <div class="relic-emoji">${r.emoji}</div>
      <div class="relic-name">${r.name}</div>
      <div class="relic-desc">${r.desc}</div>
    `);
    card.addEventListener('click', () => {
      state.relics.push(r);
      toast(`Gained ${r.name}!`);
      advanceNode();
      renderMap();
    });
    wrap.appendChild(card);
  }
}

// ================= COMBAT =================
let combatEvents = null;

function startFight(fightIndex, isBoss) {
  let enemyIds;
  if (isBoss) enemyIds = [randomBossId()];
  else enemyIds = encounterForFight(fightIndex);

  Combat.initCombat(enemyIds, isBoss);
  showScreen('combat-screen');
  selectedHandIndex = null;

  combatEvents = buildCombatEvents();
  Combat.startCombatHooks(combatEvents);
  renderCombat();
}

function buildCombatEvents() {
  return {
    render: renderCombat,
    onHandChanged: () => renderHand(),
    onEnemyDamaged: (enemy) => flashEnemy(enemy),
    onEnemyPoisonTick: (enemy, dmg) => { flashEnemy(enemy); floatEnemy(enemy, `-${dmg}`, 'poison'); },
    onEnemyPoisoned: (enemy, n) => floatEnemy(enemy, `+${n}☠`, 'poison'),
    onEnemyDebuff: (enemy, name, n) => floatEnemy(enemy, `${name} ${n}`, 'poison'),
    onEnemyDied: (enemy) => floatEnemy(enemy, 'DEAD', 'poison'),
    onPlayerDamaged: (n) => { floatPlayer(`-${n}`, 'damage'); shakePlayer(); },
    onPlayerBlock: (n) => floatPlayer(`+${n}🛡`, 'block'),
    onPlayerDebuff: (name, n) => floatPlayer(`${name} ${n}`, 'damage'),
    onEnemyAct: (enemy, move) => toast(`${enemy.name}: ${move.name}`),
    onCombatEnd: (result) => { pendingResult = result; },
  };
}

// The engine resolves the enemy phase synchronously; we gate the player's
// End Turn button behind a short "enemy turn" pause so the floating combat
// text and toasts remain readable, then hand control back.
let pendingResult = null;
let resolvingEnemyTurn = false;

function doEndTurn() {
  const c = state.combat;
  if (!c || c.over || resolvingEnemyTurn) return;
  selectedHandIndex = null;
  resolvingEnemyTurn = true;
  pendingResult = null;
  $('#end-turn-btn').disabled = true;
  toast('Enemy turn…');
  // brief beat so end-of-turn poison ticks are visible before enemies act
  setTimeout(() => {
    Combat.endTurn(combatEvents);
    renderCombat();
    resolvingEnemyTurn = false;
    if (pendingResult) {
      const r = pendingResult; pendingResult = null;
      setTimeout(() => endCombat(r), 700);
    }
  }, 450);
}

function renderCombat() {
  const c = state.combat;
  if (!c) return;
  $('#combat-hp').textContent = state.hp;
  $('#combat-maxhp').textContent = state.maxHp;
  $('#combat-energy').textContent = c.energy;
  $('#combat-maxenergy').textContent = state.maxEnergy;
  renderRelicTray($('#combat-relics'));
  renderEnemies();
  renderPlayerStatus();
  renderHand();
  $('#draw-count').textContent = c.drawPile.length;
  $('#discard-count').textContent = c.discardPile.length;
  $('#end-turn-btn').disabled = c.over;
}

function statusChips(statuses) {
  const parts = [];
  if (statuses.poison > 0) parts.push(`<span class="status-chip status-poison">☠ ${statuses.poison}</span>`);
  if (statuses.weak > 0) parts.push(`<span class="status-chip status-weak">Weak ${statuses.weak}</span>`);
  if (statuses.vulnerable > 0) parts.push(`<span class="status-chip status-vuln">Vuln ${statuses.vulnerable}</span>`);
  if (statuses.str > 0) parts.push(`<span class="status-chip status-str">Str ${statuses.str}</span>`);
  if (statuses.dex > 0) parts.push(`<span class="status-chip status-dex">Dex ${statuses.dex}</span>`);
  return parts.join('');
}

function intentLabel(enemy) {
  const m = enemy.intent;
  if (!m) return '';
  if (m.intent === 'attack') {
    // show scaled preview
    let dmg = m.damage + enemy.statuses.str;
    if (enemy.statuses.weak > 0) dmg = Math.floor(dmg * 0.75);
    if (state.combat.statuses.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
    return `<span class="intent-attack">🗡 Attack ${dmg}</span>`;
  }
  if (m.intent === 'block') return `<span class="intent-block">🛡 Defend</span>`;
  if (m.intent === 'buff') return `<span class="intent-buff">⬆ Buff</span>`;
  if (m.intent === 'debuff') return `<span class="intent-debuff">⬇ Debuff</span>`;
  return m.name;
}

function renderEnemies() {
  const c = state.combat;
  const wrap = $('#enemies');
  wrap.innerHTML = '';
  c.enemies.forEach((enemy, idx) => {
    if (enemy.hp <= 0) return;
    const targetable = selectedHandIndex != null &&
      getCard(c.hand[selectedHandIndex])?.target === 'enemy';
    const node = el('div', 'enemy' + (targetable ? ' targetable' : ''));
    node.dataset.enemyIdx = idx;
    const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    node.innerHTML = `
      <div class="enemy-intent">${intentLabel(enemy)}</div>
      <div class="enemy-sprite">${enemy.sprite}</div>
      <div class="enemy-name">${enemy.name}${enemy.isBoss ? ' 👑' : ''}</div>
      <div class="hp-bar"><div class="hp-bar-fill" style="width:${hpPct}%"></div>
        <div class="hp-bar-text">${enemy.hp}/${enemy.maxHp}</div></div>
      ${enemy.block > 0 ? `<div class="block-badge">🛡 ${enemy.block}</div>` : ''}
      <div class="statuses">${statusChips(enemy.statuses)}</div>
    `;
    node.addEventListener('click', () => onEnemyClicked(idx));
    wrap.appendChild(node);
  });
}

function renderPlayerStatus() {
  const c = state.combat;
  $('#player-status').innerHTML = statusChips({ ...c.statuses, poison: 0 });
  const badge = $('#player-block-badge');
  if (c.block > 0) { badge.style.display = 'inline-block'; $('#player-block').textContent = c.block; }
  else badge.style.display = 'none';
}

function renderHand() {
  const c = state.combat;
  const hand = $('#hand');
  hand.innerHTML = '';
  c.hand.forEach((cardId, i) => {
    const card = getCard(cardId);
    const playable = Combat.canPlayCard(cardId) && !c.over;
    const cost = Combat.effectiveCost(card);
    const borderCls = card.type === 'attack' ? 'attack-border' : card.type === 'power' ? 'power-border' : 'skill-border';
    const node = el('div', `card ${borderCls} ${playable ? 'playable' : 'unplayable'} ${selectedHandIndex === i ? 'selected' : ''}`);
    node.innerHTML = `
      <div class="card-cost">${cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-art">${card.art}</div>
      <div class="card-text">${card.text()}</div>
      <div class="card-type">${card.type}</div>
    `;
    node.addEventListener('click', () => onCardClicked(i));
    hand.appendChild(node);
  });
}

function onCardClicked(i) {
  const c = state.combat;
  if (c.over) return;
  const cardId = c.hand[i];
  if (!cardId) return;
  if (!Combat.canPlayCard(cardId)) { toast('Not enough energy'); return; }
  const card = getCard(cardId);
  if (card.target === 'enemy') {
    // toggle selection; wait for enemy click
    selectedHandIndex = selectedHandIndex === i ? null : i;
    renderCombat();
    if (selectedHandIndex != null) toast('Choose a target');
  } else {
    // self / none target — play immediately
    Combat.playCard(i, null, combatEvents);
    selectedHandIndex = null;
    checkPendingResult();
  }
}

// If a played card ended combat (e.g. lethal poison already ticked, or an
// AoE finished the last enemy), resolve it.
function checkPendingResult() {
  if (pendingResult) {
    const r = pendingResult; pendingResult = null;
    setTimeout(() => endCombat(r), 500);
  }
}

function onEnemyClicked(idx) {
  const c = state.combat;
  if (c.over) return;
  if (selectedHandIndex == null) return;
  const target = c.enemies[idx];
  if (!target || target.hp <= 0) return;
  const handIdx = selectedHandIndex;
  selectedHandIndex = null;
  Combat.playCard(handIdx, target, combatEvents);
  checkPendingResult();
}

// visual helpers
function enemyNodeByInstance(enemy) {
  const c = state.combat;
  const idx = c.enemies.indexOf(enemy);
  return document.querySelector(`.enemy[data-enemy-idx="${idx}"]`);
}
function flashEnemy(enemy) {
  const n = enemyNodeByInstance(enemy);
  if (n) { n.classList.add('hit'); setTimeout(() => n.classList.remove('hit'), 300); }
}
function floatEnemy(enemy, text, kind) { floatText(enemyNodeByInstance(enemy), text, kind); }
function floatPlayer(text, kind) { floatText($('.player-avatar'), text, kind); }
function shakePlayer() {
  const a = $('.player-avatar');
  if (a) { a.classList.add('hit'); setTimeout(() => a.classList.remove('hit'), 300); }
}

// ================= COMBAT END / REWARDS =================
function endCombat(result) {
  if (result === 'lose') {
    renderGameOver(false);
    return;
  }
  const wasBoss = state.combat.isBoss;
  if (wasBoss) {
    renderGameOver(true);
    return;
  }
  // heal a little + card reward
  state.gold += 15 + Math.floor(Math.random() * 11);
  renderReward();
}

function renderReward() {
  showScreen('reward-screen');
  const wrap = $('#reward-cards');
  wrap.innerHTML = '';
  // 3 random distinct reward cards
  const pool = [...REWARD_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach((cardId) => {
    const card = getCard(cardId);
    const borderCls = card.type === 'attack' ? 'attack-border' : card.type === 'power' ? 'power-border' : 'skill-border';
    const node = el('div', `card ${borderCls} playable`);
    node.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-art">${card.art}</div>
      <div class="card-text">${card.text()}</div>
      <div class="card-type">${card.type}</div>
    `;
    node.addEventListener('click', () => {
      state.deck.push(cardId);
      toast(`Added ${card.name} to your deck!`);
      advanceNode();
      renderMap();
    });
    wrap.appendChild(node);
  });
}

// ================= GAME OVER =================
function renderGameOver(victory) {
  showScreen('gameover-screen');
  $('#gameover-title').textContent = victory ? '🏆 Tower Slain!' : '💀 You Died';
  $('#gameover-sub').textContent = victory
    ? 'You climbed the tower and struck down its guardian. The Silent prevails.'
    : 'The tower claims another climber. Sharpen your daggers and try again.';
}

// ================= DECK OVERLAY =================
function renderDeckOverlay() {
  const overlay = $('#deck-overlay');
  const wrap = $('#overlay-cards');
  wrap.innerHTML = '';
  const counts = {};
  for (const id of state.deck) counts[id] = (counts[id] || 0) + 1;
  Object.keys(counts).forEach((cardId) => {
    const card = getCard(cardId);
    const borderCls = card.type === 'attack' ? 'attack-border' : card.type === 'power' ? 'power-border' : 'skill-border';
    const node = el('div', `card ${borderCls}`);
    node.style.cursor = 'default';
    node.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-name">${card.name}${counts[cardId] > 1 ? ` ×${counts[cardId]}` : ''}</div>
      <div class="card-art">${card.art}</div>
      <div class="card-text">${card.text()}</div>
      <div class="card-type">${card.type}</div>
    `;
    wrap.appendChild(node);
  });
  overlay.classList.add('active');
}

// ================= BOOTSTRAP / EVENTS =================
export function initUI() {
  $('#start-btn').addEventListener('click', () => { newRun(); renderMap(); });
  $('#restart-btn').addEventListener('click', () => { newRun(); renderMap(); });
  $('#end-turn-btn').addEventListener('click', doEndTurn);
  $('#view-deck-btn').addEventListener('click', renderDeckOverlay);
  $('#close-overlay-btn').addEventListener('click', () => $('#deck-overlay').classList.remove('active'));
  $('#skip-reward-btn').addEventListener('click', () => { advanceNode(); renderMap(); });

  showScreen('title-screen');
}
