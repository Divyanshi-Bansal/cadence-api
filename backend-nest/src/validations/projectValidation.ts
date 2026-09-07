import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  projectType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  projectType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'INACTIVE']).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']), // OWNER not assignable via invite
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']), // OWNER not changeable via this route
});