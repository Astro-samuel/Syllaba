import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_FILE = join(homedir(), '.syllaba', 'mcp-token.txt');

/**
 * Returns the bearer token every request must present. Set SYLLABA_MCP_TOKEN
 * to pin a specific value (e.g. for scripted deploys); otherwise a random
 * token is generated once and persisted to ~/.syllaba/mcp-token.txt so it
 * survives restarts — this server reads real course/grade data, so it
 * refuses to run unauthenticated rather than defaulting to "no token".
 */
export function getOrCreateAuthToken(): string {
  if (process.env.SYLLABA_MCP_TOKEN) return process.env.SYLLABA_MCP_TOKEN;

  if (existsSync(TOKEN_FILE)) {
    const existing = readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (existing) return existing;
  }

  const token = randomBytes(24).toString('base64url');
  mkdirSync(dirname(TOKEN_FILE), { recursive: true });
  writeFileSync(TOKEN_FILE, token, 'utf-8');
  return token;
}

// Once this server is reachable over the internet (via a tunnel, for
// claude.ai), a naive `===` comparison leaks how many leading characters
// matched through response-time differences. timingSafeEqual closes that.
export function isAuthorized(authorizationHeader: string | undefined, token: string): boolean {
  if (!authorizationHeader) return false;
  const [scheme, value] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !value) return false;

  const a = Buffer.from(value);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
