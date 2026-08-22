# Syllaba MCP Server

Read-only [MCP](https://modelcontextprotocol.io) server that lets Claude Desktop, Claude Code, Gemini CLI, **or claude.ai in the browser** answer questions about your Syllaba courses, assignments, deadlines, grades, and syllabus policies.

## How it works

- The **Syllaba desktop app** (Electron) mirrors your courses and assignments to `~/.syllaba/data.json` every time something changes.
- This server reads that file fresh on every tool call — never cached — and exposes it over HTTP as MCP tools, protected by a bearer token.
- **Desktop app only.** The hosted web version of Syllaba runs in a browser sandbox with no filesystem access, so it can't write the mirror file.
- Nothing is written back. No tool can add, edit, or complete anything in Syllaba.

## 1. Build and run the server

```
cd mcp-server
npm install
npm run build
npm start
```

It prints something like:

```
Syllaba MCP server listening on http://localhost:3939/mcp
Auth token: TScue8sz3g7xZvS4EG87LkxBz7yytkPe
```

The token is generated once and saved to `~/.syllaba/mcp-token.txt` — it's the same every time you restart the server unless you delete that file or set `SYLLABA_MCP_TOKEN` yourself. **Leave this running** in a terminal (or set it up as a background/startup task) — unlike a local stdio server, nothing auto-starts it for you.

## 2. Connect a client

Every client needs the URL and the `Authorization: Bearer <token>` header from step 1.

### Claude Desktop / claude.ai (browser)

Both use the same **Custom Connectors** feature:

1. Settings → Connectors → **Add custom connector**
2. URL: `http://localhost:3939/mcp` (Desktop app on the same machine) — see below for claude.ai
3. Add header: `Authorization` → `Bearer <your token>`
4. Save, then enable the "syllaba" connector in a chat.

**claude.ai in the browser runs in Anthropic's cloud — it cannot reach `localhost` on your machine.** To use it there, the server needs a public URL:

```
cloudflared tunnel --url http://localhost:3939
```

(no signup needed for a quick tunnel — install from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads); `ngrok http 3939` works the same way). Use the `https://...trycloudflare.com` URL it prints instead of `localhost` in step 2. The tunnel only works while both it and the server are running, and while the desktop app has produced `~/.syllaba/data.json` — start the tunnel only when you actually want claude.ai to reach it, since it exposes your course data to anyone who has the URL **and** the token.

### Claude Code

```
claude mcp add --transport http syllaba http://localhost:3939/mcp --header "Authorization: Bearer <your token>"
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "syllaba": {
      "httpUrl": "http://localhost:3939/mcp",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `list_courses` | List every tracked course with instructor and semester. |
| `list_assignments` | List assignments, filterable by course, status (`upcoming`/`overdue`/`completed`), or type. |
| `get_upcoming_deadlines` | Not-yet-completed items due in the next N days (default 14), soonest first. |
| `get_course_policies` | One course's grading breakdown, late-work policy, contacts/office-hours, AI policy, topics, equipment, and recurring class meeting time. |
| `get_grade_summary` | Current weighted grade for one course or all courses — same math as the in-app Grade Calculator. |

## Security notes

- The server is stateless: every request is handled independently, nothing is kept in memory between calls.
- `GET /health` is unauthenticated (just an `{ ok: true }` liveness check) — everything else requires the bearer token.
- Only run the tunnel while you're actively using claude.ai with it. Closing the tunnel (Ctrl+C) immediately makes the server unreachable from outside your machine again; the local server keeps working for Desktop/Code/Gemini CLI on the same machine either way.

## Scope

Read-only by design: no tool can create, edit, complete, or delete anything in Syllaba. Write support (e.g. "mark this done" from chat) would need the desktop app to watch `~/.syllaba/data.json` for external changes and reconcile them with `localStorage`, which is real added complexity not built here yet.
