import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createInvitationSchema = z.object({
  projectId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export class CreateInvitationDto extends createZodDto(createInvitationSchema) {}
