// Browser tests for the /treegen/ editor page. Same premise as render.test.js:
// only a real browser against the built output catches a broken bundle.
// Requires: npm run build && npm run preview
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { statSync } from 'node:fs';

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
