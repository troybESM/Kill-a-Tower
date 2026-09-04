// Entry point for Kill a Tower.
import { initUI } from './ui.js';
import { assertCardDbValid } from './cards.js';

// Surface a fatal loading error on-screen instead of a blank page
// (spec Req 2.3 / 4.3: the game must fail to start visibly if content is invalid).
function showFatalError(err) {
  const app = document.getElementById('app');
  const msg = (err && err.message) ? err.message : String(err);
  const html = `
    <div class="fatal-error">
      <h1>⚠ Kill a Tower failed to start</h1>
      <p>The game content is invalid, so the run cannot begin.</p>
      <pre>${msg.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</pre>
    </div>`;
  if (app) app.innerHTML = html;
  else document.body.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    // Content-count / integrity guard before we touch the UI.
    assertCardDbValid();
    initUI();
  } catch (err) {
    console.error(err);
    showFatalError(err);
  }
});
