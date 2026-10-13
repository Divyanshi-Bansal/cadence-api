import { Controller, Get, Post, Req, Res, Query, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createCadenceMcpServer } from './server';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';

@Controller('mcp')
export class McpController {
  private activeTransports = new Map<string, SSEServerTransport>();
  private activeServers = new Map<string, any>();

  constructor(private readonly prisma: PrismaService) {}

  private async authenticateApiKey(req: Request): Promise<string> {
    let rawKey: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string' && req.query.token) {
      rawKey = req.query.token;
    } else if (typeof req.query.apiKey === 'string' && req.query.apiKey) {
      rawKey = req.query.apiKey;
    }

    if (!rawKey || !rawKey.startsWith('cadence_ak_')) {
      throw new UnauthorizedException('Missing or invalid authorization header or token parameter');
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const tokenRecord = await this.prisma.personalAccessToken.findUnique({
      where: { keyHash },
    });

    if (!tokenRecord || tokenRecord.revokedAt || (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date())) {
      throw new UnauthorizedException('Invalid, expired, or revoked API key');
    }

    process.env.CADENCE_USER_ID = tokenRecord.userId;
    return tokenRecord.userId;
  }

  @Get('sse')
  async handleSse(@Req() req: Request, @Res() res: Response) {
    const userId = await this.authenticateApiKey(req);
    console.log(`[MCP Nest] New SSE connection from user ${userId}`);

    // Essential reverse proxy headers (prevents Render, Nginx, ALB buffering & premature disconnects)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const transport = new SSEServerTransport('/api/mcp/message', res);
    const sessionId = transport.sessionId;

    const server = createCadenceMcpServer();
    this.activeTransports.set(sessionId, transport);
    this.activeServers.set(sessionId, server);

    await server.connect(transport);

    // Heartbeat every 15s prevents cloud reverse proxy (Render 60s/100s) idle timeouts
    const keepAliveTimer = setInterval(() => {
      if (!res.writableEnded && res.writable) {
        res.write(': keepalive\n\n');
      }
    }, 15000);

    res.on('error', (err) => {
      console.error(`[MCP Nest] SSE socket error for session ${sessionId}:`, err);
    });

    res.on('close', async () => {
      clearInterval(keepAliveTimer);
      console.log(`[MCP Nest] SSE connection closed for session ${sessionId}`);
      this.activeTransports.delete(sessionId);
      const activeServer = this.activeServers.get(sessionId);
      if (activeServer) {
        this.activeServers.delete(sessionId);
        try {
          await activeServer.close();
        } catch (_) {}
      }
    });
  }

  @Post('message')
  async handleMessage(@Req() req: Request, @Res() res: Response, @Query('sessionId') sessionId: string) {
    await this.authenticateApiKey(req);
    const transport = this.activeTransports.get(sessionId);

    if (!transport) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error: any) {
      console.error(`[MCP Nest] Error handling post message for session ${sessionId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process message' });
      }
    }
  }
}
