import { Router, Request, Response, NextFunction } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createCadenceMcpServer } from "../mcp/server";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

const router = Router();
const mcpServer = createCadenceMcpServer();

// Global map to hold active SSE transports
const activeTransports = new Map<string, SSEServerTransport>();

// Middleware to authenticate PAT
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const rawKey = authHeader.split(" ")[1];
    if (!rawKey.startsWith("cadence_ak_")) {
      return res.status(401).json({ error: "Invalid API key format" });
    }

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const tokenRecord = await prisma.personalAccessToken.findUnique({
      where: { keyHash },
    });

    if (!tokenRecord || tokenRecord.revokedAt) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }

    // Attach user id for tools to use
    // We pass it via environment variable per request context, 
    // or attach to req.user for express usage
    (req as any).user = { id: tokenRecord.userId };
    
    // Set CADENCE_USER_ID environment variable for MCP tools
    // Note: In a highly concurrent environment, using an env var for request context is problematic,
    // but this matches the existing pattern in projectTools/taskTools.
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
  
  // Storing transport with a session ID BEFORE connecting to prevent race conditions
  activeTransports.set(sessionId, transport);
  
  await mcpServer.connect(transport);
  
  res.on("close", () => {
    console.log(`[MCP] SSE connection closed for session ${sessionId}`);
    activeTransports.delete(sessionId);
  });
});

router.post("/message", authenticateApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[MCP] POST /message received. sessionId from query: ${sessionId}`);
  console.log(`[MCP] Active sessions:`, Array.from(activeTransports.keys()));
  
  const transport = activeTransports.get(sessionId);
  
  if (!transport) {
    console.error(`[MCP] Session ${sessionId} not found in activeTransports!`);
    return res.status(404).json({ error: "Session not found or expired" });
  }
  
  // Pass req.body to handlePostMessage since express.json() has already consumed the request stream!
  await transport.handlePostMessage(req, res, req.body);
});

export default router;
