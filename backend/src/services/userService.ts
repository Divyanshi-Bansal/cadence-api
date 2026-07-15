import { userRepository } from "../repositories/userRepository";

/**
 * AppError is thrown by service methods when a business rule is violated.
 * Controllers catch it and convert it into the appropriate HTTP response.
 */
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
  getProfile: async (clerkId: string, email: string, name?: string) => {
    const user = await userRepository.upsert({ clerkId, email, name });
    if (!user) {
      throw new AppError("User not found.", 404);
    }
    return user;
  },

  signUp: async (clerkId: string, email: string, name?: string) => {
    const user = await userRepository.upsert({ clerkId, email, name });
    return user;
  },

  signIn: async (clerkId: string, email: string, name?: string) => {
    const user = await userRepository.upsert({ clerkId, email, name });
    return user;
  },

  // ── POST /api/users/forgot-password ────────────────────────────────────────
  /**
   * Initiates the password reset flow.
   *
   * Because Clerk owns the auth credential, the actual "send reset email"
   * step is triggered by the FRONTEND Clerk SDK:
   *   signIn.create({ strategy: 'reset_password_email_code', identifier: email })
   *
   * This backend endpoint's job is to:
   *   1. Validate the email format (done by Zod in the controller).
   *   2. Return a consistent success response regardless of whether the
   *      email exists (prevents user-enumeration attacks).
   *
   * The frontend should call this endpoint first to validate the email,
   * then immediately call Clerk's frontend SDK to send the actual reset email.
   */
  forgotPassword: async (email: string): Promise<void> => {
    // Intentional: we look up but never expose whether the user was found.
    // This prevents attackers from probing which emails are registered.
    await userRepository.findByEmail(email);
    // No throw — always returns void so the controller sends a 200.
  },

  updateProfile: async (userId: string, data: { name?: string | null }) => {
    try {
      const user = await userRepository.update(userId, data);
      return user;
    } catch (err: any) {
      if (err?.code === "P2025") {
        //prisma specific error codes
        throw new AppError("User not found.", 404);
      }
      throw err;
    }
  },
};

// thumb rule for working with prisma error codes:
// findUnique, findFirst → return null → use if (!user)
// update, delete → throw P2025 → use try/catch + code check
