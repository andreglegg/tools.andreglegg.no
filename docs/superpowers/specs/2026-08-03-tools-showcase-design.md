# tools.andreglegg.no — Showcase and Playground

**Date:** 2026-08-03
**Status:** Approved and shipped

## Purpose

A page that makes someone connect one of my hosted MCP tools to their client in
under a minute, and believe it works because they just used it. Doubles as a
portfolio piece.

## Constraints that shaped it

The MCP host at `mcp.andreglegg.no` runs on a Windows box in my flat behind a
Cloudflare Tunnel. It is not always up. A showcase that goes dark whenever the
home connection blips is worse than no showcase — especially one linked from a
portfolio.

## Key decision: the playground runs client-side

treegen's generator is DOM-free, pure JavaScript, and depends only on `three`.
So the page imports it and renders in the browser rather than calling the
server.

Consequences:

- The playground works when the host is down.
- No CORS on the hot path, no rate limiting needed, no abuse surface.
- Instant feedback — a tree builds in ~8 ms, so slider drags are live.

Only two things touch the network, and both degrade visibly:

| Element | On failure |
|---|---|
| Status light | Shows `offline — unreachable`, nothing else changes |
| "Run a live call" button | Prints the real error plus a note that the playground is unaffected |

## Key decision: one shared generator, no copies

The generator now lives in its own repo, `github:andreglegg/treegen`, consumed
as a git dependency by both the MCP host and this site. It was previously
vendored into the host; adding a third copy here would have compounded the
drift. treegen's `package.json` keeps only `three` in `dependencies` so
consumers do not pull vite, lucide, or playwright.

This surfaced a real bug: `exportGlb` returned a Node `Buffer`, which does not
exist in browsers. It now returns an `ArrayBuffer`, and the Node caller wraps
it.

## Structure

1. **Status bar** — live host state, the only always-visible network element.
2. **Stage** — the hero *is* the working playground: canvas, parameter rig, and
   a HUD reading seed / triangles / meshes / build time. Landing on a working
   instrument beats a screenshot of one.
3. **Connect** — the copy-paste command, plus the optional live MCP roundtrip
   that proves the remote server is real.
4. **Catalog** — one card per tool. `src/catalog.js` is the page's only source
   of truth about what exists.

## Visual direction

Drawn from the subject rather than applied to it:

- **Palette** is treegen's own `leafPalettes` and `barkPalettes` — the site is
  coloured by the thing it generates. Ground is slate blue-grey, a 3D
  application viewport, not a terminal black.
- **The alpha checkerboard** behind the canvas is the universal "no background"
  signifier and the entire subject of the sibling tool, assetcut.
- **Type**: Archivo (display, heavy and wide), IBM Plex Sans (body), IBM Plex
  Mono (all data, labels, and code — the instrument voice).

## Honesty rules

assetcut gets a card with no demo. It is Python with OpenCV; it cannot run in a
browser, and faking a demo would misrepresent it. Its card says why it is
private rather than hiding it.

The footer states the host runs on hardware in my flat. Someone evaluating this
should know what they are looking at.

## Testing

Headless Chromium render check asserting the tree builds, the HUD populates,
two cards render, and no horizontal scroll at 390 px. CORS assertions live in
the host's own suite.

## Deferred

Linking this from the portfolio at `andreglegg.no`. That site currently serves
an old create-react-app build while the newer Vite portfolio sits untracked on
disk — untangling it is separate work with its own decisions.
