import { Controller, Post, Put, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
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
    @Req() req: Request,
  ) {
    return this.tasksService.update(projectId, taskId, data, req.userId);
  }

  @Patch(':taskId')
  async patchTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() data: UpdateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasksService.update(projectId, taskId, data, req.userId);
  }

  @Delete(':taskId')
  async deleteTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    await this.tasksService.delete(projectId, taskId, req.userId);
    return { success: true, message: 'Task deleted successfully.' };
  }
}

