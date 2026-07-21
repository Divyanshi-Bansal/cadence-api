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

  update: async (workspaceId: string, data: any) => {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace && workspace.status === 'INACTIVE' && !data.status) {
      throw new AppError('Cannot edit an inactive workspace. You must activate it first.', 400);
    }
    return workspaceRepository.update(workspaceId, data);
  },

  delete: (workspaceId: string) => workspaceRepository.delete(workspaceId),

  getMembers: (workspaceId: string) => workspaceRepository.getMembers(workspaceId),

   inviteMember: async (workspaceId: string, email: string, role: 'ADMIN' | 'MEMBER') => {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace && workspace.status === 'INACTIVE') {
      throw new AppError('Cannot invite members to an inactive workspace.', 400);
    }
    const user = await workspaceRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError('No account found with that email. They must sign up first.', 404);
    }
    return workspaceRepository.addOrUpdateMember(workspaceId, user.id, role);
  },

  updateMemberRole: async (workspaceId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace && workspace.status === 'INACTIVE') {
      throw new AppError('Cannot update member roles in an inactive workspace.', 400);
    }
    return workspaceRepository.updateMemberRole(workspaceId, userId, role);
  },

  removeMember: async (workspaceId: string, userId: string) => {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace && workspace.status === 'INACTIVE') {
      throw new AppError('Cannot remove members from an inactive workspace.', 400);
    }
    return workspaceRepository.removeMember(workspaceId, userId);
  },

  getProjects: (workspaceId: string) => workspaceRepository.getProjects(workspaceId),

  moveProject: async (
    projectId: string,
    currentWorkspaceId: string,
    newWorkspaceId: string,
    userId: string
  ) => {
    // Confirm workspaces are active
    const sourceWorkspace = await prisma.workspace.findUnique({ where: { id: currentWorkspaceId } });
    if (sourceWorkspace && sourceWorkspace.status === 'INACTIVE') {
      throw new AppError('Cannot move projects from an inactive workspace.', 400);
    }
    const targetWorkspace = await prisma.workspace.findUnique({ where: { id: newWorkspaceId } });
    if (targetWorkspace && targetWorkspace.status === 'INACTIVE') {
      throw new AppError('Cannot move projects to an inactive workspace.', 400);
    }

    const targetMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: newWorkspaceId, userId } },
    });
    if (!targetMembership || !['OWNER', 'ADMIN'].includes(targetMembership.role)) {
      throw new AppError('Insufficient permissions on target workspace.', 403);
    }

    return workspaceRepository.moveProject(projectId, newWorkspaceId);
  },
};