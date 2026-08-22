# Syllaba MCP Server

Read-only [MCP](https://modelcontextprotocol.io) server that lets Claude Desktop, Claude Code, or Gemini CLI answer questions about your Syllaba courses, assignments, deadlines, grades, and syllabus policies — without leaving your chat.

## How it works

- The **Syllaba desktop app** (Electron) mirrors your courses and assignments to `~/.syllaba/data.json` every time something changes.
- This server reads that file fresh on every tool call and exposes it as read-only MCP tools.
- **Desktop app only.** The hosted web version of Syllaba runs in a browser sandbox with no filesystem access, so it can't write the mirror file — this only works when you're running the Syllaba desktop app.
- Nothing is written back. The server can't add, edit, or complete anything in Syllaba.

## Setup

1. Run the Syllaba desktop app at least once (it creates `~/.syllaba/data.json` automatically on startup and after every edit).
2. Build this server:
   ```
   cd mcp-server
   npm install
   npm run build
   ```
3. Point your MCP client at `mcp-server/dist/index.js`, using the config for your client below. Use an **absolute path** — MCP clients don't resolve relative paths against this folder.

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "syllaba": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\Upahead\\mcp-server\\dist\\index.js"]
    }
  }
}
```

### Claude Code

Add to `.mcp.json` in your project root, or run:

```
claude mcp add syllaba -- node C:\absolute\path\to\Upahead\mcp-server\dist\index.js
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "syllaba": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\Upahead\\mcp-server\\dist\\index.js"]
    }
  }
}
```

Restart your client after editing its config.

## Tools

| Tool | What it does |
|---|---|
| `list_courses` | List every tracked course with instructor and semester. |
| `list_assignments` | List assignments, filterable by course, status (`upcoming`/`overdue`/`completed`), or type. |
| `get_upcoming_deadlines` | Not-yet-completed items due in the next N days (default 14), soonest first. |
| `get_course_policies` | One course's grading breakdown, late-work policy, contacts/office-hours, AI policy, topics, equipment, and recurring class meeting time. |
| `get_grade_summary` | Current weighted grade for one course or all courses — same math as the in-app Grade Calculator. |

## Scope

Read-only by design: no tool can create, edit, complete, or delete anything in Syllaba. Write support (e.g. "mark this done" from chat) would need the desktop app to watch `~/.syllaba/data.json` for external changes and reconcile them with `localStorage`, which is real added complexity not built here yet.
