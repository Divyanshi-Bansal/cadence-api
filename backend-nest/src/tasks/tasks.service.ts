import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { taskRepository } from '../repositories/taskRepository';
import { stageRepository } from '../repositories/stageRepository';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  async create(projectId: string, reporterId: string, data: CreateTaskDto) {
    const stage = await stageRepository.findById(data.stageId);
    if (!stage || stage.projectId !== projectId) {
      throw new BadRequestException('Target column not found in this project.');
    }
    return taskRepository.create({
      ...data,
      projectId,
      reporterId,
    });
  }

  async bulkCreate(projectId: string, reporterId: string, tasks: CreateTaskDto[]) {
    const createdTasks = [];
    for (const task of tasks) {
      const created = await this.create(projectId, reporterId, task);
      createdTasks.push(created);
    }
    return createdTasks;
  }

  async update(projectId: string, taskId: string, data: UpdateTaskDto) {
    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project.');
    }

    if (data.stageId) {
      const stage = await stageRepository.findById(data.stageId);
      if (!stage || stage.projectId !== projectId) {
        throw new BadRequestException('Target column not found in this project.');
      }
    }

    return taskRepository.update(taskId, data);
  }

  async delete(projectId: string, taskId: string) {
    const task = await taskRepository.findById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found in this project.');
    }
    return taskRepository.delete(taskId);
  }
}
