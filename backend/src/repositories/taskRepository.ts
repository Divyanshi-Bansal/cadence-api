import { prisma } from '../lib/prisma';
import { Priority } from '@prisma/client';
import { formatUser } from '../lib/userFormat';

function formatTask(task: any): any {
  if (!task) return null;
  return {
    ...task,
    assignees: task.assignees?.map((a: any) => ({
      ...a,
      user: a.user ? formatUser(a.user) : null,
    })),
    subtasks: task.subtasks?.map((st: any) => formatTask(st)) || [],
  };
}

export const taskRepository = {
  create: async (data: {
    projectId: string;
    stageId: string;
    issueTypeId?: string;
    title: string;
    description?: any;
    priority?: Priority;
    reporterId: string;
    parentTaskId?: string | null;
    dueDate?: Date | null;
    estimatedMinutes?: number | null;
    assigneeIds?: string[];
  }) => {
    let issueTypeId = data.issueTypeId;
    
    if (!issueTypeId) {
      const firstType = await prisma.issueType.findFirst({
        where: { projectId: data.projectId },
      });
      if (!firstType) {
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
          parentTaskId: data.parentTaskId || null,
          dueDate: data.dueDate || null,
          estimatedMinutes: data.estimatedMinutes || null,
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

      const created = await tx.task.findUnique({
        where: { id: task.id },
        include: {
          assignees: { include: { user: true } },
          subtasks: { include: { assignees: { include: { user: true } } } },
          parent: true,
        },
      });

      return formatTask(created);
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
      parentTaskId?: string | null;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      assigneeIds?: string[];
    }
  ) => {
    const { assigneeIds, ...scalarFields } = data;

    return prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: scalarFields,
      });

      // If parent stage changes, cascade stage update to all its subtasks
      if (scalarFields.stageId) {
        await tx.task.updateMany({
          where: { parentTaskId: taskId },
          data: { stageId: scalarFields.stageId },
        });
      }

      if (assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({
          where: { taskId },
        });

        if (assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              taskId,
              userId,
            })),
          });
        }
      }

      const updated = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          assignees: { include: { user: true } },
          subtasks: { include: { assignees: { include: { user: true } } } },
          parent: true,
        },
      });

      return formatTask(updated);
    });
  },

  delete: async (taskId: string) => {
    return prisma.$transaction(async (tx) => {
      const getAllChildIds = async (parentIds: string[]): Promise<string[]> => {
        if (parentIds.length === 0) return [];
        const children = await tx.task.findMany({
          where: { parentTaskId: { in: parentIds } },
          select: { id: true },
        });
        const childIds = children.map((c) => c.id);
        if (childIds.length === 0) return [];
        const deeperChildIds = await getAllChildIds(childIds);
        return [...childIds, ...deeperChildIds];
      };

      const allChildIds = await getAllChildIds([taskId]);
      if (allChildIds.length > 0) {
        await tx.task.deleteMany({
          where: { id: { in: allChildIds } },
        });
      }

      return tx.task.delete({
        where: { id: taskId },
      });
    });
  },

  findById: async (taskId: string) => {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { include: { user: true } },
        subtasks: { include: { assignees: { include: { user: true } } } },
        parent: true,
      },
    });
    return formatTask(task);
  },
};
