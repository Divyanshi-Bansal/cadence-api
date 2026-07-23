import { prisma } from '../lib/prisma';
import { hashForLookup } from '../lib/crypto';
import { formatUser } from '../lib/userFormat';

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
                project: { include: { _count: { select: { tasks: true } } } },
            },
        });

        return memberships.map((m) => ({
            id: m.project.id,
            name: m.project.name,
            projectType: m.project.projectType,
            description: m.project.description,
            role: m.role,
            status: m.project.status,
            totalTasks: m.project._count.tasks,
            createdAt: m.project.createdAt,
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
                stages: { orderBy: { order: 'asc' } },
                issueTypes: true,
                tasks: { include: { assignees: { include: { user: true } } } },
            },
        });
        if (!project) return null;

        const formattedTasks = project.tasks.map((task) => ({
            ...task,
            assignees: task.assignees.map((a) => ({
                ...a,
                user: a.user ? formatUser(a.user) : null,
            })),
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
    },

    create: async (data: { name: string; projectType?: string; description?: string }, ownerId: string) => {
        return prisma.$transaction(async (tx) => {
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
    },

    update: async (projectId: string, data: { name?: string; projectType?: string; description?: string; status?: any }) => {
        return prisma.project.update({ where: { id: projectId }, data });
    },

    delete: async (projectId: string) => {
        return prisma.project.update({
            where: { id: projectId },
            data: { status: 'INACTIVE' },
        });
    },

    getMembers: async (projectId: string) => {
        const members = await prisma.projectMember.findMany({
            where: { projectId },
            include: { user: true },
        });

        return members.map((m) => {
            const formatted = m.user ? formatUser(m.user) : null;
            return {
                userId: m.userId,
                name: formatted?.name ?? 'Deleted User',
                email: formatted?.email ?? null,
                role: m.role,
                joinedAt: m.joinedAt,
            };
        });
    },

    findUserByEmail: async (email: string) => {
        const emailHash = hashForLookup(email);
        const user = await prisma.user.findUnique({ where: { emailHash } });
        return user ? formatUser(user) : null;
    },

    addOrUpdateMember: async (projectId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
        return prisma.projectMember.upsert({
            where: { projectId_userId: { projectId, userId } },
            update: { role },
            create: { projectId, userId, role },
        });
    },

    updateMemberRole: async (projectId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
        return prisma.projectMember.update({
            where: { projectId_userId: { projectId, userId } },
            data: { role },
        });
    },

    removeMember: async (projectId: string, userId: string) => {
        return prisma.projectMember.delete({
            where: { projectId_userId: { projectId, userId } },
        });
    },
};