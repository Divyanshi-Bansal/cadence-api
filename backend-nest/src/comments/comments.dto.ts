import { z } from 'zod';
import { createZodDto } from 'nestjs-zod/dto';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required'),
  replyToId: z.string().optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required'),
});

export class CreateCommentDto extends createZodDto(createCommentSchema) {}
export class UpdateCommentDto extends createZodDto(updateCommentSchema) {}
