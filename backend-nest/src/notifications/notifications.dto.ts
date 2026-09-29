import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const NotificationTypeEnum = z.enum([
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'MENTIONED_IN_COMMENT',
  'PROJECT_INVITATION',
  'STAGE_CHANGED',
]);

export const CreateNotificationSchema = z.object({
  userId: z.string().min(1),
  actorId: z.string().optional(),
  type: NotificationTypeEnum,
  title: z.string().min(1),
  body: z.string().optional(),
  entityId: z.string().optional(),
});

export class CreateNotificationDto extends createZodDto(CreateNotificationSchema) {}
