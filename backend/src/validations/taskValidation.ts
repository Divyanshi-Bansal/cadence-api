import { z } from 'zod';

const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Task title must be at least 3 characters.')
    .max(150, 'Task title cannot exceed 150 characters.')
    .trim(),
  stageId: z.string(),
  issueTypeId: z.string().optional(),
  description: z.any().optional(),
  priority: PriorityEnum.optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Task title must be at least 3 characters.')
    .max(150, 'Task title cannot exceed 150 characters.')
    .trim()
    .optional(),
  stageId: z.string().optional(),
  issueTypeId: z.string().optional(),
  description: z.any().optional(),
  priority: PriorityEnum.optional(),
  dueDate: z
    .preprocess((arg) => {
      if (typeof arg === 'string' && arg !== '') return new Date(arg);
      return arg;
    }, z.date().nullable().optional()),
  estimatedMinutes: z.number().int().nonnegative().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});
