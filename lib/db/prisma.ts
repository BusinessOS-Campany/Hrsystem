import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  // Prisma's default relation strategy issues one query per relation. That is
  // especially expensive on serverless + pooled Postgres, where every round
  // trip costs milliseconds. Joining relations keeps list/detail pages to one
  // database round trip without changing query results.
  return client.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          return query({ ...args, relationLoadStrategy: "join" });
        },
        async findFirst({ args, query }) {
          return query({ ...args, relationLoadStrategy: "join" });
        },
        async findUnique({ args, query }) {
          return query({ ...args, relationLoadStrategy: "join" });
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
