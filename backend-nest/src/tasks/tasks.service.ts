import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { taskRepository } from '../repositories/taskRepository';
import { stageRepository } from '../repositories/stageRepository';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { prisma } from '../lib/prisma';
import { formatUser } from '../lib/userFormat';

@Injectable()
export class TasksService {
  constructor(
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getActorName(userId?: string): Promise<string> {
    if (!userId) return 'A teammate';
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return 'A teammate';
      const formatted = formatUser(user);
      return formatted.name || formatted.email || 'A teammate';
    } catch {
      return 'A teammate';
    }
  }

  private async getRecipients(projectId: string, actorId?: string, task?: any): Promise<string[]> {
    const memberRecords = await (prisma.projectMember as any).findMany({
      where: { projectId },
      select: { userId: true },
    });

    const recipientSet = new Set<string>();
    for (const m of memberRecords) {
      if (m.userId) {
        recipientSet.add(m.userId);
      }
    }

    if (task) {
      if (task.reporterId) {
        recipientSet.add(task.reporterId);
      }
      if (task.assignees && Array.isArray(task.assignees)) {
        for (const a of task.assignees) {
          const uid = a.userId || a.user?.id;
          if (uid) {
            recipientSet.add(uid);
          }
        }
      }
    }

    return Array.from(recipientSet);
  }

  async create(projectId: string, reporterId: string, data: CreateTaskDto) {
    const stage = await stageRepository.findById(data.stageId);
    if (!stage || stage.projectId !== projectId) {
      throw new BadRequestException('Target column not found in this project.');
    }
    const task = await taskRepository.create({
      ...data,
      projectId,
      reporterId,
    });

    this.eventsGateway.broadcastToProject(projectId, 'task:changed', {
      action: 'CREATE',
      taskId: task.id,
      task,
      userId: reporterId,
    });

    // Send In-App Notifications
    const actorName = await this.getActorName(reporterId);
    const recipients = await this.getRecipients(projectId, reporterId, task);
    const taskRef = task.issueKey || task.title;

    for (const targetUserId of recipients) {
      await this.notificationsService.createNotification({
        userId: targetUserId,
        actorId: reporterId,
        type: 'TASK_ASSIGNED',
        title: `${actorName} created task ${taskRef}`,
        body: task.title,
        entityId: task.id,
        projectId,
      });
    }

    // Record ActivityLog
    try {
      await (prisma.activityLog as any).create({
        data: {
          projectId,
          taskId: task.id,
          actorId: reporterId,
          action: 'TASK_CREATED',
          details: { title: task.title, issueKey: task.issueKey },
        },
      });
    } catch (e) {
      // Non-blocking
    }

    return task;
  }

  async bulkCreate(projectId: string, reporterId: string, tasks: CreateTaskDto[]) {
    const createdTasks = [];
    for (const task of tasks) {
      const created = await this.create(projectId, reporterId, task);
      createdTasks.push(created);
    }
    return createdTasks;
  }

  async update(projectId: string, taskId: string, data: UpdateTaskDto, userId?: string) {
    const beforeTask = await taskRepository.findById(taskId);
    if (!beforeTask || beforeTask.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project.');
    }

    if (data.stageId) {
      const stage = await stageRepository.findById(data.stageId);
      if (!stage || stage.projectId !== projectId) {
        throw new BadRequestException('Target column not found in this project.');
      }
    }

    const updatedTask = await taskRepository.update(beforeTask.id, data);

    this.eventsGateway.broadcastToProject(projectId, 'task:changed', {
      action: 'UPDATE',
      taskId: updatedTask.id,
      task: updatedTask,
      userId,
    });

    // Compute field diffs for clean notifications
    try {
      const diffs: string[] = [];
      const taskRef = updatedTask.issueKey || updatedTask.title;

      if (data.title && beforeTask.title !== updatedTask.title) {
        diffs.push(`• Title: "${beforeTask.title}" → "${updatedTask.title}"`);
      }

      if (data.priority && beforeTask.priority !== updatedTask.priority) {
        diffs.push(`• Priority: ${beforeTask.priority} → ${updatedTask.priority}`);
      }

      if (data.stageId && beforeTask.stageId !== updatedTask.stageId) {
        const [oldStage, newStage] = await Promise.all([
          stageRepository.findById(beforeTask.stageId),
          stageRepository.findById(updatedTask.stageId),
        ]);
        const oldName = oldStage?.name || 'Previous Column';
        const newName = newStage?.name || 'New Column';
        diffs.push(`• Stage: ${oldName} → ${newName}`);
      }

      const beforeDueDateStr = beforeTask.dueDate ? new Date(beforeTask.dueDate).toISOString().split('T')[0] : null;
      const afterDueDateStr = updatedTask.dueDate ? new Date(updatedTask.dueDate).toISOString().split('T')[0] : null;
      if (beforeDueDateStr !== afterDueDateStr) {
        diffs.push(`• Due date updated`);
      }

      const beforeAssigneesStr = (beforeTask.assignees || []).map((a: any) => a.userId || a.user?.id).filter(Boolean).sort().join(',');
      const afterAssigneesStr = (updatedTask.assignees || []).map((a: any) => a.userId || a.user?.id).filter(Boolean).sort().join(',');
      if (beforeAssigneesStr !== afterAssigneesStr) {
        diffs.push(`• Assignees updated`);
      }

      const beforeDescStr = typeof beforeTask.description === 'string' ? beforeTask.description : JSON.stringify(beforeTask.description || '');
      const afterDescStr = typeof updatedTask.description === 'string' ? updatedTask.description : JSON.stringify(updatedTask.description || '');
      if (data.description !== undefined && beforeDescStr !== afterDescStr) {
        diffs.push(`• Description updated`);
      }

      if (diffs.length > 0) {
        const actorName = await this.getActorName(userId);
        const recipients = await this.getRecipients(projectId, userId, updatedTask);

        let titleStr = '';
        let bodyStr = '';

        if (diffs.length === 1) {
          titleStr = `${actorName} updated ${taskRef}`;
          bodyStr = diffs[0].replace('• ', '');
        } else {
          titleStr = `${actorName} made ${diffs.length} changes to ${taskRef}`;
          bodyStr = diffs.join('\n');
        }

        const notifType = data.stageId && beforeTask.stageId !== updatedTask.stageId ? 'STAGE_CHANGED' : 'TASK_ASSIGNED';

        for (const recipientId of recipients) {
          await this.notificationsService.createNotification({
            userId: recipientId,
            actorId: userId,
            type: notifType,
            title: titleStr,
            body: bodyStr,
            entityId: updatedTask.id,
            projectId,
          });
        }

        // Record ActivityLog
        await (prisma.activityLog as any).create({
          data: {
            projectId,
            taskId: updatedTask.id,
            actorId: userId,
            action: 'TASK_UPDATED',
            details: { diffs, issueKey: updatedTask.issueKey },
          },
        });
      }
    } catch (err) {
      console.error('Failed to trigger task update notification:', err);
    }

    return updatedTask;
  }

  async delete(projectId: string, taskId: string, userId?: string) {
    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project.');
    }
    const result = await taskRepository.delete(task.id);

    this.eventsGateway.broadcastToProject(projectId, 'task:changed', {
      action: 'DELETE',
      taskId: task.id,
      userId,
    });

    return result;
  }
}
