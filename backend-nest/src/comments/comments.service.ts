import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatUser } from '../lib/userFormat';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private formatComment(c: any) {
    let rawContent = c.content;
    if (typeof rawContent === 'object' && rawContent !== null) {
      rawContent = rawContent.text || JSON.stringify(rawContent);
    }
    return {
      id: c.id,
      taskId: c.taskId,
      userId: c.userId,
      content: String(rawContent || ''),
      replyToId: c.replyToId || null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      user: c.user ? formatUser(c.user) : null,
    };
  }

  async getTaskComments(taskId: string) {
    const comments = await (this.prisma.comment as any).findMany({
      where: { taskId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((c) => this.formatComment(c));
  }

  async createComment(taskId: string, userId: string, dto: CreateCommentDto, projectId?: string) {
    if (dto.replyToId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.replyToId },
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment to reply to was not found');
      }
    }

    const comment = await (this.prisma.comment as any).create({
      data: {
        taskId,
        userId,
        content: dto.content,
        replyToId: dto.replyToId || null,
      },
      include: { user: true },
    });

    const formatted = this.formatComment(comment);

    if (projectId) {
      this.eventsGateway.broadcastToProject(projectId, 'comment:changed', {
        action: 'CREATE',
        taskId,
        comment: formatted,
        userId,
      });
    }

    return formatted;
  }

  async updateComment(commentId: string, userId: string, dto: UpdateCommentDto, projectId?: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId && existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await (this.prisma.comment as any).update({
      where: { id: commentId },
      data: { content: dto.content },
      include: { user: true },
    });

    const formatted = this.formatComment(updated);

    if (projectId) {
      this.eventsGateway.broadcastToProject(projectId, 'comment:changed', {
        action: 'UPDATE',
        taskId: existing.taskId,
        comment: formatted,
        userId,
      });
    }

    return formatted;
  }

  private async getAllDescendantCommentIds(commentId: string): Promise<string[]> {
    const children = await this.prisma.comment.findMany({
      where: { replyToId: commentId },
      select: { id: true },
    });

    let ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const subIds = await this.getAllDescendantCommentIds(child.id);
      ids = ids.concat(subIds);
    }
    return ids;
  }

  async deleteComment(commentId: string, userId: string, projectId?: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId && existing.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    const descendantIds = await this.getAllDescendantCommentIds(commentId);
    const idsToDelete = [commentId, ...descendantIds];

    await this.prisma.comment.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    if (projectId) {
      this.eventsGateway.broadcastToProject(projectId, 'comment:changed', {
        action: 'DELETE',
        taskId: existing.taskId,
        deletedIds: idsToDelete,
        userId,
      });
    }

    return { success: true, message: 'Comment and nested replies deleted', deletedIds: idsToDelete };
  }
}

