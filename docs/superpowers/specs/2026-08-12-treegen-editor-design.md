# Treegen full editor — design

**Date:** 2026-08-12
**Repo:** tools.andreglegg.no
**Goal:** A dedicated `/treegen/` editor page exposing treegen's full parameter
surface (18 params) and full export surface (GLB, OBJ, game GLB, forest GLB),
plus an MCP-call snippet generator. The landing page keeps its simple hero rig
and links to the editor.

## Why

The landing hero exposes 7 of treegen's 18 params and one export (GLB). Every
treegen surface change currently means hand-editing HTML, JS, and snippet code.
The editor fixes both: full power, and a schema-driven form so future params
are a one-line change.

## Structure

- Same repo, same Vite build. New page `treegen.html` served at `/treegen/`
  via Vite multi-page config (`build.rollupOptions.input` with both pages).
  GitHub Pages deploy workflow unchanged.
- Shared modules: `src/playground.js` (extended, see Viewport), `src/mcp.js`,
  `src/styles.css` (plus a `src/editor.css` for editor-only layout).
- New modules:
  - `src/treegen-params.js` — the param registry (single source of truth).
  - `src/editor.js` — editor page entry: renders form from registry, wires
    viewport, presets, seed, URL state, exports.
- Landing page change: one "Open the full editor →" link added to the hero
  rig actions. Nothing else on the landing page changes.

## Param registry (`src/treegen-params.js`)

Exports `GROUPS` and `PARAMS`. Each param entry: `name`, `group`, `control`
(`range` | `select` | `toggle` | `swatch`), `min`/`max`/`step` or `options`,
`label`, optional `unit`, optional `help` (one-line tooltip text taken from
treegen's param descriptions). Mirrors `paramShape` in treegen `mcp/server.js`.

Groups and membership:

| Group | Params |
|---|---|
| Shape | species, height, canopySize, lean, detail |
| Trunk & branches | trunkRadius, branchCount, branchSpread |
| Foliage | leafDensity, leafStyle, leafShape, leafSize, leafVariation |
| Color | leafPalette (swatch), barkPalette (swatch) |
| Age & condition | age, brokenTop (toggle) |

Seed is not in the registry groups — it lives in the top bar (numeric input,
reroll button, lock toggle; lock keeps the seed across preset loads).

Swatch pickers render the palette indices as clickable color chips instead of
bare number sliders. Chip colors are stored in the registry (sampled once from
treegen's palette tables); if treegen later exports its palettes, the registry
imports them instead.

The form, the value outputs, and the MCP snippet builder all render from the
registry. Adding a treegen param = one registry line.

## Editor layout

- Full-viewport app. Canvas fills the window; param panel docked right
  (~340px, scrollable, groups as collapsible sections, all open by default).
- Slim top bar: back-link to the landing page, preset strip, seed controls,
  server status dot (reuses the landing page's health check).
- Export bar pinned at the bottom of the param panel.
- Mobile (< 800px): panel becomes a bottom sheet over the canvas with a
  drag/tap handle; top bar keeps back-link + seed only, presets scroll
  horizontally.
- Viewport: OrbitControls (drag orbit, wheel zoom, touch). Gentle auto-rotate
  until first pointer interaction, and none under `prefers-reduced-motion`.
  HUD (seed / tris / meshes / build ms) stays overlaid on the canvas.
- `playground.js` gains: optional OrbitControls wiring and a
  `setAutoRotate(bool)`/first-interaction stop. The landing hero keeps its
  current no-controls behavior.

## Presets

- Chips built at runtime from `presets` imported from `treegen/generator` —
  new treegen presets appear with no playground change.
- Clicking a chip loads the preset's params into the form (respecting seed
  lock) and re-renders. Active chip is highlighted until any param is edited.

## State & URL sharing

- Every param change re-renders (as today) and serializes non-default params
  plus seed into the query string (`replaceState`, debounced).
- On load: URL params → else default preset (oak) with a random seed, as the
  landing page does today.
- A "Copy link" affordance next to the seed controls copies the current URL.

## Export panel

Four in-browser exports via `treegen/export` (no server involved):

| Button | Function | Notes |
|---|---|---|
| GLB | `exportGlb(group)` | current tree as-is |
| OBJ | `exportObj(group)` | text download |
| Game GLB | `exportGameGlb(params)` | merged 2-draw-call, LOD0–2 |
| Forest GLB | `exportForestGlb({params, count, seedBase, agedSpread})` | mini-controls: count (default 9), agedSpread (default 0.35); seedBase = current seed |

Filenames follow the existing convention `treegen_<species>_<seed>[_game|_forest].<ext>`.
Export buttons show inline state (Exporting… / Downloaded / Export failed) like
the current download button; failures never throw to the console silently.

**Copy MCP call**: builds a ready-to-paste MCP tool call for the current tree —
only the non-default params as JSON args. A small select next to the copy
button picks the tool: `generate_tree` (default) or `export_game_tree`. Uses
the registry to know defaults, so the snippet stays minimal and in sync.

## Error handling

- Generator throws on bad param combos → caught in `editor.js`, HUD shows the
  message, previous tree stays in the viewport.
- Export failures → inline button state + `console.error`.
- Server status dot failing does not affect any editor function (everything is
  client-side); it is informational only, as on the landing page.

## Testing

Extend the existing browser test pattern (`test/render.test.js`, runs against
`npm run preview`):

- Editor page loads and renders a tree (canvas non-blank, HUD populated).
- Registry completeness: every `PARAMS` entry renders a control; control count
  equals registry length.
- Preset chip click changes the rendered params.
- Each export button yields a non-empty blob/download.
- URL round-trip: set params → reload with that query string → same HUD seed
  and param values.

## Out of scope

- No framework; vanilla JS as today.
- No changes to treegen or mcp.andreglegg.no (the mcp host's hand-mirrored
  paramShape stays as-is; a treegen-exported manifest is a possible future
  step).
- Landing page rig is not redesigned.
- No server-side rendering or saving; everything stays client-side.
