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
    tags?: string[];
    subtasks?: any[];
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
      let totalTasksToCreate = 1;
      if (data.subtasks && data.subtasks.length > 0) {
        totalTasksToCreate += data.subtasks.length;
      }

      const project = await tx.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new Error(`Project ${data.projectId} not found.`);
      }

      const existingTasks = await tx.task.findMany({
        where: { issueKey: { startsWith: `${project.taskPrefix}-` } },
        select: { issueKey: true },
      });

      let maxNum = project.taskCount || 0;
      for (const t of existingTasks) {
        if (t.issueKey) {
          const parts = t.issueKey.split("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }

      const updatedProject = await tx.project.update({
        where: { id: data.projectId },
        data: { taskCount: maxNum + totalTasksToCreate },
      });

      let nextId = maxNum + 1;
      const parentIssueKey = `${updatedProject.taskPrefix}-${nextId++}`;

      const createData: any = {
        projectId: data.projectId,
        stageId: data.stageId,
        issueTypeId: issueTypeId!,
        title: data.title,
        issueKey: parentIssueKey,
        description: data.description || null,
        priority: data.priority || 'MEDIUM',
        reporterId: data.reporterId,
        parentTaskId: data.parentTaskId || null,
        dueDate: data.dueDate || null,
        estimatedMinutes: data.estimatedMinutes || null,
        tags: data.tags || [],
      };

      if (data.subtasks && data.subtasks.length > 0) {
        createData.subtasks = {
          create: data.subtasks.map((st: any) => ({
            projectId: data.projectId,
            stageId: st.stageId || data.stageId,
            issueTypeId: st.issueTypeId || issueTypeId,
            title: st.title,
            issueKey: `${project.taskPrefix}-${nextId++}`,
            description: st.description || null,
            priority: st.priority || 'MEDIUM',
            reporterId: data.reporterId,
            estimatedMinutes: st.estimatedMinutes || null,
            tags: st.tags || [],
          }))
        };
      }

      const task = await tx.task.create({
        data: createData,
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
