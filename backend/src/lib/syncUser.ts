import { prisma } from './prisma';

interface ClerkUserPayload {
  clerkId: string;       // sub from the verified JWT
  email: string;         // primary email address
  name?: string;         // optional display name
}

/**
 * Ensures a Clerk user has a matching row in our User table.
 *
 * - If the user already exists (matched on clerkId) → returns the existing record.
 * - If the user is new → creates a minimal record and returns it.
 *
 * Call this once per authenticated request (or just on first-hit routes).
 * Using upsert keeps the logic idempotent so repeated calls are safe.
 */
export async function syncUser({ clerkId, email, name }: ClerkUserPayload) {
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email,
      name: name ?? null,
    },
  });

  return user;
}