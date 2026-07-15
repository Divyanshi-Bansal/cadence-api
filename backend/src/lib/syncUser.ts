/**
 * @deprecated
 * syncUser has been superseded by `userRepository.upsert()`.
 * Use `userService.signIn()` or `userService.signUp()` from the service layer instead.
 * This file is kept for reference only and will be removed in a future cleanup.
 */
import { prisma } from './prisma';

interface ClerkUserPayload {
  clerkId: string;
  email: string;
  name?: string;
}

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