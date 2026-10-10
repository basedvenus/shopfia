import type { PrismaClient as PrismaClientType } from "@prisma/client";
import PrismaClientModule, { PrismaClient, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { requireIntegrationDatabaseUrl, withRollbackTransaction } from "../helpers/integration-database";

const localUrl = "postgresql://test:test@127.0.0.1:5433/shopfia_test_inquiries";

describe("test database safety", () => {
  it("blocks a real Prisma client while retaining Prisma enum exports", () => {
    expect(() => new PrismaClient()).toThrow("Real PrismaClient is disabled in unit tests");
    expect(() => new PrismaClientModule.PrismaClient()).toThrow("Real PrismaClient is disabled in unit tests");
    expect(UserRole.BUYER).toBe("BUYER");
  });

  it("blocks the unmocked application database module", async () => {
    await expect(import("@/lib/db")).rejects.toThrow("Real PrismaClient is disabled in unit tests");
  });

  it("replaces an inherited application database URL with a disabled loopback target", () => {
    expect(process.env.DATABASE_URL).toBe("postgresql://unit:unit@127.0.0.1:1/shopfia_test_unit_disabled");
  });

  it("requires both explicit opt-in and a separate test URL", () => {
    expect(() => requireIntegrationDatabaseUrl({ TEST_DATABASE_URL: localUrl })).toThrow("opt-in");
    expect(() => requireIntegrationDatabaseUrl({ RUN_DB_INTEGRATION_TESTS: "1", DATABASE_URL: localUrl })).toThrow("TEST_DATABASE_URL is required");
  });

  it.each([
    "not a URL",
    "https://127.0.0.1:5433/shopfia_test_inquiries",
    "postgresql://test:test@database.example.com:5433/shopfia_test_inquiries",
    "postgresql://test:test@localhost:5433/shopfia_test_inquiries",
    "postgresql://test:test@127.0.0.1:5433/shopfia",
    "postgresql://test:test@127.0.0.1:5433/shopfia_test_",
    "postgresql://test:test@127.0.0.1/shopfia_test_inquiries",
    "postgresql://test:test@127.0.0.1:0/shopfia_test_inquiries",
    "postgresql://test:test@127.0.0.1:99999/shopfia_test_inquiries",
    `${localUrl}?host=database.example.com`,
    `${localUrl}?schema=production`,
    `${localUrl}#production`
  ])("rejects unsafe integration target %s", (url) => {
    expect(() => requireIntegrationDatabaseUrl({ RUN_DB_INTEGRATION_TESTS: "1", TEST_DATABASE_URL: url })).toThrow();
  });

  it.each([localUrl, "postgresql://test:test@[::1]:5433/shopfia_test_inquiries"])("accepts an explicit disposable loopback target %s", (url) => {
    expect(requireIntegrationDatabaseUrl({ RUN_DB_INTEGRATION_TESTS: "1", TEST_DATABASE_URL: url, DATABASE_URL: "postgresql://production.invalid/app" })).toBe(url);
  });

  it("forces rollback even when all integration assertions pass", async () => {
    const tx = {};
    const aborted: unknown[] = [];
    const transaction = vi.fn(async (run: (value: object) => Promise<void>) => {
      try {
        return await run(tx);
      } catch (error) {
        aborted.push(error);
        throw error;
      }
    });
    const assertions = vi.fn(async () => {});
    await withRollbackTransaction({ $transaction: transaction } as unknown as PrismaClientType, assertions);
    expect(assertions).toHaveBeenCalledTimes(1);
    expect(assertions).toHaveBeenCalledWith(tx);
    expect(aborted).toHaveLength(1);
    expect(aborted[0]).toEqual(new Error("Roll back integration test fixtures"));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 20_000 });
  });

  it("preserves assertion failures while aborting the integration transaction", async () => {
    const failure = new Error("assertion failed");
    const transaction = vi.fn(async (run: (value: object) => Promise<void>) => run({}));
    await expect(withRollbackTransaction({ $transaction: transaction } as unknown as PrismaClientType, async () => {
      throw failure;
    })).rejects.toBe(failure);
  });
});
