import { taskRepository } from '../repositories/taskRepository';
import { stageRepository } from '../repositories/stageRepository';
import { AppError } from './projectService';

export const taskService = {
  create: async (
    projectId: string,
    reporterId: string,
    data: {
      stageId: string;
      issueTypeId?: string;
      title: string;
      description?: any;
      priority?: any;
      assigneeIds?: string[];
      parentTaskId?: string | null;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      tags?: string[];
      subtasks?: any[];
    }
  ) => {
    // Validate target stage
    const stage = await stageRepository.findById(data.stageId);
    if (!stage || stage.projectId !== projectId) {
      throw new AppError('Target column not found in this project.', 400);
    }
    return taskRepository.create({
      ...data,
      projectId,
      reporterId,
    });
  },

  bulkCreate: async (
    projectId: string,
    reporterId: string,
    tasks: {
      stageId: string;
      issueTypeId?: string;
      title: string;
      description?: any;
      priority?: any;
      estimatedMinutes?: number | null;
      tags?: string[];
      subtasks?: any[];
    }[]
  ) => {
    // We can run these in sequence or Promise.all. 
    // Sequence is safer for DB connection pools if the array is large, 
    // but Promise.all is faster. We'll use Promise.all for speed.
    const createdTasks = await Promise.all(
      tasks.map((task) =>
        taskService.create(projectId, reporterId, task)
      )
    );
    return createdTasks;
  },

  update: async (
    projectId: string,
    taskId: string,
    data: {
      stageId?: string;
      issueTypeId?: string;
      title?: string;
      description?: any;
      priority?: any;
      parentTaskId?: string | null;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      assigneeIds?: string[];
    }
  ) => {
    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new AppError('Task not found in this project.', 404);
    }

    if (data.stageId) {
      const stage = await stageRepository.findById(data.stageId);
      if (!stage || stage.projectId !== projectId) {
        throw new AppError('Target column not found in this project.', 400);
      }
    }

    return taskRepository.update(taskId, data);
  },

  delete: async (projectId: string, taskId: string) => {
    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new AppError('Task not found in this project.', 404);
    }
    return taskRepository.delete(taskId);
  },
};
