#!/usr/bin/env node
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createSyllabaMcpServer } from './server.js';
import { getOrCreateAuthToken, isAuthorized } from './auth.js';
import { DATA_FILE_PATH } from './data.js';

const PORT = Number(process.env.SYLLABA_MCP_PORT) || 3939;
const token = getOrCreateAuthToken();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  // Unauthenticated liveness check — handy for a tunnel/uptime monitor,
  // and it deliberately reveals nothing about course data.
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname !== '/mcp') {
    res.writeHead(404).end('Not found');
    return;
  }

  if (!isAuthorized(req.headers.authorization, token)) {
    res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  if (req.method !== 'POST') {
    // Stateless mode keeps no session/SSE stream open, so there's nothing
    // for a GET (resume stream) or DELETE (end session) to act on.
    res.writeHead(405, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Stateless: a fresh McpServer + transport per request, both closed once
  // the response ends. Every tool re-reads the data file from disk anyway,
  // so there's no state worth keeping between calls, and this avoids
  // tracking session IDs / cleaning up idle connections over a public tunnel.
  const mcpServer = createSyllabaMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    transport.close();
    mcpServer.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error('Error handling MCP request', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`Syllaba MCP server listening on http://localhost:${PORT}/mcp`);
  console.log(`Data file: ${DATA_FILE_PATH}`);
  console.log(`Auth token: ${token}`);
  console.log('Add "Authorization: Bearer <token>" to every client config that connects to this server.');
});
