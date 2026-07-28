import { prisma } from "../lib/prisma";
import { encrypt, hashForLookup } from "../lib/crypto";
import { formatUser, CleanUser } from "../lib/userFormat";

export interface CreateUserInput {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  authProvider?: "CREDENTIALS" | "GOOGLE" | "GITHUB";
  providerAccountId?: string | null;
  isEmailVerified?: boolean;
}

export interface UpdateUserInput {
  name?: string | null;
}

export const userRepository = {
  findByUserId: async (userId: string): Promise<CleanUser | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? formatUser(user) : null;
  },

  findByEmailHash: async (emailHash: string) => {
    return prisma.user.findUnique({
      where: { emailHash },
    });
  },

  findByEmail: async (email: string): Promise<CleanUser | null> => {
    const emailHash = hashForLookup(email);
    const user = await prisma.user.findUnique({
      where: { emailHash },
    });
    return user ? formatUser(user) : null;
  },

  findByProvider: async (authProvider: "CREDENTIALS" | "GOOGLE" | "GITHUB", providerAccountId: string) => {
    return prisma.user.findUnique({
      where: {
        authProvider_providerAccountId: {
          authProvider,
          providerAccountId,
        },
      },
    });
  },

  create: async (data: CreateUserInput): Promise<CleanUser> => {
    const emailHash = hashForLookup(data.email);
    const emailEncrypted = encrypt(data.email);
    const nameEncrypted = data.name ? encrypt(data.name) : null;

    const user = await prisma.user.create({
      data: {
        emailHash,
        emailEncrypted,
        nameEncrypted,
        passwordHash: data.passwordHash || null,
        authProvider: data.authProvider || "CREDENTIALS",
        providerAccountId: data.providerAccountId || null,
        isEmailVerified: data.isEmailVerified ?? false,
      },
    });

    return formatUser(user);
  },

  update: async (userId: string, data: UpdateUserInput): Promise<CleanUser> => {
    const nameEncrypted = data.name ? encrypt(data.name) : data.name === null ? null : undefined;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nameEncrypted !== undefined && { nameEncrypted }),
      },
    });

    return formatUser(user);
  },

  delete: async (userId: string) => {
    return prisma.user.delete({ where: { id: userId } });
  },
};
