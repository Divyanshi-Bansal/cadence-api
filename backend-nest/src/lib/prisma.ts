import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app (avoids exhausting
// the DB connection pool during hot-reloads in development).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// singleton pattern just to make sure that whenever we use new prismaClient()
// it creats a new DB connection, and we dont want that,
// that's why we need this single prisma file to make sure it takes same DB connection.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

// In dev environment we need to make sure that we dont create new prismaClient on every hot reload
// so we use this pattern to make sure we use the same prismaClient instance
// but in production we dont need this because we are not using hot reload
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
