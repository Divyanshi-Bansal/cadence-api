# Cadence MCP Bridge

The official Model Context Protocol (MCP) bridge for **Cadence**, allowing AI agents (like Claude Desktop and Cursor) to connect to your Cadence workspace and execute actions directly in your environment.

## 🚀 Quickstart

To connect your Cadence workspace to an AI assistant, you just need this one command. 

### Cursor IDE
1. Open Cursor Settings -> **MCP Servers**
2. Click **+ Add New MCP Server**
3. Select type **command** and paste the following:

```bash
env CADENCE_API_KEY="YOUR_API_KEY_HERE" npx -y cadence-mcp@latest
```
*(Make sure to replace `YOUR_API_KEY_HERE` with your actual Cadence API key!)*

### Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["-y", "cadence-mcp@latest"],
      "env": {
        "CADENCE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## 🛠️ Features
- **Real-time Sync**: Fetch your Cadence projects, tasks, and API keys instantly.
- **Secure Authentication**: All actions require a valid `CADENCE_API_KEY` scoped to your workspace.
- **Zero Configuration**: No need to clone repositories or manage `.env` files locally.

## 🔗 Architecture

This package acts as a lightweight proxy/bridge. Because Claude Desktop and Cursor only speak the MCP protocol over `stdio` (standard input/output), this Node.js bridge translates those local `stdio` commands into secure HTTP Server-Sent Events (SSE) that talk directly to the Cadence AWS backend.

---
*Built with ❤️ by the Cadence Team.*
