import { z } from 'zod';

export const createStageSchema = z.object({
  name: z
    .string()
    .min(2, 'Column name must be at least 2 characters.')
    .max(50, 'Column name cannot exceed 50 characters.')
    .trim(),
});

export const updateStageSchema = z.object({
  name: z
    .string()
    .min(2, 'Column name must be at least 2 characters.')
    .max(50, 'Column name cannot exceed 50 characters.')
    .trim()
    .optional(),
  order: z.number().int().nonnegative().optional(),
  isDoneStage: z.boolean().optional(),
});

export const reorderStagesSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().nonnegative('Order must be non-negative.'),
    })
  ),
});
