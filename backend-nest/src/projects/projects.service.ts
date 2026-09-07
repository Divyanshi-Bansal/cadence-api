import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatUser } from '../lib/userFormat';
import { userRepository } from '../repositories/userRepository';

const DEFAULT_STAGES = [
  { name: 'Backlog', order: 0, isDoneStage: false },
  { name: 'To Do', order: 1, isDoneStage: false },
  { name: 'In Progress', order: 2, isDoneStage: false },
  { name: 'Done', order: 3, isDoneStage: true },
];

const DEFAULT_ISSUE_TYPES = [{ name: 'Task' }, { name: 'Bug' }, { name: 'Feature' }];

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllForUser(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: { include: { _count: { select: { tasks: true } } } },
      },
    });

    return memberships.map((m: any) => ({
      id: m.project.id,
      name: m.project.name,
      projectType: m.project.projectType,
      description: m.project.description,
      role: m.role,
      status: m.project.status,
      totalTasks: m.project._count.tasks,
      createdAt: m.project.createdAt,
    }));
  }

  async getById(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    
    if (!member) return null;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        issueTypes: true,
        tasks: {
          include: {
            assignees: { include: { user: true } },
            subtasks: { include: { assignees: { include: { user: true } } } },
            parent: true,
          },
        },
      },
    });
    
    if (!project) return null;

    const formattedTasks = project.tasks.map((task: any) => ({
      ...task,
      assignees: task.assignees?.map((a: any) => ({
        ...a,
        user: a.user ? formatUser(a.user) : null,
      })) || [],
      subtasks: task.subtasks?.map((st: any) => ({
        ...st,
        assignees: st.assignees?.map((a: any) => ({
          ...a,
          user: a.user ? formatUser(a.user) : null,
        })) || [],
      })) || [],
    }));

    return {
      id: project.id,
      name: project.name,
      projectType: project.projectType,
      description: project.description,
      role: member.role,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      stages: project.stages,
      issueTypes: project.issueTypes,
      tasks: formattedTasks,
    };
  }

  async create(data: { name: string; projectType?: string; description?: string }, ownerId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const project = await tx.project.create({ data });
      await tx.projectMember.create({
        data: { projectId: project.id, userId: ownerId, role: 'OWNER' },
      });

      const stagesToCreate = DEFAULT_STAGES.map((s) => ({ ...s, projectId: project.id }));
      await tx.boardStage.createMany({ data: stagesToCreate });

      const typesToCreate = DEFAULT_ISSUE_TYPES.map((t) => ({ ...t, isCustom: false, projectId: project.id }));
      await tx.issueType.createMany({ data: typesToCreate });

      return project;
    });
  }

  async update(projectId: string, data: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE' && !data.status) {
      throw new BadRequestException('Cannot edit an inactive project. You must activate it first.');
    }
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  async delete(projectId: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'INACTIVE' },
    });
  }

  async getMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    return members.map((m: any) => {
      const formatted = m.user ? formatUser(m.user) : null;
      return {
        userId: m.userId,
        name: formatted?.name ?? 'Deleted User',
        email: formatted?.email ?? null,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });
  }

  async inviteMember(projectId: string, email: string, role: 'ADMIN' | 'MEMBER') {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new BadRequestException('Cannot invite members to an inactive project.');
    }
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No account found with that email. They must sign up first.');
    }
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      update: { role },
      create: { projectId, userId: user.id, role },
    });
  }

  async updateMemberRole(projectId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new BadRequestException('Cannot update member roles in an inactive project.');
    }
    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.status === 'INACTIVE') {
      throw new BadRequestException('Cannot remove members from an inactive project.');
    }
    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async getProjectNotes(projectId: string) {
    const notes = await this.prisma.note.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: { user: true },
    });

    return notes.map((n: any) => ({
      id: n.id,
      projectId: n.projectId,
      userId: n.userId,
      title: n.title,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      user: formatUser(n.user as any), // casting because prisma relations sometimes need exact typing
    }));
  }

  async deleteProjectNote(noteId: string) {
    await this.prisma.note.delete({
      where: { id: noteId },
    });
    return { success: true, message: 'Note deleted successfully.' };
  }
}
