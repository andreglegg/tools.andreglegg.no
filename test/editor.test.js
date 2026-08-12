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
