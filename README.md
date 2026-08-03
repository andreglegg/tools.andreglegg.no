# tools.andreglegg.no

Showcase and playground for my hosted MCP tools. Static site on GitHub Pages.

## Why the playground runs client-side

The MCP host at `mcp.andreglegg.no` runs on hardware in my flat, so it is not
always up. treegen's generator is DOM-free and pure JavaScript, so the
playground imports it directly and renders in the browser. **The page keeps
working when the server is down** — only the status light and the "run a live
call" button touch the network, and both degrade to a clear offline state.

That is also why the geometry comes from the `treegen` package rather than a
copy: the same generator runs here, in the MCP host, and in treegen's own app.

## Layout

| File | Job |
|---|---|
| `src/playground.js` | three.js scene, parameter → mesh, GLB export |
| `src/mcp.js` | health check and one live Streamable HTTP tool call |
| `src/catalog.js` | the tool list — the page's only source of truth about what exists |
| `src/main.js` | wiring |

## Develop

    npm install
    npm run dev

`mcp.andreglegg.no` allowlists `localhost:5173` and `localhost:4173` for CORS,
so the status light and live call work in dev and preview.

## Deploy

Push to `master`. The Pages workflow builds and deploys; `public/CNAME` keeps
the custom domain.

## Adding a tool

Add an entry to `TOOLS` in `src/catalog.js`. If it needs a live demo, decide
first whether it can run client-side — if it cannot (assetcut is Python and
OpenCV), it gets a card without a demo rather than a demo that only works when
my flat has power.
