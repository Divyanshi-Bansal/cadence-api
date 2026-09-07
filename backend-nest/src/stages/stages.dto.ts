import { createZodDto } from 'nestjs-zod/dto';
import {
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
} from '../validations/stageValidation';

export class CreateStageDto extends createZodDto(createStageSchema) {}
export class UpdateStageDto extends createZodDto(updateStageSchema) {}
export class ReorderStagesDto extends createZodDto(reorderStagesSchema) {}
