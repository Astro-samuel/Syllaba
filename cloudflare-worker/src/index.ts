import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSyllabaMcpServer } from './server.js';
import { SyllabaData } from './types.js';

export interface Env {
  SYLLABA_KV: KVNamespace;
}

// The bearer token IS the KV key. There's no separate account/login system
// in Syllaba (fully local-storage, single-device by design) — a random
// per-install secret doubles as both "which installation's data is this"
// and "prove you're allowed to read it." Anyone who has the key can read
// that installation's courses/grades; anyone who doesn't, can't reach any
// of it (KV keys aren't enumerable). This is the same trust model as the
// local server's bearer token, just made permanent instead of per-tunnel.
function getBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme === 'Bearer' && value ? value : null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024; // 2MB — generous for a JSON blob of courses/assignments

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true });
    }

    const token = getBearerToken(req);
    if (!token || token.length < 16) {
      // A short/missing token can't be a real generated key -- rejected
      // before touching KV so a scan for short/guessable tokens doesn't
      // even cost a KV read.
      return json({ error: 'Unauthorized' }, 401);
    }

    if (url.pathname === '/sync' && req.method === 'POST') {
      const contentLength = Number(req.headers.get('Content-Length') || 0);
      if (contentLength > MAX_SYNC_BODY_BYTES) {
        return json({ error: 'Payload too large' }, 413);
      }

      let body: SyllabaData;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      if (!Array.isArray(body.courses) || !Array.isArray(body.assignments)) {
        return json({ error: 'Body must be { courses: [], assignments: [] }' }, 400);
      }

      await env.SYLLABA_KV.put(token, JSON.stringify(body));
      return json({ ok: true });
    }

    if (url.pathname === '/mcp') {
      if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
      }

      const getData = async (): Promise<SyllabaData | null> => {
        const raw = await env.SYLLABA_KV.get(token);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          return {
            courses: Array.isArray(parsed.courses) ? parsed.courses : [],
            assignments: Array.isArray(parsed.assignments) ? parsed.assignments : []
          };
        } catch {
          return null;
        }
      };

      // Stateless: a fresh server + transport per request. Nothing here
      // holds state between calls (every tool re-reads KV), and a Worker
      // invocation doesn't outlive the response anyway.
      const mcpServer = createSyllabaMcpServer(getData);
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      return transport.handleRequest(req);
    }

    return json({ error: 'Not found' }, 404);
  }
};
