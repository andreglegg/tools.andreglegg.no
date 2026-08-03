// The page's whole premise is that the playground renders without the server.
// A unit test of the generator would not catch a broken bundle, a missing
// canvas, or a CSS regression that hides the rig — so this drives a real
// browser against the built output.
//
// Requires a preview server: npm run build && npm run preview
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.PREVIEW_URL ?? 'http://localhost:4173/';

async function load(viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The status light legitimately fails when the host is offline; that is the
  // designed behaviour, not a page error.
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('mcp.andreglegg.no')) errors.push(text);
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}

test('playground renders a tree with no server', async () => {
  const { browser, page, errors } = await load({ width: 1440, height: 900 });

  const hud = await page.evaluate(() => ({
    seed: Number(document.querySelector('[data-hud-seed]').textContent),
    tris: document.querySelector('[data-hud-tris]').textContent,
    meshes: Number(document.querySelector('[data-hud-meshes]').textContent),
  }));

  assert.ok(hud.seed > 0, 'seed should be populated');
  assert.ok(Number(hud.tris.replace(/,/g, '')) > 100, 'triangles should be populated');
  assert.ok(hud.meshes > 0, 'meshes should be populated');
  assert.deepEqual(errors, [], 'no unexpected page errors');

  await browser.close();
});

test('changing a parameter rebuilds the mesh', async () => {
  const { browser, page } = await load({ width: 1440, height: 900 });

  const before = await page.textContent('[data-hud-tris]');
  await page.selectOption('#detail', '0');
  await page.waitForTimeout(400);
  const after = await page.textContent('[data-hud-tris]');

  assert.notEqual(before, after, 'detail 0 should change the triangle count');
  await browser.close();
});

test('catalog lists every tool and the page does not scroll sideways on mobile', async () => {
  const { browser, page } = await load({ width: 390, height: 844 });

  assert.equal(await page.locator('.card').count(), 2);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  assert.equal(overflows, false, 'no horizontal overflow at 390px');

  await browser.close();
});
