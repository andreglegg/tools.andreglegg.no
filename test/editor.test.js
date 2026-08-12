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
