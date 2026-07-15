import { prisma } from "../lib/prisma";

export interface CreateUserInput {
  clerkId: string;
  email: string;
  name?: string | null;
}

export interface UpdateUserInput {
  name?: string | null;
}

const USER_PUBLIC_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userRepository = {
  findByClerkId: async (clerkId: string) => {
    return prisma.user.findUnique({
      where: { clerkId },
      select: USER_PUBLIC_SELECT,
    });
  },

  findByUserId: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: USER_PUBLIC_SELECT,
    });
  },

  findByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
      select: USER_PUBLIC_SELECT,
    });
  },

  upsert: async ({ clerkId, email, name }: CreateUserInput) => {
    return prisma.user.upsert({
      where: { clerkId },
      update: { email, name: name ?? null },
      create: { clerkId, email, name: name ?? null },
      select: USER_PUBLIC_SELECT,
    });
  },

  update: async (userId: string, data: UpdateUserInput) => {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: USER_PUBLIC_SELECT,
    });
  },

  deleteByClerkId: async (clerkId: string) => {
    return prisma.user.deleteMany({ where: { clerkId } });
  },
};
