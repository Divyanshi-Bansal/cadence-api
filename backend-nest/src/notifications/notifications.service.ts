import { Injectable, Optional } from '@nestjs/common';
import { prisma } from '../lib/prisma';
import { EventsGateway } from '../events/events.gateway';
import { CreateNotificationDto } from './notifications.dto';
import { formatUser } from '../lib/userFormat';

@Injectable()
export class NotificationsService {
  constructor(
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async getUserNotifications(userId: string, limit = 20, offset = 0) {
    const [notifications, total, unreadCount] = await Promise.all([
      (prisma.notification as any).findMany({
        where: { userId },
        include: {
          actor: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      (prisma.notification as any).count({ where: { userId } }),
      (prisma.notification as any).count({ where: { userId, isRead: false } }),
    ]);

    const formatted = notifications.map((n: any) => ({
      ...n,
      actor: n.actor ? formatUser(n.actor) : null,
    }));

    return {
      notifications: formatted,
      total,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await (prisma.notification as any).count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await (prisma.notification as any).updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return notification;
  }

  async markAllAsRead(userId: string) {
    await (prisma.notification as any).updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async createNotification(dto: CreateNotificationDto) {
    const notification = await (prisma.notification as any).create({
      data: {
        userId: dto.userId,
        actorId: dto.actorId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        entityId: dto.entityId,
      },
      include: {
        actor: true,
      },
    });

    const formatted = {
      ...notification,
      actor: notification.actor ? formatUser(notification.actor) : null,
    };

    if (this.eventsGateway) {
      this.eventsGateway.sendNotificationToUser(dto.userId, formatted);
    }

    return formatted;
  }
}
