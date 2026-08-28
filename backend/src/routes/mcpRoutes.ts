import { Router, Request, Response, NextFunction } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createCadenceMcpServer } from "../mcp/server";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

const router = Router();
// Global map to hold active SSE transports
const activeTransports = new Map<string, SSEServerTransport>();

// Middleware to authenticate PAT
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let rawKey: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      rawKey = authHeader.split(" ")[1];
    } else if (typeof req.query.token === "string" && req.query.token) {
      rawKey = req.query.token;
    } else if (typeof req.query.apiKey === "string" && req.query.apiKey) {
      rawKey = req.query.apiKey;
    }

    if (!rawKey || !rawKey.startsWith("cadence_ak_")) {
      return res.status(401).json({ error: "Missing or invalid authorization header or token parameter" });
    }

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const tokenRecord = await prisma.personalAccessToken.findUnique({
      where: { keyHash },
    });

    if (!tokenRecord || tokenRecord.revokedAt || (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date())) {
      return res.status(401).json({ error: "Invalid, expired, or revoked API key" });
    }

    // Attach user id for tools to use
    (req as any).user = { id: tokenRecord.userId };
    
    // Set CADENCE_USER_ID environment variable for MCP tools
    process.env.CADENCE_USER_ID = tokenRecord.userId;

    next();
  } catch (error) {
    console.error("[authenticateApiKey] Error:", error);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};

router.get("/sse", authenticateApiKey, async (req: Request, res: Response) => {
  console.log(`[MCP] New SSE connection from user ${(req as any).user.id}`);
  const transport = new SSEServerTransport("/api/mcp/message", res);
  const sessionId = transport.sessionId;
  
  // Create a dedicated McpServer instance per connection session
  const server = createCadenceMcpServer();
  
  // Storing transport with a session ID BEFORE connecting to prevent race conditions
  activeTransports.set(sessionId, transport);
  
  await server.connect(transport);
  
  res.on("close", () => {
    console.log(`[MCP] SSE connection closed for session ${sessionId}`);
    activeTransports.delete(sessionId);
  });
});

router.post("/message", authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[MCP] POST /message received. sessionId from query: ${sessionId}`);
  
  const transport = activeTransports.get(sessionId);
  
  if (!transport) {
    console.error(`[MCP] Session ${sessionId} not found in activeTransports!`);
    return res.status(404).json({ error: "Session not found or expired" });
  }
  
  try {
    // Pass req.body to handlePostMessage since express.json() has already consumed the request stream!
    await transport.handlePostMessage(req, res, req.body);
  } catch (error: any) {
    console.error(`[MCP] Error handling post message for session ${sessionId}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    }
  }
});

export default router;
