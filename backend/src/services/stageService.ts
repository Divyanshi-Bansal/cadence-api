import { stageRepository } from '../repositories/stageRepository';
import { projectRepository } from '../repositories/projectRepository';
import { AppError } from './projectService';

export const stageService = {
  create: async (projectId: string, name: string) => {
    const maxOrder = await stageRepository.findMaxOrder(projectId);
    const newOrder = maxOrder + 1;
    return stageRepository.create(projectId, name, newOrder);
  },

  update: async (projectId: string, stageId: string, data: { name?: string; order?: number; isDoneStage?: boolean }) => {
    const stage = await stageRepository.findById(stageId);
    if (!stage || stage.projectId !== projectId) {
      throw new AppError('Column not found in this project.', 404);
    }
    return stageRepository.update(stageId, data);
  },

  delete: async (projectId: string, stageId: string) => {
    const stage = await stageRepository.findById(stageId);
    if (!stage || stage.projectId !== projectId) {
      throw new AppError('Column not found in this project.', 404);
    }
    return stageRepository.delete(stageId);
  },

  reorder: async (projectId: string, stageOrders: { id: string; order: number }[]) => {
    // Validate that all stages belong to the project
    for (const item of stageOrders) {
      const stage = await stageRepository.findById(item.id);
      if (!stage || stage.projectId !== projectId) {
        throw new AppError(`Column with ID ${item.id} does not belong to this project.`, 400);
      }
    }
    return stageRepository.reorder(projectId, stageOrders);
  },
};
