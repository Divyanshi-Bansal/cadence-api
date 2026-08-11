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

  create: (data: { name: string; projectType?: string; description?: string }, ownerId: string) =>
    projectRepository.create(data, ownerId),

  update: async (projectId: string, data: any) => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE' && !data.status) {
      throw new AppError('Cannot edit an inactive project. You must activate it first.', 400);
    }
    return projectRepository.update(projectId, data);
  },

  delete: (projectId: string) => projectRepository.delete(projectId),

  getMembers: (projectId: string) => projectRepository.getMembers(projectId),

  inviteMember: async (projectId: string, email: string, role: 'ADMIN' | 'MEMBER') => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new AppError('Cannot invite members to an inactive project.', 400);
    }
    const user = await projectRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError('No account found with that email. They must sign up first.', 404);
    }
    return projectRepository.addOrUpdateMember(projectId, user.id, role);
  },

  updateMemberRole: async (projectId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new AppError('Cannot update member roles in an inactive project.', 400);
    }
    return projectRepository.updateMemberRole(projectId, userId, role);
  },

  removeMember: async (projectId: string, userId: string) => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new AppError('Cannot remove members from an inactive project.', 400);
    }
    return projectRepository.removeMember(projectId, userId);
  },
};