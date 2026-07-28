import { userRepository } from "../repositories/userRepository";
import { formatUser, CleanUser } from "../lib/userFormat";
import { prisma } from "../lib/prisma";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const userService = {
  getProfile: async (userId: string): Promise<CleanUser> => {
    const user = await userRepository.findByUserId(userId);
    if (!user) {
      throw new AppError("User not found.", 404);
    }
    return user;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await userRepository.findByEmail(email);
    // No throw — returns void so controller sends a 200 response to prevent enumeration attacks.
  },

  updateProfile: async (userId: string, data: { name?: string | null }): Promise<CleanUser> => {
    try {
      const user = await userRepository.update(userId, data);
      return user;
    } catch (err: any) {
      if (err?.code === "P2025") {
        throw new AppError("User not found.", 404);
      }
      throw err;
    }
  },
};
