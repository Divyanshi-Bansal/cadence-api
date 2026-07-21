import { projectRepository } from '../repositories/projectRepository';
import { prisma } from '../lib/prisma';

export class AppError extends Error {
  constructor(public readonly message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export const projectService = {
  getAllForUser: (userId: string) => projectRepository.findAllForUser(userId),

  getById: async (projectId: string, userId: string) => {
    const project = await projectRepository.findByIdForUser(projectId, userId);
    if (!project) throw new AppError('Project not found or access denied.', 404);
    return project;
  },

  create: async (data: any, creatorId: string) => {
    if (data.workspaceId) {
      const workspace = await prisma.workspace.findUnique({ where: { id: data.workspaceId } });
      if (workspace && workspace.status === 'INACTIVE') {
        throw new AppError('Cannot create a project in an inactive workspace.', 400);
      }
    }
    return projectRepository.create(data, creatorId);
  },

  update: async (projectId: string, data: any) => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found.', 404);

    if (project.workspaceId) {
      const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
      if (workspace && workspace.status === 'INACTIVE') {
        throw new AppError('Cannot update projects in an inactive workspace.', 400);
      }
    }
    return projectRepository.update(projectId, data);
  },

  delete: async (projectId: string) => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found.', 404);

    if (project.workspaceId) {
      const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
      if (workspace && workspace.status === 'INACTIVE') {
        throw new AppError('Cannot delete projects in an inactive workspace.', 400);
      }
    }
    return projectRepository.delete(projectId);
  },

  getMembers: (projectId: string) => projectRepository.getMembers(projectId),

  inviteMember: async (projectId: string, email: string, role: string) => {
    const user = await projectRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError('No account found with that email. They must sign up first.', 404);
      // TODO: once email infra is decided, create an Invitation row here
      // instead of throwing, so the person can be invited before signup.
    }
    return projectRepository.addOrUpdateMember(projectId, user.id, role);
  },

  updateMemberRole: (projectId: string, userId: string, role: string) =>
    projectRepository.updateMemberRole(projectId, userId, role),

  removeMember: (projectId: string, userId: string) => projectRepository.removeMember(projectId, userId),
};