import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { taskService } from '../services/taskService';
import { AppError } from '../services/projectService';
import { createTaskSchema, updateTaskSchema } from '../validations/taskValidation';

function handleError(res: Response, err: unknown, label: string): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed.',
      issues: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(`[taskController] ${label}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function createTask(req: Request, res: Response) {
  try {
    const data = createTaskSchema.parse(req.body);
    const task = await taskService.create(req.params.projectId as string, req.userId, data);
    res.status(201).json(task);
  } catch (err) {
    handleError(res, err, 'createTask');
  }
}

export async function updateTask(req: Request, res: Response) {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await taskService.update(req.params.projectId as string, req.params.taskId as string, data);
    res.json(task);
  } catch (err) {
    handleError(res, err, 'updateTask');
  }
}

export async function deleteTask(req: Request, res: Response) {
  try {
    await taskService.delete(req.params.projectId as string, req.params.taskId as string);
    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    handleError(res, err, 'deleteTask');
  }
}
