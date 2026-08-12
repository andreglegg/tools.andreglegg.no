import './styles.css';
import './editor.css';
import { presets } from 'treegen/generator';
import { createPlayground } from './playground.js';
import { checkHealth } from './mcp.js';

const $ = (sel) => document.querySelector(sel);
const randomSeed = () => Math.floor(Math.random() * 999_999) + 1;

/* --- status light (same contract as the landing page) --------------------- */
const dot = $('[data-status-dot]');
const statusText = $('[data-status-text]');
async function refreshStatus() {
  const health = await checkHealth();
  dot.dataset.state = health.online ? 'online' : 'offline';
  statusText.textContent = health.online ? 'mcp online' : 'mcp offline';
}
refreshStatus();
setInterval(refreshStatus, 60_000);

/* --- playground ------------------------------------------------------------ */
const hudFields = {
  seed: $('[data-hud-seed]'),
  tris: $('[data-hud-tris]'),
  meshes: $('[data-hud-meshes]'),
  ms: $('[data-hud-ms]'),
};

const playground = createPlayground({
  canvas: $('[data-canvas]'),
  hud: ({ seed, tris, meshes, ms }) => {
    hudFields.seed.textContent = seed;
    hudFields.tris.textContent = tris.toLocaleString('en');
    hudFields.meshes.textContent = meshes;
    hudFields.ms.textContent = `${ms.toFixed(1)}ms`;
  },
});

/* --- state ----------------------------------------------------------------- */
// One state object is the single source of truth; every mutation goes through
// apply() so the viewport, form, and URL can never disagree.
let state = { ...presets.oak, seed: randomSeed() };
const listeners = [];

function apply(next = {}) {
  state = { ...state, ...next };
  try {
    playground.render({ ...state });
  } catch (err) {
    // Bad param combo: keep the previous tree, surface the reason in the HUD.
    hudFields.ms.textContent = err.message;
  }
  for (const fn of listeners) fn(state);
}
const onState = (fn) => listeners.push(fn);

/* --- seed controls --------------------------------------------------------- */
const seedInput = $('[data-seed]');
onState((s) => { seedInput.value = s.seed; });
seedInput.addEventListener('change', () => {
  const seed = Math.min(999_999, Math.max(1, Math.floor(Number(seedInput.value) || 1)));
  apply({ seed });
});
$('[data-reroll]').addEventListener('click', () => apply({ seed: randomSeed() }));

const lockButton = $('[data-lock]');
lockButton.addEventListener('click', () => {
  const locked = lockButton.getAttribute('aria-pressed') === 'true';
  lockButton.setAttribute('aria-pressed', String(!locked));
});
const seedLockedNow = () => lockButton.getAttribute('aria-pressed') === 'true';

/* --- test/debug hook ------------------------------------------------------- */
window.__treegenEditor = { getState: () => ({ ...state }), apply };

apply();
