import { createZodDto } from 'nestjs-zod';
import { createTaskSchema, updateTaskSchema } from '../../validations/taskValidation';

export class CreateTaskDto extends createZodDto(createTaskSchema) {}
export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}
