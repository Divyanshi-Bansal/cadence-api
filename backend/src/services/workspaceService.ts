import { workspaceRepository } from '../repositories/workspaceRepository';
import { prisma } from '../lib/prisma';

export class AppError extends Error {
  constructor(public readonly message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export const workspaceService = {
  getAllForUser: (userId: string) => workspaceRepository.findAllForUser(userId),

  getById: async (workspaceId: string, userId: string) => {
    const workspace = await workspaceRepository.findByIdForUser(workspaceId, userId);
    if (!workspace) throw new AppError('Workspace not found or access denied.', 404);
    return workspace;
  },

  create: (data: { name: string; workspaceType?: string; description?: string }, ownerId: string) =>
    workspaceRepository.create(data, ownerId),

  update: (workspaceId: string, data: any) => workspaceRepository.update(workspaceId, data),

  delete: (workspaceId: string) => workspaceRepository.delete(workspaceId),

  getMembers: (workspaceId: string) => workspaceRepository.getMembers(workspaceId),

  inviteMember: async (workspaceId: string, email: string, role: 'ADMIN' | 'MEMBER') => {
    const user = await workspaceRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError('No account found with that email. They must sign up first.', 404);
    }
    return workspaceRepository.addOrUpdateMember(workspaceId, user.id, role);
  },

  updateMemberRole: (workspaceId: string, userId: string, role: 'ADMIN' | 'MEMBER') =>
    workspaceRepository.updateMemberRole(workspaceId, userId, role),

  removeMember: (workspaceId: string, userId: string) =>
    workspaceRepository.removeMember(workspaceId, userId),

  getProjects: (workspaceId: string) => workspaceRepository.getProjects(workspaceId),

  moveProject: async (
    projectId: string,
    currentWorkspaceId: string,
    newWorkspaceId: string,
    userId: string
  ) => {
    // Confirm the requester has rights in the TARGET workspace too — not just
    // the source (already checked by requireWorkspaceRole on the route).
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: newWorkspaceId, userId } },
    });
    if (!targetMembership || !['OWNER', 'ADMIN'].includes(targetMembership.role)) {
      throw new AppError('Insufficient permissions on target workspace.', 403);
    }

    return workspaceRepository.moveProject(projectId, newWorkspaceId);
  },
};