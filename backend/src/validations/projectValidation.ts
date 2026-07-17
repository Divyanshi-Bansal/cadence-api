import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(150),
  workspaceId: z.string().optional(),
  stages: z.array(z.object({ name: z.string().min(1) })).optional(),
  issueTypes: z.array(z.object({ name: z.string().min(1) })).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'INACTIVE', 'ARCHIVED']).optional(),
  workspaceId: z.string().nullable().optional(),
});

export const inviteProjectMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']), // OWNER not assignable via invite
});

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']),
});