# Kill a Tower

A browser-based roguelike **deckbuilder** — a personal-use, Slay the Spire-style game — built with **vanilla HTML, CSS, and JavaScript** (native ES modules, no framework, no build step) and deployable as static files to an **Amazon S3 static website** bucket.

Play as **The Silent**: a poison-and-slyness rogue who stacks toxins, dodges with block, and cuts down whatever's left.

## Highlights

- **Zero build step.** Runs by opening `index.html` from any static file server — no bundler, transpiler, or framework.
- **Fully client-side.** No backend; all game state lives in the browser.
- **Data-driven content.** Cards, enemies, relics, and the map are defined in editable data files so you can tweak gameplay values without touching engine code, then just reload.
- **UI-agnostic combat engine.** The combat core is synchronous and pure (see `js/combat.js`); the UI layer (`js/ui.js`) handles rendering and animation. This makes the engine easy to test headlessly.

## Vertical Slice Scope

This build is the first vertical slice — a complete, replayable run loop:

- **One character:** The Silent (70 HP, 3 energy/turn, poison + agility deck).
- **17 cards** — strikes, defends, poison appliers (Deadly Poison, Bouncing Flask, Catalyst), sly cards (Backstab, Blade Dance, Adrenaline), and powers (Noxious Fumes, Wraith Form).
- **3 regular enemies** (Cultist, Fang Spider, Tower Guard) and **2 bosses** (The Hex Queen, The Iron Colossus — one is chosen at random).
- **Single-path map:** `Starting Relic → Battle I → Battle II → Boss`.
- **5 random starting relics** offered at the first node (chosen from a pool of 7).
- Turn-based card combat: energy, block, draw/discard, poison ticking, enemy intents.
- Post-fight card rewards (choose 1 of 3, or skip) and persistent run state (HP, deck, relics).

## How to Run

Native ES modules require an HTTP origin (they won't load from `file://`). From the repo root:

```sh
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Project Layout

```
index.html            # Screens + entry point (loads js/main.js as a module)
css/
  style.css           # All styling
js/
  main.js             # Boot: initializes the UI
  ui.js               # Rendering + screen flow (title, map, combat, rewards, relic pick, game over)
  state.js            # Run state + map construction
  combat.js           # Synchronous combat engine (energy, block, poison, intents, win/lose)
  cards.js            # Card data (CARD_DB) + starter deck + reward pool
  relics.js           # Relic data (RELIC_DB) + random relic choices
  enemies.js          # Enemy/boss data + encounter selection
```

## Gameplay Notes

- **Poison** deals damage equal to its stacks at the end of your turn (ignoring block), then loses 1 stack.
- **Block** absorbs incoming damage and resets each turn. **Dexterity** increases block gained; **Strength** increases attack damage.
- **Weak** reduces a combatant's attack damage by 25%; **Vulnerable** increases damage taken by 50%.
- Enemies telegraph their next move via **intents** shown above them.

## Relics (pool of 7; you pick 1 of 5 offered)

Serpent Ring, Toxic Vial, Winged Boots, Broken Hourglass, Blood Chalice, Crooked Coin, Venom Fang — each grants a passive that hooks into combat (extra poison, extra draw, starting block, energy, etc.).

## Spec

The design spec lives in [`.kiro/specs/browser-game/`](.kiro/specs/browser-game/). Note this slice intentionally uses a **single linear path** (as requested) rather than the branching map described in the original spec; the rest of the content ranges (card/enemy/relic counts) match.

## Deploying to S3

1. Create an S3 bucket and enable **Static website hosting** (index document `index.html`).
2. Upload the static files:
   ```sh
   aws s3 sync . s3://<bucket-name> --exclude ".kiro/*" --exclude ".git/*"
   ```
3. Serve via the bucket website endpoint (or front with CloudFront for HTTPS).

Ensure `.js` files are served with a JavaScript MIME type so native ES modules load correctly, and use a short/no-cache policy on `index.html` so edits appear on reload.
