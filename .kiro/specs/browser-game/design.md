# Design Document

## Overview

This document describes the design of a browser-based roguelike deckbuilder — a personal-use clone of Slay the Spire 2 — that runs entirely client-side and deploys as static files to an Amazon S3 static website bucket. It is built with vanilla HTML, CSS, and JavaScript using native ES modules, with **no framework and no build step**. All gameplay content (cards, enemies, relics, and map layout) is defined in data files so that values can be tweaked by editing data rather than code.

The first version is a vertical slice: one playable character, 15–20 cards, 3–10 enemies, 1–3 bosses, 3–10 relics, and a single act with a short branching map ending in a boss.

### Design Goals & Constraints

- **Zero build step.** The game must run by opening `index.html` via `file://` or a plain static file server. No TypeScript, JSX, SASS, bundlers, or transpilers. (Reqs 1, 2)
- **Fully client-side.** No backend, no gameplay network requests. State lives in memory (and optionally `localStorage`). (Req 1)
- **Data-driven.** Content is declarative data with no executable game logic. All content is validated at load; invalid content prevents entering gameplay with an identifying error. (Req 3)
- **Deterministic, testable core.** Game logic (combat resolution, map generation, reward generation, run-state transitions) is implemented as pure functions over plain state objects so it can be unit- and property-tested without the DOM. (Reqs 5–9)

### Technology Choices

| Concern | Choice | Rationale |
| --- | --- | --- |
| Markup/Styling | Vanilla HTML + CSS | No UI library required (Req 2.1) |
| Logic | Vanilla JS, native ES modules (`<script type="module">`) | No bundler/transpiler needed; browsers load modules directly (Reqs 2.2, 2.4) |
| Content | ES module data files exporting plain objects/arrays | Editable, no build; `import`-able without fetch (Reqs 3.1, 3.2) |
| Persistence | In-memory `Run_State` object, optional `localStorage` mirror | No backend (Req 1.2) |
| Randomness | Seedable PRNG module | Reproducible tests for shuffles/map generation |
| Deployment | Static files to S3 website bucket | No server execution (Reqs 1.4, 1.5) |

## Architecture

### High-Level Structure

The game is a single-page application driven by a **screen state machine**. A central `GameController` owns the `Run_State` and the active screen, delegating rendering to per-screen view modules and game logic to pure-function systems.

```
index.html
  └─ <script type="module" src="src/main.js">

src/
  main.js                 # Bootstrap: load+validate content, init controller, mount title
  game-controller.js      # Screen state machine + Run_State ownership
  prng.js                 # Seedable pseudo-random number generator
  errors.js               # Fatal-load error screen renderer

  content/                # Content_Data (declarative only, no logic)
    cards.js
    enemies.js
    relics.js
    character.js
    map-config.js
    index.js              # Aggregates + exposes raw content

  systems/                # Pure logic (no DOM)
    content-loader.js     # Loads + validates Content_Data
    content-schema.js     # Field/type/range schemas
    combat.js             # Combat_System (pure state transitions)
    map.js                # Map_System (generation + navigation)
    rewards.js            # Card_Reward generation + selection
    relics.js             # Relic acquisition + passive-effect application
    run-state.js          # Run_State lifecycle (init/carry/reset)

  screens/                # DOM rendering + input wiring per screen
    title-screen.js
    map-screen.js
    combat-screen.js
    reward-screen.js
    game-over-screen.js

  ui/
    render.js             # Small DOM helpers (no framework)

styles/
  main.css

assets/                   # Static images / audio
```

### Screen State Machine

The game moves between screens as a finite state machine. `GameController` holds `currentScreen` and exposes `transition(to, payload)`. Only these transitions are legal:

```
        ┌────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
   ┌─────────┐  start run   ┌──────┐  select node   ┌────────┐ │
   │  TITLE  │─────────────▶│ MAP  │───────────────▶│ COMBAT │ │
   └─────────┘              └──────┘                └────────┘ │
        ▲                      ▲                        │      │
        │                      │  reward resolved       │      │
        │                      │   ┌────────┐  victory  │      │
        │                      └───│ REWARD │◀──────────┘      │
        │                          └────────┘                  │
        │                                                       │
        │            defeat / act complete                     │
        │  ┌───────────┐                                        │
        └──│ GAME_OVER │◀───────────────────────────────────────┘
           └───────────┘
```

- **TITLE → MAP:** Start a new run. `run-state.js` initializes a fresh `Run_State`; `map.js` generates the act map (Req 7.1).
- **MAP → COMBAT:** Player selects a reachable node (Reqs 7.3–7.5). Combat initializes from `Run_State` (Reqs 5.1, 9.3).
- **COMBAT → REWARD:** Player victory in a non-boss combat presents a `Card_Reward` (Reqs 6.1, 6.6).
- **REWARD → MAP:** After select-or-skip, return to the map (Reqs 6.3, 6.5).
- **COMBAT → GAME_OVER:** Player HP reaches 0 → defeat (Reqs 5.12); or boss defeated → act complete (Req 7.6). `Run_State` is reset on entry (Reqs 8.5, 9.5).
- **GAME_OVER → TITLE:** Return to title to start again.

### Startup / Boot Sequence

```
main.js:
  1. Render "loading" placeholder.
  2. content-loader.load():
       a. import content modules (or report missing/unreadable file → Reqs 3.6, 2.3, 1.6)
       b. validate against content-schema (missing field → 3.4; bad type/range → 3.5;
          counts/uniqueness/category minimums → 4.2–4.6, 4.8)
       c. if any validation fails → errors.showFatal(details) and STOP (no gameplay)
  3. On success → construct GameController with validated content.
  4. transition(TITLE).
```

Because content is loaded via ES `import`, a missing/broken module surfaces as a module load failure, which the boot code catches and routes to the on-screen error renderer (Reqs 1.6, 2.3, 3.6). No partially initialized game is shown.

## Data-Driven Content Model

### Content_Data Files

Content files export plain data only — no functions, no branching, no game logic (Req 3.1). Effects are expressed as **declarative descriptors** (a type tag plus parameters), and the *interpretation* of those descriptors lives in the logic systems, not in the data.

```js
// content/cards.js
export const cards = [
  { id: "strike",   name: "Strike",   cost: 1, type: "attack",
    effects: [{ kind: "damage", amount: 6 }] },
  { id: "defend",   name: "Defend",   cost: 1, type: "skill",
    effects: [{ kind: "block", amount: 5 }] },
  { id: "bash",     name: "Bash",     cost: 2, type: "attack",
    effects: [{ kind: "damage", amount: 8 }] },
  // ... 15–20 total
];

// content/enemies.js
export const enemies = [
  { id: "cultist", name: "Cultist", maxHp: 48, isBoss: false,
    intents: [{ id: "attack", kind: "attack", amount: 6 },
              { id: "buff",   kind: "buff",   amount: 3 }],
    pattern: ["buff", "attack", "attack"] },
  // ... 3–10 non-boss + 1–3 boss (isBoss: true)
];

// content/relics.js
export const relics = [
  { id: "burning_blood", name: "Burning Blood",
    effect: { kind: "modify", target: "maxHp", op: "add", amount: 6 } },
  // ... 3–10 total
];

// content/character.js
export const character = {
  id: "ironclad", name: "Ironclad",
  maxHp: 80,                       // 50–100 (Req 4.1)
  startingDeck: ["strike","strike","strike","strike","strike",
                 "defend","defend","defend","defend","bash"]  // 8–12 (Req 4.1)
};

// content/map-config.js
export const mapConfig = {
  minNodes: 10, maxNodes: 20,      // Req 7.1
  minRows: 6,  maxRows: 10,
  nodeTypes: ["combat", "elite", "boss"],
  maxRegenAttempts: 5              // Req 7.2
};
```

### Content Schema & Validation

`content-schema.js` declares, per content type, the required fields, allowed types, and value ranges. `content-loader.js` walks every entry and validates it, accumulating errors that identify the file and entry.

```js
// content-schema.js (illustrative)
export const cardSchema = {
  file: "content/cards.js",
  fields: {
    id:      { type: "string", required: true, unique: true },
    name:    { type: "string", required: true },
    cost:    { type: "number", required: true, min: 0, max: 6 },
    type:    { type: "string", required: true, enum: ["attack","skill","power"] },
    effects: { type: "array",  required: true, minLength: 1 }
  },
  count: { min: 15, max: 20 }      // Reqs 4.2, 4.3
};
```

`content-loader.js` returns a discriminated result:

```js
// { ok: true, content } | { ok: false, errors: [{ file, entryId, field, message }] }
export function loadAndValidate(rawContent) { ... }
```

Validation checks (each producing an identifying error and preventing gameplay):
- **Missing required field** → error naming file + entry + field (Req 3.4).
- **Wrong type / out-of-range value** → error naming file + entry + field (Req 3.5).
- **Missing/unreadable file** → caught at import in `main.js`, error naming file (Req 3.6).
- **Counts out of range** (cards 15–20, enemies 3–10, bosses 1–3, relics 3–10) → error naming category (Reqs 4.2–4.6, 4.8).
- **Duplicate ids** within a category → error naming duplicate (Reqs 4.2, 4.4, 4.6).
- **Boss/non-boss overlap** → bosses must be disjoint from non-boss enemies (Req 4.5).
- **Character bounds** (deck 8–12, HP 50–100, exactly one character) (Req 4.1).

## Components and Interfaces

### GameController (`game-controller.js`)

Owns `Run_State` and the screen state machine.

```js
class GameController {
  constructor(content) { this.content = content; this.runState = null; this.screen = null; }
  transition(to, payload) { /* validate legal transition; mount screen */ }
  startRun()   { this.runState = initRunState(this.content); this.transition("MAP"); }
  endRun(outcome) { resetRunState(this.runState); this.transition("GAME_OVER", { outcome }); }
}
```

### Combat_System (`combat.js`)

Pure functions over an immutable-ish `CombatState`. The screen module calls these and re-renders from the returned state.

```js
// Types (plain objects)
// CombatState = { player, enemies, hand, drawPile, discardPile, energy, energyPerTurn, phase, rng }
// Player      = { hp, maxHp, block }
// Enemy       = { id, hp, maxHp, block, intent }  // intent chosen at start of its upcoming turn

export function startCombat(runState, encounter, content, rng) { ... } // energy=3, draw 5 (Req 5.1)
export function playCard(state, cardIndex) { ... }   // Reqs 5.2, 5.3, 5.4
export function drawCards(state, n) { ... }          // Reqs 5.5, 5.6
export function applyDamage(target, amount) { ... }  // Req 5.7 (block-first, hp floor 0)
export function endTurn(state) { ... }               // Reqs 5.10, then enemy turn 5.8
export function runEnemyTurn(state) { ... }          // Req 5.8 (act per displayed intent)
export function refreshIntents(state) { ... }        // Req 5.9 (all living enemies)
export function checkCombatEnd(state) { ... }        // Reqs 5.11, 5.12
```

Key rules:
- `playCard` rejects when `card.cost > energy` (returns unchanged state + `insufficientEnergy` flag) (Req 5.3); otherwise deducts cost, applies effects, moves card to discard (Reqs 5.2, 5.4).
- `applyDamage` computes `blockAfter = max(0, block - amount)`, `overflow = max(0, amount - block)`, `hpAfter = max(0, hp - overflow)` (Req 5.7).
- `drawCards` reshuffles the discard pile into the draw pile via the seeded PRNG when the draw pile empties (Req 5.5); draws nothing when both piles are empty (Req 5.6).
- Enemy intents are selected and displayed at the start of each turn for all living enemies (Req 5.9) and the enemy turn executes exactly those displayed intents (Req 5.8).

### Map_System (`map.js`)

```js
// MapNode = { id, row, type, edges: [nodeId], visited }
// GameMap = { nodes: {id: MapNode}, rows: [[nodeId]], currentNodeId }

export function generateMap(mapConfig, rng) { ... }  // Reqs 7.1, 7.2 (retry ≤5, else error)
export function reachableFrom(map, nodeId) { ... }   // neighbors via edges (Req 7.3)
export function selectNode(map, nodeId) { ... }      // Reqs 7.4, 7.5
```

`generateMap` builds 6–10 rows totaling 10–20 nodes with a single boss node as the only node in the final row, connects rows with edges, then verifies **every path reaches the boss** (all non-final nodes have ≥1 outgoing edge and the boss is reachable). If verification fails, it regenerates up to 5 times, then returns a generation-failure result (Req 7.2). `selectNode` allows a move only to an edge-connected neighbor, otherwise rejects and leaves position unchanged (Reqs 7.4, 7.5).

### Rewards (`rewards.js`)

```js
export function generateReward(cardPool, rng) { ... } // 3 distinct, or all remaining ≥1 (Reqs 6.1, 6.2)
export function selectReward(deck, reward, cardId) { ... } // add exactly one (Reqs 6.3, 6.4)
export function skipReward(deck) { return deck; }     // unchanged (Req 6.5)
```

### Relics (`relics.js`)

```js
export function acquireRelic(runState, relicId) { ... } // add if new, reject duplicate (Reqs 8.1, 8.2)
export function applyRelicEffects(value, target, runState, content) { ... } // fold in acquisition order (Reqs 8.3, 8.4)
```

The relic collection is an **ordered** list (acquisition order) so that effects modifying the same value compose deterministically as a left fold over that order (Req 8.4). Capacity supports up to 999 relics (Req 8.6).

### Run_State (`run-state.js`)

```js
// RunState = { hp, maxHp, deck: [cardId], relics: [relicId], map, currentAct }
export function initRunState(content) { ... }         // fresh from character (Req 9.5)
export function carryHpAfterCombat(runState, hp) { ... } // clamp 0..maxHp (Req 9.2)
export function drawPileForCombat(runState) { ... }   // exactly the deck (Reqs 6.7, 9.3)
export function validateRunState(runState) { ... }    // missing field → halt (Req 9.4)
export function resetRunState(runState) { ... }       // clear HP/deck/relics (Reqs 8.5, 9.5)
```

`Run_State` is preserved unchanged across node boundaries except for the intended effects of encounters (Req 9.1). On a new combat, HP initializes from `Run_State` and the draw pile is exactly the run deck (Req 9.3); if a required field is missing/unreadable, combat init halts with an error (Req 9.4).

## Data Models

| Model | Fields | Notes |
| --- | --- | --- |
| `Card` (data) | `id, name, cost, type, effects[]` | Declarative effects (Reqs 3.1, 4.2) |
| `Enemy` (data) | `id, name, maxHp, isBoss, intents[], pattern[]` | Bosses `isBoss:true` (Reqs 4.4, 4.5) |
| `Relic` (data) | `id, name, effect` | Declarative passive effect (Reqs 4.6, 8.x) |
| `Character` (data) | `id, name, maxHp, startingDeck[]` | Deck 8–12, HP 50–100 (Req 4.1) |
| `CombatState` | `player, enemies[], hand[], drawPile[], discardPile[], energy, energyPerTurn, phase, rng` | Runtime (Req 5.x) |
| `MapNode` / `GameMap` | node id/row/type/edges; map nodes/rows/currentNodeId | Runtime (Req 7.x) |
| `RunState` | `hp, maxHp, deck[], relics[], map, currentAct` | Persistent within a run (Req 9.x) |
| `CardReward` | `options[] (cardId), resolved` | Runtime (Req 6.x) |

## Error Handling

| Condition | Handling | Requirement |
| --- | --- | --- |
| Missing/unreadable content file | Catch import failure at boot; fatal error screen naming file; no gameplay | 1.6, 2.3, 3.6 |
| Missing required field in entry | Validation error naming file/entry/field; no gameplay | 3.4 |
| Invalid type / out-of-range value | Validation error naming file/entry/field; no gameplay | 3.5 |
| Content counts out of range / duplicate ids / boss overlap | Validation error naming category; fail to start | 4.2–4.6, 4.8 |
| Play card with insufficient energy | Reject; card stays in hand; energy unchanged; UI indicates insufficient energy | 5.3 |
| Draw with both piles empty | Draw nothing; hand unchanged | 5.6 |
| Select unreachable map node | Reject; position unchanged; visual "unreachable" indication | 7.4 |
| Map generation fails after 5 retries | Error indication that map generation failed | 7.2 |
| Acquire duplicate relic | Reject; collection unchanged; "already owned" indication | 8.2 |
| Run_State unreadable/missing field at combat start | Halt combat init; error to player; no combat | 9.4 |
| Network request attempted after load | Continue without degradation; preserve state | 1.3 |

## Deployment (Amazon S3 Static Website)

Because the game is only static files with no build step, deployment is a direct upload:

1. **Bucket:** Create an S3 bucket and enable **Static website hosting** with `index.html` as the index document and an error document (e.g., `error.html`).
2. **Upload:** Sync the project directory (`index.html`, `src/**`, `styles/**`, `assets/**`) to the bucket as-is — no compilation or transpilation (Reqs 1.4, 1.5, 2.2).
   - Example: `aws s3 sync . s3://<bucket-name> --exclude ".kiro/*" --exclude ".git/*"`
3. **Access:** Serve publicly via the bucket website endpoint (bucket policy for public read) or front with CloudFront for HTTPS. No server-side execution is configured (Req 1.4).
4. **MIME types:** Ensure `.js` files are served as `text/javascript` (or `application/javascript`) so native ES modules load correctly; `.mjs` not required since modules are declared via `type="module"`.
5. **Cache:** Static assets may use long cache lifetimes; `index.html` should use a short/no-cache policy so edits appear on reload (supports the tweak-and-reload workflow, Reqs 2.5, 3.2).

No backend, database, or serverless function is part of the deployment. The game preserves state in the browser and issues no gameplay backend requests (Reqs 1.1, 1.2).

## Testing Strategy

**Dual approach:** pure logic systems are unit-tested (specific examples, edge cases, error conditions) and property-tested (universal invariants across generated inputs). DOM/screen modules are verified with a small number of example-based interaction tests. Deployment/structural constraints (no framework, static-only files, load performance) are verified with smoke/integration checks rather than property tests.

- **Property tests:** minimum 100 generated iterations each; use the seedable PRNG for reproducibility. Each test references its design property using the tag format **Feature: browser-game, Property {number}: {property_text}**.
- **Example/edge tests:** insufficient-energy rejection, both-piles-empty draw, duplicate relic, unreachable node selection, missing-content-file boot error, run-state corruption at combat start, boss-defeat act completion, 999-relic capacity.
- **Integration/smoke tests:** loads via `file://`/static server with no build; only static files present; no framework imports; content loads within the performance budgets; no backend network request during a scripted run.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Content field/type/range validation rejects invalid entries

*For any* otherwise-valid Content_Data entry, if a required field is removed or a field is set to a value of the wrong type or outside its allowed range, then the content loader SHALL reject loading and produce an error that identifies the affected file and entry, and SHALL NOT enter gameplay.

**Validates: Requirements 3.4, 3.5**

### Property 2: Content structure validation (counts, uniqueness, disjointness)

*For any* generated Content_Data set, the loader SHALL succeed only if card count is 15–20, enemy count 3–10, boss count 1–3, relic count 3–10, all ids within a category are unique, and boss enemies are disjoint from non-boss enemies; otherwise it SHALL fail to start with an error identifying the offending category.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.8**

### Property 3: Combat initialization sets energy and hand

*For any* run deck containing at least 5 cards, starting a combat SHALL set available energy to the per-turn energy amount and produce a hand of exactly 5 cards drawn from the draw pile.

**Validates: Requirements 5.1**

### Property 4: Affordable card play deducts exact cost and discards the card

*For any* combat state and any card in hand whose cost is less than or equal to the available energy, playing the card SHALL reduce available energy by exactly the card's cost, apply the card's effects, and move exactly that card to the discard pile.

**Validates: Requirements 5.2, 5.4**

### Property 5: Unaffordable card play is a no-op with indication

*For any* combat state and any card in hand whose cost exceeds the available energy, attempting to play it SHALL leave the hand, available energy, and board unchanged and SHALL signal that energy is insufficient.

**Validates: Requirements 5.3**

### Property 6: Drawing conserves cards and reshuffles when needed

*For any* combat state, drawing cards SHALL conserve the total number of cards across hand, draw pile, and discard pile; when the draw pile is empty and the discard pile is non-empty, the discard pile SHALL be shuffled into the draw pile before drawing.

**Validates: Requirements 5.5**

### Property 7: Damage applies to block first with a hit-point floor of zero

*For any* non-negative incoming damage `d`, block `b`, and hit points `h`, applying damage SHALL result in block `max(0, b - d)` and hit points `max(0, h - max(0, d - b))`.

**Validates: Requirements 5.7**

### Property 8: Enemy actions match displayed intents

*For any* combat state at the start of an enemy turn, executing the enemy turn SHALL perform, for each living enemy, exactly the action described by the intent that was displayed for that enemy at the start of the turn.

**Validates: Requirements 5.8**

### Property 9: All living enemies have a displayed intent at player-turn start

*For any* combat state, when the player turn begins every living enemy SHALL have a displayed intent for its upcoming turn.

**Validates: Requirements 5.9**

### Property 10: Ending the turn discards the hand and zeroes player block

*For any* combat state, ending the player turn SHALL move all remaining hand cards to the discard pile and set the player's block to zero.

**Validates: Requirements 5.10**

### Property 11: Combat and run termination conditions

*For any* combat state, if every enemy's hit points are zero the combat SHALL end as a player victory; and if the player's hit points reach zero the run SHALL end as a defeat.

**Validates: Requirements 5.11, 5.12**

### Property 12: Card reward generation size and membership

*For any* run card pool, a generated card reward SHALL contain exactly `min(3, poolSize)` distinct cards (at least 1 when the pool is non-empty), and every offered card SHALL be a member of the pool.

**Validates: Requirements 6.1, 6.2**

### Property 13: Reward selection adds exactly the chosen card

*For any* deck and any generated card reward, selecting one card SHALL produce a deck equal to the original deck plus exactly the selected card, add at most one card, and close the reward.

**Validates: Requirements 6.3, 6.4**

### Property 14: Skipping a reward leaves the deck unchanged

*For any* deck and any generated card reward, skipping the reward SHALL leave the deck identical and close the reward.

**Validates: Requirements 6.5**

### Property 15: Next combat draw pile equals the current deck

*For any* run state, initializing the next combat SHALL set the draw pile to contain exactly the cards present in the current run deck (including cards added during the run) and initialize player hit points from the run state.

**Validates: Requirements 6.7, 9.3**

### Property 16: Generated maps satisfy structure and boss reachability

*For any* map produced by the generator and presented to the player, the map SHALL contain 10–20 nodes arranged in 6–10 sequential rows, the final row SHALL contain exactly one boss node, and every path from the starting row SHALL reach that single boss node.

**Validates: Requirements 7.1, 7.2**

### Property 17: Only edge-connected nodes are selectable

*For any* game map and current position, the set of selectable nodes SHALL be exactly the nodes directly connected by an edge to the current node, and all other nodes SHALL be non-selectable.

**Validates: Requirements 7.3**

### Property 18: Node selection respects reachability

*For any* game map and current position, selecting a node that is not an edge-connected neighbor SHALL leave the current position unchanged; selecting an edge-connected neighbor SHALL update the current position to that node.

**Validates: Requirements 7.4, 7.5**

### Property 19: New relic acquisition adds exactly one; duplicates are rejected

*For any* run state and any relic, acquiring a relic not already owned SHALL add exactly that relic to the (ordered) relic collection; acquiring a relic already owned SHALL leave the collection unchanged.

**Validates: Requirements 8.1, 8.2**

### Property 20: Same-value relic effects compose in acquisition order

*For any* set of owned relics whose effects modify the same game value, the resulting value SHALL equal the left fold of those effects applied in the order the relics were acquired.

**Validates: Requirements 8.4**

### Property 21: Run reset clears all carried state

*For any* ended run, resetting the run state SHALL leave hit points, deck, and owned relics with no values carried over from the ended run before a new run begins, and SHALL stop applying relic effects.

**Validates: Requirements 8.5, 9.5**

### Property 22: Post-combat hit points are clamped to valid range

*For any* hit-point value recorded when combat resolves, the run state player hit points SHALL be set to that value clamped to the range 0 to the player's maximum hit points.

**Validates: Requirements 9.2**

### Property 23: Run state is preserved across node boundaries

*For any* run state, crossing an encounter-node boundary SHALL preserve the player's hit points, deck, and owned relics without loss or unintended modification.

**Validates: Requirements 9.1**
