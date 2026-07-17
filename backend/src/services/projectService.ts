import { projectRepository } from '../repositories/projectRepository';

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

  create: (data: any, creatorId: string) => projectRepository.create(data, creatorId),

  update: (projectId: string, data: any) => projectRepository.update(projectId, data),

  delete: (projectId: string) => projectRepository.delete(projectId),

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