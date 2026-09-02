import { createZodDto } from 'nestjs-zod/dto';
import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '../validations/projectValidation';

export class CreateProjectDto extends createZodDto(createProjectSchema) {}
export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
export class InviteMemberDto extends createZodDto(inviteMemberSchema) {}
export class UpdateMemberRoleDto extends createZodDto(updateMemberRoleSchema) {}
