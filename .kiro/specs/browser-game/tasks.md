# Implementation Plan: Browser Roguelike Deckbuilder

## Overview

This plan builds the game bottom-up in vanilla JavaScript (native ES modules, no framework, no build step): first the deterministic foundations (seedable PRNG and the content schema/loader), then the pure-function logic systems (combat, map, rewards, relics, run-state) with property-based tests validating the design's 23 correctness properties, then the DOM screen modules and the `GameController` state machine, then the `index.html`/`main.js` bootstrap that wires everything together, and finally deployment-prep and integration/smoke verification for the S3 static-hosting constraints.

Each task produces or extends code that is integrated by a later task — there is no orphaned code. Property test tasks reference their design property number and the requirements clause each validates. Property tests use a minimum of 100 generated iterations, seeded via the PRNG for reproducibility, and are tagged **Feature: browser-game, Property {n}: {property_text}**.

## Tasks

- [ ] 1. Set up project structure, PRNG, and testing harness
  - [ ] 1.1 Create the static project skeleton and directory layout
    - Create `src/`, `src/content/`, `src/systems/`, `src/screens/`, `src/ui/`, `styles/`, and `assets/` directories
    - Add a placeholder `styles/main.css` and an `error.html` error document
    - Create `src/errors.js` exporting a `showFatal(details)` function that renders a fatal-load error screen into the DOM (used later by the boot sequence)
    - Ensure no framework/UI-library imports and no source requiring transpilation are introduced (vanilla HTML/CSS/JS only)
    - _Requirements: 2.1, 2.2, 2.4, 1.4_

  - [ ] 1.2 Implement the seedable PRNG module
    - Create `src/systems/prng.js` (re-exported as `src/prng.js` per design layout) exporting a factory that produces a deterministic PRNG from a numeric seed, with `next()` (float in [0,1)), `nextInt(n)`, and a `shuffle(array)` helper
    - Guarantee identical sequences for identical seeds (reproducibility for shuffles and map generation)
    - _Requirements: 5.5, 7.1_

  - [ ]* 1.3 Write property test for PRNG determinism and shuffle conservation
    - **Property 6 (support): deterministic reproducibility** — two PRNGs seeded identically produce identical sequences; `shuffle` returns a permutation preserving multiset membership and length
    - **Validates: Requirements 5.5**

  - [ ] 1.4 Set up a no-build test runner
    - Configure a test setup that runs pure-module tests without a build step (e.g., a property-based testing library plus a runner invoked via a single command), documenting the exact command for the user to run manually
    - Add a minimal helper for authoring seeded property tests (≥100 iterations)
    - _Requirements: 2.2, 2.4_

- [ ] 2. Define declarative content and the content schema/loader
  - [ ] 2.1 Author the declarative Content_Data files
    - Create `src/content/cards.js` (15–20 distinct cards with unique ids; declarative `effects` descriptors only, no logic)
    - Create `src/content/enemies.js` (3–10 non-boss + 1–3 boss enemies with `isBoss`, `intents`, `pattern`)
    - Create `src/content/relics.js` (3–10 distinct relics with declarative `effect` descriptors)
    - Create `src/content/character.js` (exactly one character, starting deck 8–12, maxHp 50–100)
    - Create `src/content/map-config.js` (node/row bounds, `maxRegenAttempts`) and `src/content/index.js` aggregating raw content
    - Ensure files contain no executable game logic
    - _Requirements: 3.1, 4.1, 4.2, 4.4, 4.5, 4.6_

  - [ ] 2.2 Implement the content schema
    - Create `src/systems/content-schema.js` declaring per-type required fields, allowed types, value ranges, enums, uniqueness, and category count bounds (cards 15–20, enemies 3–10, bosses 1–3, relics 3–10, character deck 8–12 / HP 50–100)
    - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

  - [ ] 2.3 Implement the content loader/validator
    - Create `src/systems/content-loader.js` exporting `loadAndValidate(rawContent)` returning `{ ok: true, content } | { ok: false, errors: [...] }`
    - Validate each entry against the schema, accumulating errors that identify file/entry/field for missing required fields and wrong-type/out-of-range values
    - Validate structural constraints: category counts, id uniqueness within a category, boss/non-boss disjointness, and character bounds; produce an error identifying the offending category
    - Prevent gameplay when any validation fails
    - _Requirements: 3.4, 3.5, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

  - [ ]* 2.4 Write property test for field/type/range validation
    - **Property 1: Content field/type/range validation rejects invalid entries** — removing a required field or setting an out-of-type/out-of-range value causes rejection with a file/entry-identifying error and no gameplay entry
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 2.5 Write property test for structural validation
    - **Property 2: Content structure validation (counts, uniqueness, disjointness)** — loader succeeds only when counts, id uniqueness, and boss disjointness all hold; otherwise fails with a category-identifying error
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.8**

  - [ ]* 2.6 Write unit tests for loader error identification
    - Test that error objects name the correct file, entry id, and field for representative failures
    - _Requirements: 3.4, 3.5_

- [ ] 3. Checkpoint - content foundation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Run_State lifecycle
  - [ ] 4.1 Implement run-state functions
    - Create `src/systems/run-state.js` exporting `initRunState(content)`, `carryHpAfterCombat(runState, hp)` (clamp 0..maxHp), `drawPileForCombat(runState)` (exactly the deck), `validateRunState(runState)` (missing field → halt), and `resetRunState(runState)` (clear HP/deck/relics)
    - Initialize fresh run state from the character content
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 8.5_

  - [ ]* 4.2 Write property test for post-combat HP clamping
    - **Property 22: Post-combat hit points are clamped to valid range** — recorded HP is stored clamped to 0..maxHp
    - **Validates: Requirements 9.2**

  - [ ]* 4.3 Write property test for run reset clearing carried state
    - **Property 21: Run reset clears all carried state** — after reset, HP/deck/relics carry no prior values and relic effects stop applying
    - **Validates: Requirements 8.5, 9.5**

  - [ ]* 4.4 Write property test for run-state preservation across node boundaries
    - **Property 23: Run state is preserved across node boundaries** — crossing an encounter-node boundary preserves HP, deck, and relics without unintended modification
    - **Validates: Requirements 9.1**

  - [ ]* 4.5 Write unit test for run-state validation halt
    - Test that a run state missing a required field (HP, deck, or relics) is reported by `validateRunState` so combat init can halt
    - _Requirements: 9.4_

- [ ] 5. Implement the Combat_System (pure functions)
  - [ ] 5.1 Implement combat initialization and damage resolution
    - Create `src/systems/combat.js` with `startCombat(runState, encounter, content, rng)` setting energy to per-turn amount and drawing a hand of 5, and `applyDamage(target, amount)` reducing block first with HP floor of 0
    - Initialize player HP from run state and draw pile as exactly the run deck; halt with an error if a required run-state field is missing
    - _Requirements: 5.1, 5.7, 9.3, 9.4_

  - [ ]* 5.2 Write property test for combat initialization
    - **Property 3: Combat initialization sets energy and hand** — energy equals per-turn amount, hand is exactly 5 cards drawn from the draw pile
    - **Validates: Requirements 5.1**

  - [ ]* 5.3 Write property test for next-combat draw pile equals current deck
    - **Property 15: Next combat draw pile equals the current deck** — draw pile contains exactly the current run deck (including added cards); player HP initialized from run state
    - **Validates: Requirements 6.7, 9.3**

  - [ ]* 5.4 Write property test for damage/block resolution
    - **Property 7: Damage applies to block first with a hit-point floor of zero** — block `max(0, b-d)`, hp `max(0, h - max(0, d-b))`
    - **Validates: Requirements 5.7**

  - [ ] 5.5 Implement card play, drawing, and reshuffle
    - Add `playCard(state, cardIndex)` (deduct exact cost, apply effects, discard the played card for affordable cards; reject unaffordable plays leaving hand/energy/board unchanged with an `insufficientEnergy` signal)
    - Add `drawCards(state, n)` conserving total card count and reshuffling discard into draw (via PRNG) when the draw pile empties; draw nothing when both piles are empty
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.6 Write property test for affordable card play
    - **Property 4: Affordable card play deducts exact cost and discards the card**
    - **Validates: Requirements 5.2, 5.4**

  - [ ]* 5.7 Write property test for unaffordable card play no-op
    - **Property 5: Unaffordable card play is a no-op with indication**
    - **Validates: Requirements 5.3**

  - [ ]* 5.8 Write property test for draw conservation and reshuffle
    - **Property 6: Drawing conserves cards and reshuffles when needed**
    - **Validates: Requirements 5.5**

  - [ ]* 5.9 Write unit test for both-piles-empty draw
    - Test that drawing with empty draw and discard piles leaves the hand unchanged
    - _Requirements: 5.6_

  - [ ] 5.10 Implement enemy intents, turn resolution, and end conditions
    - Add `refreshIntents(state)` (display an intent for every living enemy at player-turn start), `endTurn(state)` (discard hand, zero player block, then run enemy turn), `runEnemyTurn(state)` (execute exactly the displayed intents), and `checkCombatEnd(state)` (all enemies at 0 HP → victory; player at 0 HP → defeat)
    - _Requirements: 5.8, 5.9, 5.10, 5.11, 5.12_

  - [ ]* 5.11 Write property test for enemy actions matching displayed intents
    - **Property 8: Enemy actions match displayed intents**
    - **Validates: Requirements 5.8**

  - [ ]* 5.12 Write property test for all living enemies having a displayed intent
    - **Property 9: All living enemies have a displayed intent at player-turn start**
    - **Validates: Requirements 5.9**

  - [ ]* 5.13 Write property test for end-turn discard and block reset
    - **Property 10: Ending the turn discards the hand and zeroes player block**
    - **Validates: Requirements 5.10**

  - [ ]* 5.14 Write property test for combat/run termination conditions
    - **Property 11: Combat and run termination conditions**
    - **Validates: Requirements 5.11, 5.12**

- [ ] 6. Checkpoint - combat core
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement rewards and relics
  - [ ] 7.1 Implement card reward generation and selection
    - Create `src/systems/rewards.js` with `generateReward(cardPool, rng)` (exactly `min(3, poolSize)` distinct pool members, ≥1 when non-empty), `selectReward(deck, reward, cardId)` (add exactly one, close reward), and `skipReward(deck)` (unchanged)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.2 Write property test for reward generation size and membership
    - **Property 12: Card reward generation size and membership**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 7.3 Write property test for reward selection adding exactly one card
    - **Property 13: Reward selection adds exactly the chosen card**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 7.4 Write property test for skipping a reward
    - **Property 14: Skipping a reward leaves the deck unchanged**
    - **Validates: Requirements 6.5**

  - [ ] 7.5 Implement relic acquisition and effect composition
    - Create `src/systems/relics.js` with `acquireRelic(runState, relicId)` (add if new to the ordered collection, reject duplicates leaving collection unchanged, support up to 999) and `applyRelicEffects(value, target, runState, content)` (left fold in acquisition order)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [ ]* 7.6 Write property test for relic acquisition and duplicate rejection
    - **Property 19: New relic acquisition adds exactly one; duplicates are rejected**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 7.7 Write property test for same-value relic effect composition
    - **Property 20: Same-value relic effects compose in acquisition order**
    - **Validates: Requirements 8.4**

  - [ ]* 7.8 Write unit test for 999-relic capacity
    - Test that the relic collection accepts up to 999 distinct relics
    - _Requirements: 8.6_

- [ ] 8. Implement the Map_System
  - [ ] 8.1 Implement map generation with retry and reachability verification
    - Create `src/systems/map.js` with `generateMap(mapConfig, rng)` producing 10–20 nodes in 6–10 rows, a single boss node as the only node in the final row, edges connecting rows, and verification that every path reaches the boss; regenerate up to 5 times then return a generation-failure result
    - _Requirements: 7.1, 7.2_

  - [ ]* 8.2 Write property test for map structure and boss reachability
    - **Property 16: Generated maps satisfy structure and boss reachability**
    - **Validates: Requirements 7.1, 7.2**

  - [ ] 8.3 Implement node reachability and selection
    - Add `reachableFrom(map, nodeId)` (edge-connected neighbors) and `selectNode(map, nodeId)` (move only to a neighbor and update position; otherwise reject and leave position unchanged)
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]* 8.4 Write property test for edge-connected selectability
    - **Property 17: Only edge-connected nodes are selectable**
    - **Validates: Requirements 7.3**

  - [ ]* 8.5 Write property test for node selection reachability enforcement
    - **Property 18: Node selection respects reachability**
    - **Validates: Requirements 7.4, 7.5**

  - [ ]* 8.6 Write unit test for map generation failure indication
    - Test that repeated verification failure returns a generation-failure result after the retry limit
    - _Requirements: 7.2_

- [ ] 9. Checkpoint - systems complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement DOM rendering helpers and screen modules
  - [ ] 10.1 Implement DOM render helpers
    - Create `src/ui/render.js` with small framework-free DOM helpers (element creation, mounting, clearing) used by all screens
    - _Requirements: 2.1_

  - [ ] 10.2 Implement the title screen
    - Create `src/screens/title-screen.js` rendering the title and a "start run" control that requests a TITLE → MAP transition
    - _Requirements: 2.1_

  - [ ] 10.3 Implement the map screen
    - Create `src/screens/map-screen.js` rendering nodes/rows, marking only edge-connected neighbors selectable and others non-selectable, showing an "unreachable" indication on invalid selection, and starting the selected encounter on a valid selection
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ] 10.4 Implement the combat screen
    - Create `src/screens/combat-screen.js` rendering player/enemies/hand/piles/energy and displayed intents, wiring card-play (including insufficient-energy indication) and end-turn to `combat.js`, and re-rendering from returned state
    - _Requirements: 5.1, 5.2, 5.3, 5.8, 5.9, 5.10_

  - [ ] 10.5 Implement the reward screen
    - Create `src/screens/reward-screen.js` rendering the offered cards, enforcing at-most-one selection or skip, blocking progression until resolved, and returning to the map afterward
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

  - [ ] 10.6 Implement the game-over screen
    - Create `src/screens/game-over-screen.js` rendering defeat or act-complete outcomes and a control to return to the title
    - _Requirements: 5.12, 7.6_

  - [ ]* 10.7 Write example interaction tests for screens
    - Test representative DOM interactions: unreachable-node indication, insufficient-energy indication, reward blocks progression until resolved
    - _Requirements: 7.4, 5.3, 6.6_

- [ ] 11. Implement the GameController state machine
  - [ ] 11.1 Implement GameController and legal transitions
    - Create `src/game-controller.js` owning `runState` and `currentScreen`, exposing `transition(to, payload)` that permits only the legal transitions (TITLE→MAP, MAP→COMBAT, COMBAT→REWARD, REWARD→MAP, COMBAT→GAME_OVER, GAME_OVER→TITLE) and mounts the corresponding screen
    - Implement `startRun()` (init run state, generate map, go to MAP) and `endRun(outcome)` (reset run state, go to GAME_OVER)
    - On boss defeat, end the run as a completed act and record completion
    - _Requirements: 6.6, 7.6, 8.5, 9.1, 9.5_

  - [ ] 11.2 Wire combat resolution into run-state and progression
    - Connect combat victory to reward → map, combat defeat to game-over, and post-combat HP carry (clamped) back into run state; block progression until reward is resolved
    - _Requirements: 5.11, 5.12, 6.6, 6.7, 9.2, 9.3_

  - [ ]* 11.3 Write unit tests for transition legality
    - Test that illegal transitions are rejected and legal ones mount the expected screen
    - _Requirements: 6.6, 7.6_

- [ ] 12. Bootstrap and wire the application together
  - [ ] 12.1 Implement the boot sequence in main.js
    - Create `src/main.js` that renders a loading placeholder, imports raw content, calls `content-loader.loadAndValidate`, routes any validation failure to `errors.showFatal` (no gameplay), and on success constructs `GameController` and transitions to TITLE
    - Catch content-module import failures (missing/unreadable file) and route them to the fatal error screen naming the file
    - _Requirements: 1.6, 2.3, 3.3, 3.4, 3.5, 3.6, 4.7_

  - [ ] 12.2 Create index.html entry point
    - Create `index.html` linking `styles/main.css` and loading `src/main.js` via `<script type="module">`, with no framework/CDN imports and no build step
    - _Requirements: 1.1, 2.1, 2.2, 2.4_

  - [ ]* 12.3 Write unit test for boot failure routing
    - Test that a validation failure and a simulated missing-file import both route to the fatal error screen and prevent gameplay
    - _Requirements: 1.6, 2.3, 3.6_

- [ ] 13. Checkpoint - full run loop wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Deployment prep and integration/smoke verification
  - [ ] 14.1 Add deployment artifacts and documentation
    - Add `error.html` as the S3 error document (if not already present) and a `README`/`DEPLOY.md` documenting the `aws s3 sync` upload (excluding `.kiro/*` and `.git/*`), static website hosting config (index/error documents), `.js` MIME-type guidance, and cache guidance (short/no-cache `index.html`, long-cache assets)
    - _Requirements: 1.4, 1.5, 2.2, 2.5, 3.2_

  - [ ]* 14.2 Write integration/smoke tests for static-only and no-framework constraints
    - Verify the project contains only static files, imports no framework/UI library, requires no transpilation, and that content loads within the performance budgets with no backend network request during a scripted run
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.4, 3.3, 4.7_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (unit, property, and integration tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements clauses for traceability; property test tasks additionally cite the design correctness property they validate.
- Property tests run a minimum of 100 generated iterations, are seeded via `prng.js` for reproducibility, and are tagged **Feature: browser-game, Property {n}: {property_text}**.
- Checkpoints provide incremental validation at natural boundaries (content foundation, combat core, systems complete, full loop, final).
- The build proceeds bottom-up: deterministic foundations → pure logic systems → DOM screens → controller → bootstrap → deployment, so every module is integrated by a later task with no orphaned code.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.2", "10.1"] },
    { "id": 2, "tasks": ["2.3", "10.2", "10.6"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "4.1", "8.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "7.1", "7.5", "8.2", "8.3"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5", "7.2", "7.6", "7.8", "8.4", "8.5", "8.6", "10.3"] },
    { "id": 6, "tasks": ["5.6", "5.7", "5.8", "5.9", "5.10", "7.3", "7.7", "10.5"] },
    { "id": 7, "tasks": ["5.11", "5.12", "5.13", "5.14", "10.4"] },
    { "id": 8, "tasks": ["10.7", "11.1"] },
    { "id": 9, "tasks": ["11.2"] },
    { "id": 10, "tasks": ["11.3", "12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["12.3", "14.1"] },
    { "id": 13, "tasks": ["14.2"] }
  ]
}
```
