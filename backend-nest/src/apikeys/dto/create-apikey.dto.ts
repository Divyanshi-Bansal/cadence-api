import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

export class CreateApiKeyDto extends createZodDto(
  z.object({
    name: z.string().min(1, 'Key name is required'),
  })
) {}
