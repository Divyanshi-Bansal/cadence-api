import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { taskRepository } from '../repositories/taskRepository';
import { stageRepository } from '../repositories/stageRepository';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TasksService {
  constructor(private readonly eventsGateway: EventsGateway) {}

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

    const updatedTask = await taskRepository.update(task.id, data);

    this.eventsGateway.broadcastToProject(projectId, 'task:changed', {
      action: 'UPDATE',
      taskId: updatedTask.id,
      task: updatedTask,
      userId,
    });

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

