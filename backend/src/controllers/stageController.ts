import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { stageService } from '../services/stageService';
import { AppError } from '../services/projectService';
import {
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
} from '../validations/stageValidation';

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
  console.error(`[stageController] ${label}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function createStage(req: Request, res: Response) {
  try {
    const { name } = createStageSchema.parse(req.body);
    const stage = await stageService.create(req.params.projectId as string, name);
    res.status(201).json(stage);
  } catch (err) {
    handleError(res, err, 'createStage');
  }
}

export async function updateStage(req: Request, res: Response) {
  try {
    const data = updateStageSchema.parse(req.body);
    const stage = await stageService.update(req.params.projectId as string, req.params.stageId as string, data);
    res.json(stage);
  } catch (err) {
    handleError(res, err, 'updateStage');
  }
}

export async function deleteStage(req: Request, res: Response) {
  try {
    await stageService.delete(req.params.projectId as string, req.params.stageId as string);
    res.json({ success: true, message: 'Column removed successfully.' });
  } catch (err) {
    handleError(res, err, 'deleteStage');
  }
}

export async function reorderStages(req: Request, res: Response) {
  try {
    const { stages } = reorderStagesSchema.parse(req.body);
    await stageService.reorder(req.params.projectId as string, stages);
    res.json({ success: true, message: 'Columns reordered successfully.' });
  } catch (err) {
    handleError(res, err, 'reorderStages');
  }
}
