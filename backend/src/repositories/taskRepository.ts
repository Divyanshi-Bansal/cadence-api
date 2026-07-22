import { prisma } from '../lib/prisma';
import { Priority } from '@prisma/client';

export const taskRepository = {
  create: async (data: {
    projectId: string;
    stageId: string;
    issueTypeId?: string;
    title: string;
    description?: any;
    priority?: Priority;
    reporterId: string;
    assigneeIds?: string[];
  }) => {
    let issueTypeId = data.issueTypeId;
    
    // If no issue type was specified, find the first one for the project
    if (!issueTypeId) {
      const firstType = await prisma.issueType.findFirst({
        where: { projectId: data.projectId },
      });
      if (!firstType) {
        // Fallback: create a custom default IssueType if none exists
        const newType = await prisma.issueType.create({
          data: { projectId: data.projectId, name: 'Task', isCustom: false },
        });
        issueTypeId = newType.id;
      } else {
        issueTypeId = firstType.id;
      }
    }

    return prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: data.projectId,
          stageId: data.stageId,
          issueTypeId: issueTypeId!,
          title: data.title,
          description: data.description || null,
          priority: data.priority || 'MEDIUM',
          reporterId: data.reporterId,
        },
      });

      if (data.assigneeIds && data.assigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({
            taskId: task.id,
            userId,
          })),
        });
      }

      return tx.task.findUnique({
        where: { id: task.id },
        include: { assignees: { include: { user: true } } },
      });
    });
  },

  update: async (
    taskId: string,
    data: {
      stageId?: string;
      issueTypeId?: string;
      title?: string;
      description?: any;
      priority?: Priority;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      assigneeIds?: string[];
    }
  ) => {
    const { assigneeIds, ...scalarFields } = data;

    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: scalarFields,
      });

      if (assigneeIds !== undefined) {
        // Clear existing assignees
        await tx.taskAssignee.deleteMany({
          where: { taskId },
        });

        // Insert new assignees
        if (assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              taskId,
              userId,
            })),
          });
        }
      }

      return tx.task.findUnique({
        where: { id: taskId },
        include: { assignees: { include: { user: true } } },
      });
    });
  },

  delete: async (taskId: string) => {
    return prisma.task.delete({
      where: { id: taskId },
    });
  },

  findById: async (taskId: string) => {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { include: { user: true } } },
    });
  },
};
