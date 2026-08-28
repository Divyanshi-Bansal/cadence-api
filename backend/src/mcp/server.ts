import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools/projectTools";
import { registerTaskTools } from "./tools/taskTools";
import { registerAiTools } from "./tools/aiTools";
import { registerProjectResources } from "./resources/projectResources";
import { registerWorkflowPrompts } from "./prompts/workflowPrompts";

export function createCadenceMcpServer(): McpServer {
  const server = new McpServer({
    name: "cadence-mcp-server",
    version: "1.0.0",
  });

  // Register tools, resources, and prompts
  registerProjectTools(server);
  registerTaskTools(server);
  registerAiTools(server);
  registerProjectResources(server);
  registerWorkflowPrompts(server);

  return server;
}
