import { prisma } from '../lib/prisma';

export const stageRepository = {
  create: async (projectId: string, name: string, order: number) => {
    return prisma.boardStage.create({
      data: {
        projectId,
        name,
        order,
      },
    });
  },

  update: async (stageId: string, data: { name?: string; order?: number; isDoneStage?: boolean }) => {
    return prisma.boardStage.update({
      where: { id: stageId },
      data,
    });
  },

  delete: async (stageId: string) => {
    return prisma.boardStage.delete({
      where: { id: stageId },
    });
  },

  reorder: async (projectId: string, stageOrders: { id: string; order: number }[]) => {
    return prisma.$transaction(
      stageOrders.map((so) =>
        prisma.boardStage.update({
          where: { id: so.id, projectId },
          data: { order: so.order },
        })
      )
    );
  },

  findMaxOrder: async (projectId: string) => {
    const agg = await prisma.boardStage.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    return agg._max.order ?? -1;
  },

  findById: async (stageId: string) => {
    return prisma.boardStage.findUnique({
      where: { id: stageId },
    });
  },
};
