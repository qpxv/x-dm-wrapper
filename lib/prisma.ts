import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Runtime queries go through the pooled connection; migrations use DIRECT_URL
// via prisma.config.ts instead.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
