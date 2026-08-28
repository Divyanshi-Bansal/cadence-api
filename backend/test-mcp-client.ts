import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import * as dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.TEST_API_KEY;

if (!API_KEY) {
  console.error("Error: TEST_API_KEY environment variable is required.");
  console.error("Run: TEST_API_KEY=cadence_ak_... npx ts-node test-mcp-client.ts");
  process.exit(1);
}

async function main() {
  console.log("Connecting to Cadence MCP SSE Server...");
  
  // Set up the SSE transport pointing to your running backend
  const transport = new SSEClientTransport(
    new URL("http://localhost:4000/api/mcp/sse"),
    {
      eventSourceInit: {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      } as any, // Cast to any to avoid TS dom typings conflicts if present
      requestInit: {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      },
    }
  );

  const client = new Client(
    { name: "cadence-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log("✅ Successfully connected and authenticated with API Key!");

    // 1. List available tools
    const tools = await client.listTools();
    console.log("\n🛠️  Available Tools:");
    tools.tools.forEach(t => console.log(` - ${t.name}: ${t.description}`));

    // 2. Test list_projects tool
    console.log("\n📡 Executing list_projects tool...");
    const result = await client.callTool({
      name: "list_projects",
      arguments: {}
    });
    
    console.log("✅ Response:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error("❌ Failed to connect or execute tool:");
    if (error?.response?.status === 401) {
      console.error("Error 401: Unauthorized. Please check your API key.");
    } else {
      console.error(error.message || error);
    }
  } finally {
    process.exit(0);
  }
}

main();
