import { prisma } from '../lib/prisma';

const DEFAULT_STAGES = [
  { name: 'To Do', order: 0, isDoneStage: false },
  { name: 'In Progress', order: 1, isDoneStage: false },
  { name: 'Done', order: 2, isDoneStage: true },
];

const DEFAULT_ISSUE_TYPES = [{ name: 'Task' }, { name: 'Bug' }, { name: 'Feature' }];

export const projectRepository = {
  findAllForUser: async (userId: string) => {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: { include: { _count: { select: { members: true } } } },
      },
    });

    return memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      status: m.project.status,
      workspaceId: m.project.workspaceId,
      totalMembers: m.project._count.members,
      role: m.role,
    }));
  },

  findByIdForUser: async (projectId: string, userId: string) => {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) return null;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        stages: { orderBy: { order: 'asc' } },
        issueTypes: true,
      },
    });
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      workspaceId: project.workspaceId,
      role: member.role,
      members: project.members.map((m) => ({
        userId: m.userId,
        name: m.user?.name ?? 'Deleted User',
        email: m.user?.email ?? null,
        role: m.role,
      })),
      stages: project.stages,
      issueTypes: project.issueTypes,
    };
  },

  create: async (
    data: { name: string; workspaceId?: string; stages?: { name: string }[]; issueTypes?: { name: string }[] },
    creatorId: string
  ) => {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: data.name,
          workspaceId: data.workspaceId,
          createdById: creatorId,
        },
      });

      await tx.projectMember.create({
        data: { projectId: project.id, userId: creatorId, role: 'OWNER' },
      });

      const stagesToCreate = data.stages?.length
        ? data.stages.map((s, i) => ({ name: s.name, order: i, isDoneStage: false, projectId: project.id }))
        : DEFAULT_STAGES.map((s) => ({ ...s, projectId: project.id }));
      await tx.boardStage.createMany({ data: stagesToCreate });

      const typesToCreate = data.issueTypes?.length
        ? data.issueTypes.map((t) => ({ name: t.name, isCustom: true, projectId: project.id }))
        : DEFAULT_ISSUE_TYPES.map((t) => ({ ...t, isCustom: false, projectId: project.id }));
      await tx.issueType.createMany({ data: typesToCreate });

      return project;
    });
  },

  update: async (projectId: string, data: any) => {
    // If status is changing to INACTIVE or ARCHIVED, stamp statusChangedAt.
    const updateData = { ...data };
    if (data.status === 'INACTIVE' || data.status === 'ARCHIVED') {
      updateData.statusChangedAt = new Date();
    }
    return prisma.project.update({ where: { id: projectId }, data: updateData });
  },

  delete: async (projectId: string) => {
    // Hard delete — cascades through Tasks, Comments, Notes, Stages,
    // IssueTypes, ProjectMembers per the schema's onDelete: Cascade rules.
    return prisma.project.delete({ where: { id: projectId } });
  },

  getMembers: async (projectId: string) => {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? 'Deleted User',
      email: m.user?.email ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  },

  findUserByEmail: async (email: string) => prisma.user.findUnique({ where: { email } }),

  addOrUpdateMember: async (projectId: string, userId: string, role: string) => {
    return prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role: role as any },
      create: { projectId, userId, role: role as any },
    });
  },

  updateMemberRole: async (projectId: string, userId: string, role: string) => {
    return prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: role as any },
    });
  },

  removeMember: async (projectId: string, userId: string) => {
    return prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  },
};