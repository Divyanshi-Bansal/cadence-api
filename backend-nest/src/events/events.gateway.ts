import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { formatUser } from '../lib/userFormat';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  currentProjectId?: string;
}

export interface UserPresence {
  userId: string;
  name?: string | null;
  email?: string;
  role?: string;
  socketId: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private projectPresenceMap = new Map<string, Map<string, UserPresence>>();

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const accessSecret = process.env.JWT_ACCESS_SECRET;
      if (!accessSecret) {
        this.logger.error('JWT_ACCESS_SECRET missing in environment');
        client.disconnect();
        return;
      }

      const payload = jwt.verify(token, accessSecret) as jwt.JwtPayload;
      if (!payload || !payload.sub || typeof payload.sub !== 'string') {
        client.disconnect();
        return;
      }

      client.userId = payload.sub;
    } catch (err: any) {
      this.logger.error(`WebSocket Auth Failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.currentProjectId) {
      this.handleLeaveProject(client, client.currentProjectId);
    }
  }

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = data?.projectId;
    const userId = client.userId;
    if (!projectId || !userId) return;

    try {
      const member = await (prisma.projectMember as any).findUnique({
        where: { projectId_userId: { projectId, userId } },
        include: { user: true },
      });

      if (!member) {
        client.emit('error', { message: 'Unauthorized project access' });
        return;
      }

      const formattedUser = member.user ? formatUser(member.user) : null;
      const room = `project:${projectId}`;

      if (client.currentProjectId && client.currentProjectId !== projectId) {
        this.handleLeaveProject(client, client.currentProjectId);
      }

      client.join(room);
      client.currentProjectId = projectId;

      if (!this.projectPresenceMap.has(projectId)) {
        this.projectPresenceMap.set(projectId, new Map());
      }

      const roomMap = this.projectPresenceMap.get(projectId)!;
      roomMap.set(userId, {
        userId,
        name: formattedUser?.name || formattedUser?.email,
        email: formattedUser?.email,
        role: member.role,
        socketId: client.id,
      });

      this.emitPresence(projectId);
    } catch (err: any) {
      this.logger.error(`Error in handleJoinProject: ${err.message}`);
    }
  }

  @SubscribeMessage('project:leave')
  handleLeaveProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId?: string } | string,
  ) {
    const targetProject =
      typeof data === 'string'
        ? data
        : data?.projectId || client.currentProjectId;

    if (!targetProject) return;

    client.leave(`project:${targetProject}`);
    client.currentProjectId = undefined;

    const userId = client.userId;
    if (userId && this.projectPresenceMap.has(targetProject)) {
      const roomMap = this.projectPresenceMap.get(targetProject)!;
      roomMap.delete(userId);
      if (roomMap.size === 0) {
        this.projectPresenceMap.delete(targetProject);
      }
      this.emitPresence(targetProject);
    }
  }

  @SubscribeMessage('user:typing')
  handleUserTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { projectId: string; taskId?: string; isTyping: boolean },
  ) {
    if (!data?.projectId || !client.userId) return;
    client.to(`project:${data.projectId}`).emit('user:typing', {
      userId: client.userId,
      taskId: data.taskId,
      isTyping: data.isTyping,
    });
  }

  broadcastToProject(projectId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit(event, payload);
    }
  }

  private emitPresence(projectId: string) {
    if (!this.server) return;
    const roomMap = this.projectPresenceMap.get(projectId);
    const users = roomMap ? Array.from(roomMap.values()) : [];
    this.server.to(`project:${projectId}`).emit('presence:update', { users });
  }
}
