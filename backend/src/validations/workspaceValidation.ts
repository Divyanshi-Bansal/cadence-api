import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  workspaceType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  workspaceType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']), // OWNER not assignable via invite
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']), // OWNER not changeable via this route
});

export const moveProjectSchema = z.object({
  projectId: z.string(),
  newWorkspaceId: z.string(),
});