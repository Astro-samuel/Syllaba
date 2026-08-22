# Syllaba Cloud Worker

A Cloudflare Worker that gives you a **permanent** URL for Syllaba's MCP tools — no tunnel, works for claude.ai as well as Claude Desktop/Code and Gemini CLI. This is the alternative to `mcp-server/` (which needs a tunnel for claude.ai since it only reads a local file); this one reads from Cloudflare KV instead, which the desktop app pushes to over the internet.

## How it's different from `mcp-server/`

| | `mcp-server/` (local) | `cloudflare-worker/` (this one) |
|---|---|---|
| Data source | `~/.syllaba/data.json` on your PC | Cloudflare KV |
| Reachable from | Same machine only (or via a temporary tunnel) | Anywhere, permanently |
| Needs running | Yes — a terminal/process on your PC | No — Cloudflare hosts it |
| Setup | `npm run build && npm start` | One-time deploy to Cloudflare |

Same 5 tools, same auth model (a bearer token), same read-only guarantee. Pick one or run both — they're independent.

## 1. Deploy

```
cd cloudflare-worker
npm install
npx wrangler login              # opens a browser to authorize with your Cloudflare account
npm run kv:create               # creates the KV namespace, prints an id
```

Paste the printed `id` into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`. Then:

```
npm run deploy
```

Wrangler prints your permanent URL, e.g. `https://syllaba-cloud.<your-subdomain>.workers.dev`.

## 2. Point the desktop app at it

```
echo https://syllaba-cloud.<your-subdomain>.workers.dev > ~/.syllaba/cloud-worker-url.txt
```

(On Windows: `C:\Users\<you>\.syllaba\cloud-worker-url.txt`, one line, no trailing slash needed either way.)

Restart the Syllaba desktop app. On startup it prints your bearer token to the console:

```
Syllaba cloud sync key: <your token>
```

That's also saved to `~/.syllaba/cloud-key.txt` if you need it again later. From now on, every course/assignment change pushes to the worker automatically (fire-and-forget, alongside the existing local file write — nothing changes if the push fails, e.g. you're offline).

## 3. Connect a client

Same shape as the local server, just with the permanent URL:

**Claude Desktop / claude.ai**: Settings → Connectors → Add custom connector → URL `https://syllaba-cloud.<your-subdomain>.workers.dev/mcp`, header `Authorization: Bearer <your token>`.

**Claude Code**:
```
claude mcp add --transport http syllaba https://syllaba-cloud.<your-subdomain>.workers.dev/mcp --header "Authorization: Bearer <your token>"
```

**Gemini CLI** (`~/.gemini/settings.json`):
```json
{
  "mcpServers": {
    "syllaba": {
      "httpUrl": "https://syllaba-cloud.<your-subdomain>.workers.dev/mcp",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}
```

No tunnel, no keeping a terminal open — this one just works whenever the desktop app has synced at least once.

## Auth model

Syllaba has no accounts/login system (fully local by design), so there's no per-user signup here either. Your bearer token **is** your account: it's also the exact KV key your data is stored under. Anyone with the token can read that installation's courses, assignments, and grades — anyone without it can't, since KV keys aren't enumerable or guessable (24 random bytes). Treat the token like a password: don't post it publicly, don't commit `~/.syllaba/cloud-key.txt`.

To revoke access (e.g. you think the token leaked), delete `~/.syllaba/cloud-key.txt` and restart the app — a new token generates, and the old KV entry becomes orphaned (still holds your old data, but nothing points a bearer token at it anymore; delete it manually from the Cloudflare dashboard if you want it gone).

## Limits (Cloudflare free tier, as of writing)

- 100,000 requests/day
- KV: 1GB total storage, 100,000 reads/day, 1,000 writes/day — a `/sync` push is one write, so this only matters if you're editing courses hundreds of times a day
- Sync payloads over 2MB are rejected (plenty for any realistic course list)

## Scope

Read-only over MCP, same as `mcp-server/`: no tool can create, edit, complete, or delete anything. `/sync` is the one write path, and only the desktop app calls it (with your token) — an MCP client never writes.
