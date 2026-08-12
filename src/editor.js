import './styles.css';
import './editor.css';
import { presets, defaultParams } from 'treegen/generator';
import { exportGlb, exportObj, exportGameGlb, exportForestGlb } from 'treegen/export';
import { createPlayground } from './playground.js';
import { checkHealth } from './mcp.js';
import { GROUPS, PARAMS, coerce } from './treegen-params.js';

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
  orbit: true,
  hud: ({ seed, tris, meshes, ms }) => {
    hudFields.seed.textContent = seed;
    hudFields.tris.textContent = tris.toLocaleString('en');
    hudFields.meshes.textContent = meshes;
    hudFields.ms.textContent = `${ms.toFixed(1)}ms`;
  },
});

/* --- URL state ------------------------------------------------------------- */
const paramByName = new Map(PARAMS.map((p) => [p.name, p]));

function readUrl() {
  const q = new URLSearchParams(location.search);
  const out = {};
  for (const [key, raw] of q) {
    const def = paramByName.get(key);
    if (def) out[key] = coerce(def, raw);
    else if (key === 'seed') out.seed = Math.min(999_999, Math.max(1, Math.floor(Number(raw) || 1)));
  }
  return out;
}

let urlTimer = 0;
function syncUrl(s) {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const q = new URLSearchParams();
    for (const def of PARAMS) {
      const value = s[def.name];
      const fallback = def.control === 'toggle' ? false : defaultParams[def.name];
      if (value !== undefined && value !== fallback) q.set(def.name, String(value));
    }
    q.set('seed', String(s.seed));
    history.replaceState(null, '', `?${q}`);
  }, 200);
}

/* --- state ----------------------------------------------------------------- */
// One state object is the single source of truth; every mutation goes through
// apply() so the viewport, form, and URL can never disagree.
const urlState = readUrl();
let state = { ...presets.oak, ...urlState };
if (urlState.seed === undefined) state.seed = randomSeed();
const listeners = [];

function apply(next = {}) {
  state = { ...state, ...next };
  if (Object.keys(next).some((k) => k !== 'seed')) {
    activePreset = null;
    syncChips();
  }
  try {
    playground.render({ ...state });
  } catch (err) {
    // Bad param combo: keep the previous tree, surface the reason in the HUD.
    hudFields.ms.textContent = err.message;
  }
  for (const fn of listeners) fn(state);
}
const onState = (fn) => listeners.push(fn);

onState(syncUrl);
$('[data-share]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  await navigator.clipboard.writeText(location.href);
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy link'; }, 1600);
});

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

/* --- schema-driven form ---------------------------------------------------- */
const form = $('[data-form]');

function buildControl(def) {
  const row = document.createElement('div');
  row.className = 'rig__row';
  row.dataset.param = def.name;
  if (def.help) row.title = def.help;

  const label = document.createElement('label');
  label.textContent = def.label;
  label.htmlFor = `p-${def.name}`;

  if (def.control === 'range') {
    const out = document.createElement('output');
    label.append(' ', out);
    const input = document.createElement('input');
    Object.assign(input, { id: `p-${def.name}`, type: 'range', min: def.min, max: def.max, step: def.step });
    input.addEventListener('input', () => apply({ [def.name]: coerce(def, input.value) }));
    onState((s) => {
      const v = s[def.name];
      // Presets may omit a param (e.g. oak carries no `age`); the generator
      // falls back internally, so show a dash instead of crashing on toFixed.
      if (v === undefined) {
        out.textContent = '—';
        return;
      }
      input.value = v;
      out.textContent = (Number.isInteger(v) ? v : v.toFixed(2)) + (def.unit ?? '');
    });
    row.append(label, input);
  } else if (def.control === 'select') {
    const select = document.createElement('select');
    select.id = `p-${def.name}`;
    // Reassigning data-param to the element playwright's selectOption targets.
    row.removeAttribute('data-param');
    select.dataset.param = def.name;
    def.options.forEach((opt, i) => {
      const o = document.createElement('option');
      o.value = String(opt);
      o.textContent = def.optionLabels?.[i] ?? String(opt);
      select.append(o);
    });
    select.addEventListener('input', () => apply({ [def.name]: coerce(def, select.value) }));
    onState((s) => { select.value = String(s[def.name]); });
    row.append(label, select);
  } else if (def.control === 'toggle') {
    const input = document.createElement('input');
    Object.assign(input, { id: `p-${def.name}`, type: 'checkbox' });
    input.addEventListener('input', () => apply({ [def.name]: input.checked }));
    onState((s) => { input.checked = Boolean(s[def.name]); });
    row.append(label, input);
  } else if (def.control === 'swatch') {
    const wrap = document.createElement('div');
    wrap.className = 'swatches';
    def.swatches.forEach((tones, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.value = i;
      b.style.background = `linear-gradient(90deg, ${tones.join(', ')})`;
      b.setAttribute('aria-label', `${def.label} ${i}`);
      b.addEventListener('click', () => apply({ [def.name]: i }));
      wrap.append(b);
    });
    onState((s) => {
      for (const b of wrap.children) b.setAttribute('aria-pressed', String(Number(b.dataset.value) === s[def.name]));
    });
    row.append(label, wrap);
  }
  return row;
}

for (const group of GROUPS) {
  const section = document.createElement('details');
  section.className = 'pgroup';
  section.open = true;
  const summary = document.createElement('summary');
  summary.textContent = group.title;
  section.append(summary);
  for (const def of PARAMS.filter((p) => p.group === group.id)) section.append(buildControl(def));
  form.append(section);
}

/* --- preset strip ---------------------------------------------------------- */
const presetMount = $('[data-presets]');
let activePreset = null;

function applyPreset(name) {
  activePreset = name;
  const preset = presets[name];
  const seed = seedLockedNow() ? state.seed : (preset.seed ?? state.seed);
  // Presets replace the whole param state, not merge — a preset without
  // brokenTop must clear a previously set brokenTop.
  state = { ...preset, seed };
  try {
    playground.render({ ...state, brokenTop: Boolean(state.brokenTop) });
  } catch (err) {
    hudFields.ms.textContent = err.message;
  }
  for (const fn of listeners) fn(state);
  syncChips();
}

function syncChips() {
  for (const chip of presetMount.children) {
    chip.setAttribute('aria-pressed', String(chip.dataset.preset === activePreset));
  }
}

for (const name of Object.keys(presets)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'preset-chip';
  chip.dataset.preset = name;
  chip.textContent = name;
  chip.addEventListener('click', () => applyPreset(name));
  presetMount.append(chip);
}

/* --- exports ---------------------------------------------------------------- */
function download(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORTERS = {
  glb: async () =>
    download(await exportGlb(playground.tree), `treegen_${state.species}_${state.seed}.glb`, 'model/gltf-binary'),
  obj: async () =>
    download(exportObj(playground.tree), `treegen_${state.species}_${state.seed}.obj`, 'text/plain'),
  game: async () =>
    download(await exportGameGlb({ ...state }), `treegen_${state.species}_${state.seed}_game.glb`, 'model/gltf-binary'),
  forest: async () =>
    download(
      await exportForestGlb({
        params: { ...state },
        count: Number($('[data-forest-count]').value),
        seedBase: state.seed,
        agedSpread: Number($('[data-forest-spread]').value),
      }),
      `treegen_forest_${state.seed}.glb`,
      'model/gltf-binary'
    ),
};

for (const button of document.querySelectorAll('[data-export]')) {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Exporting…';
    try {
      await EXPORTERS[button.dataset.export]();
      button.textContent = 'Downloaded';
    } catch (err) {
      console.error(err);
      button.textContent = 'Export failed';
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = label;
      }, 1600);
    }
  });
}

/* --- MCP snippet ------------------------------------------------------------ */
function buildMcpCall(tool) {
  const args = { seed: state.seed };
  for (const def of PARAMS) {
    const value = state[def.name];
    const fallback = def.control === 'toggle' ? false : defaultParams[def.name];
    if (value !== undefined && value !== fallback) args[def.name] = value;
  }
  return { tool, arguments: args };
}

$('[data-mcp-copy]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const call = buildMcpCall($('[data-mcp-tool]').value);
  await navigator.clipboard.writeText(JSON.stringify(call, null, 2));
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy MCP call'; }, 1600);
});

/* --- mobile bottom sheet ---------------------------------------------------- */
const panel = $('[data-panel]');
const sheetToggle = $('[data-sheet-toggle]');
const mobile = window.matchMedia('(max-width: 800px)');

function syncSheet() {
  const open = !mobile.matches || panel.classList.contains('editor__panel--open');
  sheetToggle.setAttribute('aria-expanded', String(open));
}
sheetToggle.addEventListener('click', () => {
  panel.classList.toggle('editor__panel--open');
  syncSheet();
});
mobile.addEventListener('change', syncSheet);
syncSheet();

/* --- test/debug hook ------------------------------------------------------- */
window.__treegenEditor = {
  getState: () => ({ ...state }),
  apply,
  buildMcpCall,
  PARAMS: PARAMS.map((p) => p.name),
  cameraPosition: () => {
    const { x, y, z } = playground.camera.position;
    return { x, y, z };
  },
};

apply();
