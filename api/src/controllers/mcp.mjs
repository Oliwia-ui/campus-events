import * as mcp from '../services/mcp.mjs';

// POST /api/mcp: the "Streamable HTTP" transport of MCP. One JSON-RPC message in,
// one JSON answer out. Notifications get 202 Accepted without a body.
export async function handle(req, res) {
  const response = await mcp.handle(req.body);
  if (response === null) return res.status(202).send();
  res.json(response);
}

// The transport also allows GET for a server-to-client stream. We never start
// messages ourselves, so per the spec we answer 405.
export function noStream(_req, res) {
  res.set('Allow', 'POST').status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for MCP messages' } });
}
