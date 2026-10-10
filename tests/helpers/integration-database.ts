import type { Prisma, PrismaClient } from "@prisma/client";

type Environment = Record<string, string | undefined>;

// Never fall back to DATABASE_URL or load an application's .env file here.
export function requireIntegrationDatabaseUrl(env: Environment): string {
  if (env.RUN_DB_INTEGRATION_TESTS !== "1") {
    throw new Error("Database tests are opt-in: set RUN_DB_INTEGRATION_TESTS=1 only for a disposable local test database.");
  }

  const value = env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error("TEST_DATABASE_URL is required; DATABASE_URL is never used by integration tests.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.port || Number(url.port) < 1 || Number(url.port) > 65535 ||
    !/^\/shopfia_test_[a-z0-9_]+$/.test(url.pathname) ||
    url.search || url.hash
  ) {
    throw new Error("TEST_DATABASE_URL must target 127.0.0.1 or [::1], have an explicit port and a shopfia_test_* database, and contain no query parameters or fragment. Use a disposable local database, never a production tunnel.");
  }

  return value;
}

// A thrown assertion and a passing test both abort the outer transaction.
// This also rolls back profiles with onDelete: SetNull and shared fee config.
export async function withRollbackTransaction(
  db: PrismaClient,
  run: (tx: Prisma.TransactionClient) => Promise<void>
) {
  const rollback = new Error("Roll back integration test fixtures");
  try {
    await db.$transaction(async (tx) => {
      await run(tx);
      throw rollback;
    }, { timeout: 20_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
