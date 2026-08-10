import './styles.css';
import { createPlayground } from './playground.js';
import { checkHealth, callTool } from './mcp.js';
import { renderCatalog } from './catalog.js';

const $ = (sel) => document.querySelector(sel);

/* --- status light --------------------------------------------------------- */
const dot = $('[data-status-dot]');
const statusText = $('[data-status-text]');

async function refreshStatus() {
  const health = await checkHealth();
  dot.dataset.state = health.online ? 'online' : 'offline';
  statusText.textContent = health.online
    ? 'mcp.andreglegg.no online'
    : `mcp.andreglegg.no offline — ${health.reason}`;
}
refreshStatus();
setInterval(refreshStatus, 60_000);

/* --- playground ----------------------------------------------------------- */
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

const rig = $('[data-rig]');
const outputs = rig.querySelectorAll('[data-out]');

function readRig() {
  const data = new FormData(rig);
  return {
    species: data.get('species'),
    detail: Number(data.get('detail')),
    age: Number(data.get('age')),
    height: Number(data.get('height')),
    canopySize: Number(data.get('canopySize')),
    leafDensity: Number(data.get('leafDensity')),
    lean: Number(data.get('lean')),
  };
}

function syncOutputs(values) {
  for (const out of outputs) {
    const value = values[out.dataset.out];
    out.textContent = Number.isInteger(value) ? value : value.toFixed(2);
  }
}

function draw(extra = {}) {
  const values = readRig();
  syncOutputs(values);
  playground.render({ ...values, ...extra });
}

rig.addEventListener('input', () => draw());

// Land on a different tree each visit — the generator is deterministic, so a
// fixed seed would make the page look static to anyone returning.
draw({ seed: Math.floor(Math.random() * 999_999) + 1 });

$('[data-reroll]').addEventListener('click', () => {
  draw({ seed: Math.floor(Math.random() * 999_999) + 1 });
});

$('[data-download]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Exporting…';
  try {
    const blob = await playground.toGlb();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treegen_${playground.params.species}_${playground.params.seed}.glb`;
    a.click();
    URL.revokeObjectURL(url);
    button.textContent = 'Downloaded';
  } catch {
    button.textContent = 'Export failed';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Download GLB';
    }, 1600);
  }
});

/* --- connect -------------------------------------------------------------- */
$('[data-copy]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  await navigator.clipboard.writeText($('[data-snippet]').textContent.trim());
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy'; }, 1600);
});

const liveButton = $('[data-live-call]');
const liveOutput = $('[data-live-output]');

liveButton.addEventListener('click', async () => {
  liveButton.disabled = true;
  liveButton.textContent = 'Calling…';
  liveOutput.hidden = false;
  liveOutput.removeAttribute('data-state');
  liveOutput.textContent = 'POST https://mcp.andreglegg.no/treegen → tools/call generate_tree';

  try {
    const { species, seed, detail } = playground.params;
    const result = await callTool({
      route: 'treegen',
      name: 'generate_tree',
      args: { species, seed, detail },
    });
    liveOutput.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    liveOutput.dataset.state = 'error';
    liveOutput.textContent =
      `Call failed: ${err.message}\n\n` +
      'The host runs on hardware in my flat. The playground above is unaffected — it runs in your browser.';
  } finally {
    liveButton.disabled = false;
    liveButton.textContent = 'Run a live call against the server';
  }
});

/* --- catalog -------------------------------------------------------------- */
renderCatalog($('[data-cards]'));
