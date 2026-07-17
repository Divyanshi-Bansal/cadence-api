import { prisma } from '../lib/prisma';

export const workspaceRepository = {
    findAllForUser: async (userId: string) => {
        const memberships = await prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: { include: { _count: { select: { projects: true } } } },
            },
        });

        return memberships.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            workspaceType: m.workspace.workspaceType,
            description: m.workspace.description,
            role: m.role,
            totalProjects: m.workspace._count.projects,
            createdAt: m.workspace.createdAt,
        }));
    },

    findByIdForUser: async (workspaceId: string, userId: string) => {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
        });
        if (!member) return null;

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                projects: {
                    include: { _count: { select: { members: true } } },
                },
            },
        });
        if (!workspace) return null;

        return {
            id: workspace.id,
            name: workspace.name,
            workspaceType: workspace.workspaceType,
            description: workspace.description,
            role: member.role,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
            projects: workspace.projects.map((p) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                createdAt: p.createdAt,
                totalMembers: p._count.members,
            })),
        };
    },

    create: async (data: { name: string; workspaceType?: string; description?: string }, ownerId: string) => {
        return prisma.$transaction(async (tx) => {
            const workspace = await tx.workspace.create({ data });
            await tx.workspaceMember.create({
                data: { workspaceId: workspace.id, userId: ownerId, role: 'OWNER' },
            });
            return workspace;
        });
    },

    update: async (workspaceId: string, data: { name?: string; workspaceType?: string; description?: string }) => {
        return prisma.workspace.update({ where: { id: workspaceId }, data });
    },

    // Delete: no longer needs to manually null-out projects — Project.workspace
    // is now `onDelete: SetNull` at the schema level, so Postgres handles it
    // automatically. Simplify:
    delete: async (workspaceId: string) => {
        return prisma.workspace.delete({ where: { id: workspaceId } });
        // WorkspaceMember rows cascade-delete automatically (onDelete: Cascade).
        // Project.workspaceId auto-sets to null automatically (onDelete: SetNull).
    },

    // getMembers: handle possible null user (deleted account)
    getMembers: async (workspaceId: string) => {
        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        return Promise.all(
            members.map(async (m) => {
                const projectMemberships = m.userId
                    ? await prisma.projectMember.findMany({
                        where: { userId: m.userId, project: { workspaceId } },
                        include: { project: { select: { id: true, name: true } } },
                    })
                    : [];

                return {
                    userId: m.userId,
                    name: m.user?.name ?? 'Deleted User',
                    email: m.user?.email ?? null,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    projects: projectMemberships.map((pm) => ({ id: pm.project.id, name: pm.project.name, role: pm.role })),
                };
            })
        );
    },

    findUserByEmail: async (email: string) => {
        return prisma.user.findUnique({ where: { email } });
    },

    addOrUpdateMember: async (workspaceId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
        return prisma.workspaceMember.upsert({
            where: { workspaceId_userId: { workspaceId, userId } },
            update: { role },
            create: { workspaceId, userId, role },
        });
    },

    updateMemberRole: async (workspaceId: string, userId: string, role: 'ADMIN' | 'MEMBER') => {
        return prisma.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId, userId } },
            data: { role },
        });
    },

    removeMember: async (workspaceId: string, userId: string) => {
        return prisma.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId, userId } },
        });
    },

    getProjects: async (workspaceId: string) => {
        const projects = await prisma.project.findMany({
            where: { workspaceId },
            include: { _count: { select: { members: true } } },
        });
        return projects.map((p) => ({
            id: p.id,
            projectName: p.name,
            status: p.status,
            createdById: p.createdById,
            createdAt: p.createdAt,
            totalMembers: p._count.members,
        }));
    },

    moveProject: async (projectId: string, newWorkspaceId: string) => {
        return prisma.project.update({
            where: { id: projectId },
            data: { workspaceId: newWorkspaceId },
        });
    },
};