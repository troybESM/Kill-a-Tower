# Browser Deckbuilder

A browser-based roguelike deckbuilder — a personal-use, Slay the Spire-style game — built with **vanilla HTML, CSS, and JavaScript** (native ES modules, no framework, no build step) and deployable as static files to an **Amazon S3 static website** bucket.

## Highlights

- **Zero build step.** Runs by opening `index.html` via a static file server — no bundler, transpiler, or framework.
- **Fully client-side.** No backend; all game state lives in the browser.
- **Data-driven content.** Cards, enemies, relics, and the map are defined in editable data files so you can tweak gameplay values without touching code, then just reload.
- **Deterministic, testable core.** Combat, map generation, rewards, relics, and run state are pure functions, covered by property-based tests.

## Vertical Slice Scope

- One playable character, 15–20 cards, 3–10 enemies + 1–3 bosses, 3–10 relics
- Turn-based card combat (energy, block, draw/discard, enemy intents)
- A short branching map ending in a boss
- Post-fight card rewards and persistent run state (HP, deck, relics)

## Project Layout (planned)

```
index.html            # Module entry point
src/
  main.js             # Boot: load + validate content, mount UI
  game-controller.js  # Screen state machine + run state
  prng.js             # Seedable PRNG
  content/            # Declarative data: cards, enemies, relics, character, map
  systems/            # Pure logic: content-loader, combat, map, rewards, relics, run-state
  screens/            # DOM rendering per screen
  ui/                 # DOM helpers
styles/               # CSS
assets/               # Images / audio
```

## Spec

The full spec lives in [`.kiro/specs/browser-game/`](.kiro/specs/browser-game/):

- `requirements.md` — 9 EARS requirements with a glossary
- `design.md` — architecture, data model, and 23 correctness properties
- `tasks.md` — incremental implementation plan

## Deploying to S3

1. Create an S3 bucket and enable **Static website hosting** (index document `index.html`, error document `error.html`).
2. Upload the static files:
   ```sh
   aws s3 sync . s3://<bucket-name> --exclude ".kiro/*" --exclude ".git/*"
   ```
3. Serve publicly via the bucket website endpoint (or front with CloudFront for HTTPS).

Ensure `.js` files are served with a JavaScript MIME type so native ES modules load correctly. Use a short/no-cache policy on `index.html` so edits appear on reload.
