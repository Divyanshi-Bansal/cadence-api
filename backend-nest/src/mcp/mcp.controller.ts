import { Controller, Get, Post, Req, Res, Query, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createCadenceMcpServer } from './server';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';

@Controller('mcp')
export class McpController {
  private activeTransports = new Map<string, SSEServerTransport>();

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

    const transport = new SSEServerTransport('/api/mcp/message', res);
    const sessionId = transport.sessionId;

    const server = createCadenceMcpServer();
    this.activeTransports.set(sessionId, transport);

    await server.connect(transport);

    res.on('close', () => {
      console.log(`[MCP Nest] SSE connection closed for session ${sessionId}`);
      this.activeTransports.delete(sessionId);
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
