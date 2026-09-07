import { Controller, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.create(projectId, req.userId!, data);
  }

  @Put(':taskId')
  async updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, data);
  }

  @Delete(':taskId')
  async deleteTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.tasksService.delete(projectId, taskId);
    return { success: true, message: 'Task deleted successfully.' };
  }
}
