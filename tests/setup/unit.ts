import { vi } from "vitest";

// Unit tests may use Prisma enums/types, but must explicitly mock their DB calls.
// Even an accidental direct PrismaClient import cannot connect to a real DB.
vi.mock("@prisma/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prisma/client")>();
  class DisabledPrismaClient {
    constructor() {
      throw new Error("Real PrismaClient is disabled in unit tests. Mock @/lib/db or use the gated integration suite.");
    }
  }
  return {
    ...original,
    PrismaClient: DisabledPrismaClient,
    default: { ...original, PrismaClient: DisabledPrismaClient }
  };
});
