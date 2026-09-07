import dotenv from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCadenceMcpServer } from "./server";

dotenv.config();

async function main() {
  const server = createCadenceMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Cadence MCP Server running on Stdio transport (v1.0.0)");
}

main().catch((error) => {
  console.error("Fatal error running Cadence MCP server:", error);
  process.exit(1);
});
