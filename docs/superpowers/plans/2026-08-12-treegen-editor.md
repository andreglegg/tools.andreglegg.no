# Treegen Full Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated `/treegen/` editor page exposing treegen's full 18-param surface and all four exports (GLB, OBJ, game GLB, forest GLB) plus an MCP-call snippet, per `docs/superpowers/specs/2026-08-12-treegen-editor-design.md`.

**Architecture:** Second Vite page (`treegen/index.html` → `/treegen/`) in the same repo, sharing `playground.js`/`mcp.js`/`styles.css`. A schema-driven param registry (`src/treegen-params.js`) renders the whole form; `src/editor.js` owns state, URL sync, presets, and exports. Everything runs client-side.

**Tech Stack:** Vanilla JS, Vite 7 multi-page, three.js ^0.168 (`three/addons` for OrbitControls), treegen via `treegen/generator` + `treegen/export`, node:test + Playwright browser tests against `npm run preview`.

## Global Constraints

- Vanilla JS only — no frameworks, no new npm dependencies.
- Follow existing code style: `data-*` attribute hooks, `const $ = (sel) => document.querySelector(sel)`, small focused modules, sentence-case UI copy.
- Seed range is 1–999999 (`Math.floor(Math.random() * 999_999) + 1`).
- treegen exports used: `buildTree, meshStats, presets, defaultParams, leafPalettes, barkPalettes` from `treegen/generator`; `exportGlb(group), exportObj(group), exportGameGlb(params), exportForestGlb({params, count, seedBase, agedSpread})` from `treegen/export`.
- All tests run against the built site: `npm run build && npm run preview` must be running (port 4173) before `npm test`. Run this yourself before each test step.
- Editor page URL: `http://localhost:4173/treegen/` in tests (`PREVIEW_URL_EDITOR` env override).
- Download filenames: `treegen_<species>_<seed>.glb|.obj`, `treegen_<species>_<seed>_game.glb`, `treegen_forest_<seed>.glb`.
- Commit after every task with the message given in the task.

---

### Task 1: Multi-page scaffold — `/treegen/` page renders a tree

**Files:**
- Create: `vite.config.js`
- Create: `treegen/index.html`
- Create: `src/editor.css`
- Create: `src/editor.js`
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `createPlayground({ canvas, hud })` from `src/playground.js` (unchanged), `checkHealth` from `src/mcp.js`, `presets` from `treegen/generator`.
- Produces: the editor page shell with `[data-canvas]`, HUD fields (`data-hud-seed/tris/meshes/ms`), empty `[data-form]`, `[data-presets]`, seed controls (`[data-seed] [data-reroll] [data-lock] [data-share]`), export bar (`[data-exports]`), status dot. `src/editor.js` exposes `window.__treegenEditor = { getState, apply }` for tests and later tasks: `getState() → object` (full current params incl. seed), `apply(partial) → void` (merge + re-render, generator errors caught and shown in the HUD ms field). Module-level helpers later tasks use: `onState(fn)` (subscribe to state changes) and `seedLockedNow() → boolean`.

- [ ] **Step 1: Write the failing test**

Create `test/editor.test.js`:

```js
// Browser tests for the /treegen/ editor page. Same premise as render.test.js:
// only a real browser against the built output catches a broken bundle.
// Requires: npm run build && npm run preview
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.PREVIEW_URL_EDITOR ?? 'http://localhost:4173/treegen/';

export async function loadEditor({ viewport = { width: 1440, height: 900 }, query = '' } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('mcp.andreglegg.no')) errors.push(text);
  });
  await page.goto(URL + query, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}

test('editor page renders a tree', async () => {
  const { browser, page, errors } = await loadEditor();

  const hud = await page.evaluate(() => ({
    seed: Number(document.querySelector('[data-hud-seed]').textContent),
    tris: document.querySelector('[data-hud-tris]').textContent,
    meshes: Number(document.querySelector('[data-hud-meshes]').textContent),
  }));

  assert.ok(hud.seed >= 1, 'seed populated');
  assert.ok(Number(hud.tris.replace(/,/g, '')) > 100, 'triangles populated');
  assert.ok(hud.meshes > 0, 'meshes populated');
  assert.deepEqual(errors, [], 'no unexpected page errors');
  await browser.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — `/treegen/` is a 404, HUD selectors missing.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      // Two pages, one build: the landing page and the /treegen/ editor.
      input: { main: r('index.html'), treegen: r('treegen/index.html') },
    },
  },
});
```

- [ ] **Step 4: Create `treegen/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Treegen editor — Andre Glegg</title>
    <meta name="description" content="Full-parameter editor for treegen. Every species, palette, and export format, running in your browser." />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>🌳</text></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="editor-body">
    <header class="edbar">
      <a class="edbar__back" href="/">← tools</a>
      <div class="edbar__presets" data-presets></div>
      <div class="edbar__seed">
        <label class="edbar__seedfield">seed
          <input data-seed type="number" min="1" max="999999" inputmode="numeric" />
        </label>
        <button type="button" data-lock aria-pressed="false" title="Keep this seed when loading presets">Lock</button>
        <button type="button" data-reroll>Reroll</button>
        <button type="button" data-share>Copy link</button>
      </div>
      <div class="edbar__host">
        <span class="dot" data-status-dot aria-hidden="true"></span>
        <span data-status-text>checking</span>
      </div>
    </header>

    <main class="editor">
      <div class="editor__viewport">
        <canvas data-canvas aria-label="Live preview of the generated tree"></canvas>
        <dl class="hud" data-hud>
          <div><dt>seed</dt><dd data-hud-seed>—</dd></div>
          <div><dt>tris</dt><dd data-hud-tris>—</dd></div>
          <div><dt>meshes</dt><dd data-hud-meshes>—</dd></div>
          <div><dt>build</dt><dd data-hud-ms>—</dd></div>
        </dl>
      </div>

      <aside class="editor__panel" data-panel>
        <button type="button" class="editor__sheet-toggle" data-sheet-toggle aria-expanded="true">Parameters</button>
        <form class="editor__form" data-form></form>
        <div class="editor__exports" data-exports></div>
      </aside>
    </main>

    <script type="module" src="/src/editor.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/editor.css`** (layout only; visual language comes from `styles.css`)

```css
/* Editor app layout: full-viewport canvas, panel docked right, slim top bar. */
.editor-body { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

.edbar {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.5rem 1rem; border-bottom: 1px solid var(--line, #2a2a2a);
  flex-wrap: wrap;
}
.edbar__back { white-space: nowrap; }
.edbar__presets { display: flex; gap: 0.35rem; overflow-x: auto; flex: 1; min-width: 0; }
.edbar__seed { display: flex; align-items: center; gap: 0.4rem; }
.edbar__seedfield input { width: 6.5em; }
.edbar__host { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }

.editor { flex: 1; display: flex; min-height: 0; }
.editor__viewport { flex: 1; position: relative; min-width: 0; }
.editor__viewport canvas { width: 100%; height: 100%; display: block; touch-action: none; }
.editor__viewport .hud { position: absolute; left: 1rem; bottom: 1rem; }

.editor__panel {
  width: 340px; display: flex; flex-direction: column;
  border-left: 1px solid var(--line, #2a2a2a); min-height: 0;
}
.editor__sheet-toggle { display: none; }
.editor__form { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.editor__exports { border-top: 1px solid var(--line, #2a2a2a); padding: 0.75rem 1rem; }

.pgroup { margin-bottom: 0.75rem; }
.pgroup summary { cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; }

.preset-chip { white-space: nowrap; }
.preset-chip[aria-pressed='true'] { outline: 2px solid currentColor; }

.swatches { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.swatch { width: 2rem; height: 1.25rem; border-radius: 4px; border: 1px solid transparent; padding: 0; }
.swatch[aria-pressed='true'] { border-color: currentColor; outline: 2px solid currentColor; }
```

- [ ] **Step 6: Create `src/editor.js`** (minimal: state + playground + HUD + seed wiring; form/presets/exports come in later tasks)

```js
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS. Also run `node --test --test-timeout=20000 test/render.test.js` — the landing page must be unaffected by the multi-page config.

- [ ] **Step 8: Commit**

```bash
git add vite.config.js treegen/index.html src/editor.css src/editor.js test/editor.test.js
git commit -m "feat: /treegen/ editor page scaffold — second Vite page with live viewport"
```

---

### Task 2: Param registry + schema-driven form

**Files:**
- Create: `src/treegen-params.js`
- Modify: `src/editor.js` (add form rendering)
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `apply`, `onState`, `[data-form]` from Task 1; `leafPalettes, barkPalettes` from `treegen/generator`.
- Produces: `GROUPS` (`{id, title}[]`) and `PARAMS` (`{name, group, control, label, min?, max?, step?, unit?, options?, optionLabels?, swatches?, help?}[]`) from `src/treegen-params.js`; `coerce(def, raw)` exported from the same file (range/swatch → Number, toggle → Boolean, select → Number iff its options are numbers). Every control in the DOM carries `data-param="<name>"`. Test hook gains `window.__treegenEditor.PARAMS` (names only).

- [ ] **Step 1: Write the failing tests** (append to `test/editor.test.js`)

```js
test('every registry param renders exactly one control', async () => {
  const { browser, page } = await loadEditor();

  const names = await page.evaluate(() => window.__treegenEditor.PARAMS);
  assert.ok(names.length >= 17, `expected full surface, got ${names.length}`);
  for (const name of names) {
    assert.equal(
      await page.locator(`[data-param="${name}"]`).count(), 1,
      `control for ${name}`
    );
  }
  await browser.close();
});

test('changing detail via the form rebuilds the mesh', async () => {
  const { browser, page } = await loadEditor();

  const before = await page.textContent('[data-hud-tris]');
  await page.selectOption('[data-param="detail"]', '0');
  await page.waitForTimeout(400);
  const after = await page.textContent('[data-hud-tris]');

  assert.notEqual(before, after, 'detail 0 changes triangle count');
  await browser.close();
});

test('palette swatch click updates state', async () => {
  const { browser, page } = await loadEditor();

  await page.click('[data-param="leafPalette"] .swatch[data-value="3"]');
  const state = await page.evaluate(() => window.__treegenEditor.getState());
  assert.equal(state.leafPalette, 3);
  await browser.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — `PARAMS` undefined, no controls.

- [ ] **Step 3: Create `src/treegen-params.js`**

```js
// The registry mirrors paramShape in treegen's mcp/server.js. One line here
// per generator param: the form, value outputs, URL state, and MCP snippet
// all render from this table. Seed is deliberately absent — it lives in the
// top bar, not the panel.
import { leafPalettes, barkPalettes } from 'treegen/generator';

export const GROUPS = [
  { id: 'shape', title: 'Shape' },
  { id: 'trunk', title: 'Trunk & branches' },
  { id: 'foliage', title: 'Foliage' },
  { id: 'color', title: 'Color' },
  { id: 'wear', title: 'Age & condition' },
];

const SPECIES = ['round', 'oak', 'acacia', 'willow', 'pine', 'birch', 'poplar', 'palm', 'baobab'];
const LEAF_STYLES = ['clustered', 'angular', 'rounded', 'flat', 'needles'];

export const PARAMS = [
  { name: 'species', group: 'shape', control: 'select', options: SPECIES, label: 'Species' },
  { name: 'height', group: 'shape', control: 'range', min: 2, max: 50, step: 0.1, unit: 'm', label: 'Height', help: 'Above ~15m the trunk blends toward columnar giant proportions' },
  { name: 'canopySize', group: 'shape', control: 'range', min: 0.9, max: 8, step: 0.05, label: 'Canopy' },
  { name: 'lean', group: 'shape', control: 'range', min: 0, max: 0.55, step: 0.01, label: 'Lean' },
  { name: 'detail', group: 'shape', control: 'select', options: [0, 1, 2], optionLabels: ['0 — low-poly', '1 — game-ready', '2 — hero'], label: 'Detail' },

  { name: 'trunkRadius', group: 'trunk', control: 'range', min: 0.15, max: 2.5, step: 0.01, label: 'Trunk radius' },
  { name: 'branchCount', group: 'trunk', control: 'range', min: 4, max: 18, step: 1, label: 'Branches' },
  { name: 'branchSpread', group: 'trunk', control: 'range', min: 0.45, max: 2.2, step: 0.01, label: 'Spread' },

  { name: 'leafDensity', group: 'foliage', control: 'range', min: 0, max: 64, step: 1, label: 'Foliage', help: '0 = bare winter tree: terminals grow fine twigs instead of leaves' },
  { name: 'leafStyle', group: 'foliage', control: 'select', options: LEAF_STYLES, label: 'Leaf style' },
  { name: 'leafShape', group: 'foliage', control: 'range', min: 0.15, max: 1, step: 0.01, label: 'Leaf roundness' },
  { name: 'leafSize', group: 'foliage', control: 'range', min: 0.45, max: 1.7, step: 0.01, label: 'Leaf size' },
  { name: 'leafVariation', group: 'foliage', control: 'range', min: 0, max: 1, step: 0.01, label: 'Variation' },

  { name: 'leafPalette', group: 'color', control: 'swatch', swatches: leafPalettes, label: 'Leaf palette' },
  { name: 'barkPalette', group: 'color', control: 'swatch', swatches: barkPalettes, label: 'Bark palette' },

  { name: 'age', group: 'wear', control: 'range', min: 0, max: 1, step: 0.01, label: 'Age', help: '0 sapling, 0.5 mature, 1 ancient — drives slenderness, droop, gnarl, buttressing' },
  { name: 'brokenTop', group: 'wear', control: 'toggle', label: 'Broken top', help: 'Snap the trunk at ~70% height — a standing-dead snag' },
];

// Form values arrive as strings/booleans; coerce them to what buildTree expects.
export function coerce(def, raw) {
  if (def.control === 'range' || def.control === 'swatch') return Number(raw);
  if (def.control === 'toggle') return raw === true || raw === 'true';
  if (def.control === 'select' && typeof def.options[0] === 'number') return Number(raw);
  return raw;
}
```

- [ ] **Step 4: Add form rendering to `src/editor.js`**

Add the imports:

```js
import { GROUPS, PARAMS, coerce } from './treegen-params.js';
```

Add after the seed-controls section:

```js
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
      input.value = s[def.name];
      const v = s[def.name];
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
```

Update the test hook line to include param names:

```js
window.__treegenEditor = { getState: () => ({ ...state }), apply, PARAMS: PARAMS.map((p) => p.name) };
```

Note: the final `apply()` call must run AFTER the form is built so `onState` subscribers populate initial control values — keep `apply()` as the last line of the file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/treegen-params.js src/editor.js test/editor.test.js
git commit -m "feat: schema-driven param panel — full 17-param surface from one registry"
```

---

### Task 3: Orbit controls in the viewport

**Files:**
- Modify: `src/playground.js`
- Modify: `src/editor.js` (pass `orbit: true`)
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `createPlayground` internals from Task 1 usage.
- Produces: `createPlayground({ canvas, hud, onParams, orbit = false })` — when `orbit` is true, drag orbits, wheel zooms, auto-rotate stops permanently on first interaction, and `frame()` stops repositioning the camera after the user has moved it (the tree still recenters; the user can zoom out themselves). New getters on the returned object: `get tree()` (current THREE.Group) and `get camera()`. `window.__treegenEditor.cameraPosition()` returns `{x, y, z}` for tests. Landing page behavior unchanged (`orbit` defaults false).

- [ ] **Step 1: Write the failing test** (append to `test/editor.test.js`)

```js
test('dragging the viewport orbits the camera and stops auto-rotate', async () => {
  const { browser, page } = await loadEditor();

  const before = await page.evaluate(() => window.__treegenEditor.cameraPosition());
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(700, 400, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__treegenEditor.cameraPosition());

  assert.notDeepEqual(before, after, 'camera moved after drag');
  await browser.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — `cameraPosition` undefined; camera fixed.

- [ ] **Step 3: Extend `src/playground.js`**

Add the import at the top:

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Change the signature and add controls state:

```js
export function createPlayground({ canvas, hud, onParams, orbit = false }) {
```

After the lights are added, replace the plain auto-rotate machinery:

```js
  let autoRotate = !REDUCED_MOTION;
  let userMoved = false;
  let controls = null;
  if (orbit) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.addEventListener('start', () => {
      autoRotate = false;
      userMoved = true;
    });
  }
```

In `frame(group, height)`, guard the camera reposition (the recentering of the group stays unconditional):

```js
    if (!userMoved) {
      const radius = Math.max(size.x, size.y, size.z) * 0.5;
      const dist = radius / Math.sin((camera.fov * Math.PI) / 360);
      camera.position.set(0, height * 0.1, dist * 1.42);
      camera.lookAt(0, 0, 0);
    }
```

In `loop()`:

```js
  function loop() {
    raf = requestAnimationFrame(loop);
    if (autoRotate) pivot.rotation.y += 0.0025;
    controls?.update();
    renderer.render(scene, camera);
  }
```

Add to the returned object:

```js
    get tree() {
      return current;
    },
    get camera() {
      return camera;
    },
```

And dispose the controls in `dispose()`: `controls?.dispose();`

- [ ] **Step 4: Wire it in `src/editor.js`**

Pass the flag: `createPlayground({ canvas: $('[data-canvas]'), orbit: true, hud: ... })`.

Extend the hook:

```js
window.__treegenEditor = {
  getState: () => ({ ...state }),
  apply,
  PARAMS: PARAMS.map((p) => p.name),
  cameraPosition: () => {
    const { x, y, z } = playground.camera.position;
    return { x, y, z };
  },
};
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && npm test`
Expected: PASS, including `test/render.test.js` (landing page untouched — it does not pass `orbit`).

- [ ] **Step 6: Commit**

```bash
git add src/playground.js src/editor.js test/editor.test.js
git commit -m "feat: orbit controls in the editor viewport, auto-rotate until first touch"
```

---

### Task 4: Preset strip + seed lock behavior

**Files:**
- Modify: `src/editor.js`
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `apply`, `onState`, `seedLocked`, `[data-presets]` from Task 1; `presets` from `treegen/generator`.
- Produces: one `button.preset-chip[data-preset="<name>"]` per treegen preset; clicking replaces the whole param state (`applyPreset(name)`), keeping the current seed iff the lock is pressed. The active chip carries `aria-pressed="true"` until any param is edited.

- [ ] **Step 1: Write the failing tests** (append to `test/editor.test.js`)

```js
test('preset chips load full preset params', async () => {
  const { browser, page } = await loadEditor();

  const chips = await page.locator('.preset-chip').count();
  assert.ok(chips >= 14, `all treegen presets present, got ${chips}`);

  await page.click('[data-preset="snag"]');
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => window.__treegenEditor.getState());
  assert.equal(state.brokenTop, true, 'snag sets brokenTop');
  assert.equal(state.leafDensity, 0, 'snag is bare');
  assert.equal(state.seed, 4788, 'unlocked: preset seed wins');

  // Sync guard: every param a preset carries must have a registry control,
  // or a new treegen param would silently miss the editor.
  const missing = await page.evaluate(() => {
    const names = new Set(window.__treegenEditor.PARAMS);
    return Object.keys(window.__treegenEditor.getState()).filter(
      (k) => k !== 'seed' && !names.has(k)
    );
  });
  assert.deepEqual(missing, [], 'every preset param has a registry control');
  await browser.close();
});

test('seed lock survives preset loads', async () => {
  const { browser, page } = await loadEditor();

  await page.fill('[data-seed]', '4242');
  await page.press('[data-seed]', 'Enter');
  await page.click('[data-lock]');
  await page.click('[data-preset="giant"]');
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => window.__treegenEditor.getState());
  assert.equal(state.species, 'pine', 'giant preset loaded');
  assert.equal(state.seed, 4242, 'locked seed kept');
  await browser.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — no `.preset-chip` elements.

- [ ] **Step 3: Add the preset strip to `src/editor.js`**

Add after the form-building block:

```js
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
```

One supporting edit elsewhere in the file — editing any param must clear the active chip. Update `apply()` (keeping its try/catch):

```js
function apply(next = {}) {
  state = { ...state, ...next };
  if (Object.keys(next).some((k) => k !== 'seed')) {
    activePreset = null;
    syncChips();
  }
  try {
    playground.render({ ...state });
  } catch (err) {
    hudFields.ms.textContent = err.message;
  }
  for (const fn of listeners) fn(state);
}
```

`syncChips` is referenced before its definition — that's fine (function hoisting), but the chips don't exist on the first `apply()`; `presetMount.children` is just empty then.

Caveat honored from treegen's contract: `playground.render` merges, it never deletes keys — that's why `applyPreset` passes `brokenTop: Boolean(state.brokenTop)` explicitly (an absent `brokenTop` in the preset must override a previous `true`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor.js test/editor.test.js
git commit -m "feat: preset strip from treegen presets, with seed lock"
```

---

### Task 5: Shareable URLs

**Files:**
- Modify: `src/editor.js`
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `apply`, `onState`, `state`, `PARAMS`, `coerce`, `[data-share]` from earlier tasks; `defaultParams` from `treegen/generator`.
- Produces: query-string round-trip. Non-default params (vs `defaultParams`) plus `seed` serialize into `location.search` via debounced `history.replaceState`; on load, query params override the default preset and `seed` in the URL suppresses the random seed. `[data-share]` copies `location.href`.

- [ ] **Step 1: Write the failing tests** (append to `test/editor.test.js`)

```js
test('URL params drive the initial tree', async () => {
  const { browser, page } = await loadEditor({ query: '?species=palm&seed=123&brokenTop=true' });

  const state = await page.evaluate(() => window.__treegenEditor.getState());
  assert.equal(state.species, 'palm');
  assert.equal(state.seed, 123);
  assert.equal(state.brokenTop, true);
  assert.equal(await page.textContent('[data-hud-seed]'), '123');
  await browser.close();
});

test('edits serialize into the URL', async () => {
  const { browser, page } = await loadEditor();

  await page.selectOption('[data-param="species"]', 'baobab');
  await page.waitForTimeout(500);
  const search = await page.evaluate(() => location.search);
  assert.ok(search.includes('species=baobab'), `species in URL, got ${search}`);
  assert.ok(/seed=\d+/.test(search), 'seed always in URL');
  await browser.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — query ignored, URL never written.

- [ ] **Step 3: Implement in `src/editor.js`**

Add `defaultParams` to the treegen import:

```js
import { presets, defaultParams } from 'treegen/generator';
```

Add URL helpers above the state section:

```js
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
```

Change the initial state to honor the URL:

```js
const urlState = readUrl();
let state = { ...presets.oak, ...urlState };
if (urlState.seed === undefined) state.seed = randomSeed();
```

Subscribe the serializer and wire the share button (place after `onState` exists):

```js
onState(syncUrl);
$('[data-share]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  await navigator.clipboard.writeText(location.href);
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy link'; }, 1600);
});
```

Ordering constraint: `readUrl` uses `paramByName`, so the `PARAMS` import and the URL-helpers block must sit above the state initialization. `applyPreset` also serializes (its listener loop includes `syncUrl` once subscribed) — no extra code needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor.js test/editor.test.js
git commit -m "feat: shareable editor URLs — non-default params round-trip the query string"
```

---

### Task 6: Export panel — GLB, OBJ, game GLB, forest GLB

**Files:**
- Modify: `treegen/index.html` (export bar markup)
- Modify: `src/editor.js` (export wiring)
- Modify: `src/editor.css` (export bar rows)
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `playground.tree` getter (Task 3), `state`; `exportGlb, exportObj, exportGameGlb, exportForestGlb` from `treegen/export`.
- Produces: `[data-export="glb"|"obj"|"game"|"forest"]` buttons, `[data-forest-count]` (number, default 9) and `[data-forest-spread]` (range 0–1, default 0.35) inputs. Downloads named per the Global Constraints convention. Buttons show `Exporting… / Downloaded / Export failed` inline states.

- [ ] **Step 1: Write the failing tests** (append to `test/editor.test.js`)

```js
import { statSync } from 'node:fs';

async function expectDownload(page, selector, namePattern) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click(selector),
  ]);
  assert.match(download.suggestedFilename(), namePattern);
  const file = await download.path();
  assert.ok(statSync(file).size > 500, `${selector} produced a non-trivial file`);
}

test('all four exports download real files', async () => {
  const { browser, page } = await loadEditor({ query: '?seed=77' });

  // Small forest keeps the test fast.
  await page.fill('[data-forest-count]', '3');

  await expectDownload(page, '[data-export="glb"]', /^treegen_oak_77\.glb$/);
  await expectDownload(page, '[data-export="obj"]', /^treegen_oak_77\.obj$/);
  await expectDownload(page, '[data-export="game"]', /^treegen_oak_77_game\.glb$/);
  await expectDownload(page, '[data-export="forest"]', /^treegen_forest_77\.glb$/);
  await browser.close();
});
```

(`import { statSync }` goes at the top of the test file with the other imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — export buttons don't exist.

- [ ] **Step 3: Add the export bar markup**

Replace `<div class="editor__exports" data-exports></div>` in `treegen/index.html` with:

```html
<div class="editor__exports" data-exports>
  <div class="exports__row">
    <button type="button" data-export="glb">GLB</button>
    <button type="button" data-export="obj">OBJ</button>
    <button type="button" data-export="game" title="Merged 2-draw-call game mesh with LOD0–2">Game GLB</button>
    <button type="button" data-export="forest" title="A batch of seed variations in one file">Forest GLB</button>
  </div>
  <div class="exports__forest">
    <label>count <input data-forest-count type="number" min="2" max="64" value="9" /></label>
    <label>aged spread <input data-forest-spread type="range" min="0" max="1" step="0.05" value="0.35" /></label>
  </div>
</div>
```

Add to `src/editor.css`:

```css
.exports__row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.exports__forest { display: flex; gap: 1rem; align-items: center; font-size: 0.8rem; }
.exports__forest input[type='number'] { width: 4em; }
```

- [ ] **Step 4: Wire exports in `src/editor.js`**

Add the import:

```js
import { exportGlb, exportObj, exportGameGlb, exportForestGlb } from 'treegen/export';
```

Add after the preset strip block:

```js
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
```

Note: `exportGlb`/`exportGameGlb`/`exportForestGlb` return ArrayBuffers, `exportObj` returns a string — `download()` normalizes both.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS. If the forest export exceeds the 20s test timeout even at count 3, raise only that test's timeout via `test('...', { timeout: 60_000 }, async () => …)` rather than the global flag.

- [ ] **Step 6: Commit**

```bash
git add treegen/index.html src/editor.css src/editor.js test/editor.test.js
git commit -m "feat: export panel — GLB, OBJ, game GLB with LODs, forest GLB, all in-browser"
```

---

### Task 7: Copy MCP call snippet

**Files:**
- Modify: `treegen/index.html` (snippet row)
- Modify: `src/editor.js` (`buildMcpCall` + copy wiring)
- Test: `test/editor.test.js`

**Interfaces:**
- Consumes: `state`, `PARAMS`, `defaultParams`, `[data-exports]` markup from Task 6.
- Produces: `buildMcpCall(toolName) → { tool, arguments }` where `arguments` holds `seed` plus every param that differs from `defaultParams` (toggle fallback `false`); exposed as `window.__treegenEditor.buildMcpCall`. UI: `[data-mcp-tool]` select (`generate_tree` default, `export_game_tree`) and `[data-mcp-copy]` button that copies `JSON.stringify(call, null, 2)`.

- [ ] **Step 1: Write the failing test** (append to `test/editor.test.js`)

```js
test('MCP snippet contains only non-default params plus seed', async () => {
  const { browser, page } = await loadEditor({ query: '?species=palm&lean=0.4&seed=55' });

  const call = await page.evaluate(() => window.__treegenEditor.buildMcpCall('generate_tree'));
  assert.equal(call.tool, 'generate_tree');
  assert.equal(call.arguments.seed, 55);
  assert.equal(call.arguments.species, 'palm');
  assert.equal(call.arguments.lean, 0.4);
  // Initial state is presets.oak, so oak params that differ from defaultParams
  // (meadow-based) legitimately appear too. detail is 1 in both — must be absent.
  assert.ok(!('detail' in call.arguments), 'default detail omitted');
  assert.ok(!('brokenTop' in call.arguments), 'unset toggle omitted');
  await browser.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: FAIL — `buildMcpCall` undefined.

- [ ] **Step 3: Implement in `src/editor.js` and `treegen/index.html`**

Append inside the `[data-exports]` div in `treegen/index.html`:

```html
  <div class="exports__mcp">
    <select data-mcp-tool aria-label="MCP tool">
      <option value="generate_tree" selected>generate_tree</option>
      <option value="export_game_tree">export_game_tree</option>
    </select>
    <button type="button" data-mcp-copy>Copy MCP call</button>
  </div>
```

Add to `src/editor.css`:

```css
.exports__mcp { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
```

Add to `src/editor.js` after the exporters block:

```js
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
```

Add `buildMcpCall` to the `window.__treegenEditor` hook object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run build && (npm run preview &) && sleep 2 && node --test --test-timeout=20000 test/editor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add treegen/index.html src/editor.css src/editor.js test/editor.test.js
git commit -m "feat: copy-ready MCP call snippet built from non-default params"
```

---

### Task 8: Mobile bottom sheet, landing-page link, README

**Files:**
- Modify: `src/editor.css` (bottom-sheet media query)
- Modify: `src/editor.js` (sheet toggle)
- Modify: `index.html` (editor link in the hero rig)
- Modify: `README.md` (one line about the editor page)
- Test: `test/editor.test.js`, `test/render.test.js`

**Interfaces:**
- Consumes: `[data-panel]`, `[data-sheet-toggle]` markup from Task 1.
- Produces: below 800px the panel is a bottom sheet (collapsed by default, `.editor__panel--open` expands it; the toggle button reflects `aria-expanded`). Landing page rig gains `<a class="ghost" href="/treegen/">Open the full editor →</a>`.

- [ ] **Step 1: Write the failing tests**

Append to `test/editor.test.js`:

```js
test('mobile: no sideways scroll, panel opens as a bottom sheet', async () => {
  const { browser, page } = await loadEditor({ viewport: { width: 390, height: 844 } });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  assert.equal(overflows, false, 'no horizontal overflow at 390px');

  assert.equal(await page.getAttribute('[data-sheet-toggle]', 'aria-expanded'), 'false');
  await page.click('[data-sheet-toggle]');
  assert.equal(await page.getAttribute('[data-sheet-toggle]', 'aria-expanded'), 'true');
  assert.ok(await page.locator('[data-param="species"]').isVisible(), 'form visible when open');
  await browser.close();
});
```

Append to `test/render.test.js`:

```js
test('landing page links to the full editor', async () => {
  const { browser, page } = await load({ width: 1440, height: 900 });
  const href = await page.getAttribute('a[href="/treegen/"]', 'href');
  assert.equal(href, '/treegen/');
  await browser.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && (npm run preview &) && sleep 2 && npm test`
Expected: FAIL — `aria-expanded` is `"true"` on mobile (no sheet behavior), landing link missing.

- [ ] **Step 3: Implement**

`src/editor.css` — append:

```css
@media (max-width: 800px) {
  .editor { flex-direction: column; }
  .editor__panel {
    position: fixed; left: 0; right: 0; bottom: 0; width: auto;
    max-height: 70dvh; border-left: 0; border-top: 1px solid var(--line, #2a2a2a);
    background: var(--bg, #111); z-index: 10;
    transform: translateY(calc(100% - 2.75rem));
    transition: transform 0.25s ease;
  }
  .editor__panel--open { transform: translateY(0); }
  .editor__sheet-toggle { display: block; width: 100%; padding: 0.6rem; }
  .edbar__presets { order: 4; flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .editor__panel { transition: none; }
}
```

`src/editor.js` — add:

```js
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
```

`index.html` — inside `<div class="rig__actions">`, after the download button:

```html
  <a class="ghost" href="/treegen/">Open the full editor →</a>
```

`README.md` — add one line under the existing description: `The full-parameter editor lives at [/treegen/](https://tools.andreglegg.no/treegen/) — every generator param, palette swatches, presets, and all export formats, running client-side.`

- [ ] **Step 4: Run the whole suite**

Run: `npm run build && (npm run preview &) && sleep 2 && npm test`
Expected: PASS — all editor tests and all landing-page tests.

- [ ] **Step 5: Commit**

```bash
git add src/editor.css src/editor.js index.html README.md test/editor.test.js test/render.test.js
git commit -m "feat: mobile bottom sheet + landing link to the full editor"
```

---

## Final verification (after Task 8)

- [ ] `npm run build && (npm run preview &) && sleep 2 && npm test` — full suite green.
- [ ] Manual spot-check at `http://localhost:4173/treegen/`: orbit, preset chips, swatches, one export, copy MCP call.
- [ ] Do NOT push — pushing deploys to GitHub Pages; the user decides when to ship.
