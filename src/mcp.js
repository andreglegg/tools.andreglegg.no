// Thin client for the live MCP host. Only two things on this page touch the
// network: the status light and the "run a live call" button. Both must fail
// quietly — the host runs on hardware in a flat, not in a datacentre.
export const MCP_HOST = 'https://mcp.andreglegg.no';

export async function checkHealth({ timeoutMs = 6000 } = {}) {
  const abort = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(`${MCP_HOST}/healthz`, { signal: abort });
    if (!res.ok) return { online: false, reason: `HTTP ${res.status}` };
    const body = await res.json();
    return { online: body.status === 'ok', routes: body.routes ?? [] };
  } catch (err) {
    return { online: false, reason: err.name === 'TimeoutError' ? 'timed out' : 'unreachable' };
  }
}

/**
 * One stateless MCP tool call over Streamable HTTP: initialize, then
 * tools/call. The server runs sessionless, so there is no session id to carry
 * and each POST stands alone.
 */
export async function callTool({ route, name, args, timeoutMs = 20000 }) {
  const signal = AbortSignal.timeout(timeoutMs);
  const url = `${MCP_HOST}/${route}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'Mcp-Protocol-Version': '2025-06-18',
  };

  const post = async (body) => {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return parseResponse(await res.text());
  };

  await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'tools.andreglegg.no', version: '1.0.0' },
    },
  });

  return await post({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

// The server may answer as JSON or as a single SSE frame depending on the
// Accept negotiation; handle both rather than assuming.
function parseResponse(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  const dataLine = trimmed
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('data:'));
  if (!dataLine) throw new Error('No JSON payload in response');
  return JSON.parse(dataLine.slice(5).trim());
}
