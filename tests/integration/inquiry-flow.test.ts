import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { requireIntegrationDatabaseUrl, withRollbackTransaction } from "../helpers/integration-database";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  userId: "",
  transaction: null as Prisma.TransactionClient | null
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: state.userId, role: "BUYER" } }))
}));

vi.mock("@/lib/security/request", () => ({
  checkServerActionRateLimit: vi.fn(async () => ({ ok: true }))
}));

// Real DB integration never needs to send email or use inherited SMTP secrets.
vi.mock("@/lib/email", () => ({ sendNewInquiryEmail: vi.fn(async () => ({ ok: true })) }));

// Application services use this same outer transaction, including calls that
// ordinarily start their own transaction. No application write can commit here.
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const transaction = state.transaction;
      if (!transaction) throw new Error("Integration DB access requires the rollback transaction.");
      if (property === "$transaction") {
        return (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(transaction);
      }
      const value = Reflect.get(transaction, property);
      return typeof value === "function" ? value.bind(transaction) : value;
    }
  })
}));

import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { createListing } from "@/lib/services/marketplace-fees";

// Check again in the test file so invoking it through another config cannot
// bypass the gate. Explicit datasource prevents fallback to DATABASE_URL/.env.
const db = new PrismaClient({
  datasources: { db: { url: requireIntegrationDatabaseUrl(process.env) } }
});

describe("public inquiry flow (disposable local database only)", () => {
  afterAll(async () => { await db.$disconnect(); });

  it("has the inquiry migration applied", async () => {
    const rows = await db.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at FROM "_prisma_migrations"
      WHERE migration_name = '20260304190000_add_public_inquiries'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.finished_at).not.toBeNull();
  });

  it("submits an inquiry, reads it through the admin query, and rolls back every fixture", async () => {
    const uniqueKey = randomUUID();
    const vendorSlug = `codex-test-vendor-${uniqueKey}`;
    const categoryName = `Inquiry test ${uniqueKey}`;
    const buyerEmail = `codex-buyer-${uniqueKey}@example.com`;
    const vendorEmail = `codex-vendor-${uniqueKey}@example.com`;

    try {
      await withRollbackTransaction(db, async (tx) => {
        state.transaction = tx;
        // No seeded data is required, and even shared fee configuration created
        // by createListing is contained in this transaction.
        const category = await tx.category.create({
          data: { name: categoryName, iconName: "test", audience: "VENDOR" }
        });
        const buyer = await tx.user.create({
          data: { email: buyerEmail, name: "Codex Test Buyer", role: "BUYER" }
        });
        state.userId = buyer.id;
        const user = await tx.user.create({
          data: { email: vendorEmail, name: "Codex Test Vendor", role: "VENDOR" }
        });
        const vendorProfile = await tx.vendorProfile.create({
          data: {
            userId: user.id, slug: vendorSlug, name: "Codex Test Vendor",
            city: "Fairfield", state: "CA", photos: [], verified: true
          }
        });
        const offering = await tx.offering.create({
          data: {
            vendorId: vendorProfile.id, type: "SERVICE",
            title: `Codex Test Offering ${uniqueKey}`, slug: `codex-test-offering-${uniqueKey}`,
            description: "Temporary offering used to verify inquiry wiring.",
            basePriceCents: 25000, categoryId: category.id, tags: ["test"], photos: [], active: true
          }
        });
        const listing = await createListing({
          vendorProfileId: vendorProfile.id, offeringId: offering.id,
          title: offering.title, category: category.name, description: offering.description,
          priceFrom: offering.basePriceCents, city: vendorProfile.city, quantity: 1, publish: true
        });

        const uniqueEmail = `codex-inquiry-${uniqueKey}@example.com`;
        const form = new FormData();
        for (const [key, value] of Object.entries({
          vendorProfileId: vendorProfile.id, listingId: listing.id, offeringId: offering.id,
          name: "Codex Inquiry Test", email: uniqueEmail, phone: "555-0100",
          eventDate: "2030-04-15", eventLocation: "Fairfield, CA", budgetDollars: "125.50",
          message: "Testing the public inquiry flow."
        })) form.set(key, value);

        const result = await createPublicInquiryAction(form);
        expect(result.success).toBe(true);
        expect(result.inquiryId).toBeTruthy();

        const saved = await tx.inquiry.findUnique({
          where: { id: result.inquiryId },
          include: { vendorProfile: true, listing: true, offering: true }
        });
        expect(saved).toMatchObject({
          email: uniqueEmail, vendorProfileId: vendorProfile.id, listingId: listing.id,
          offeringId: offering.id, budgetCents: 12550
        });
        expect(await tx.inquiry.count({ where: { buyerId: buyer.id } })).toBe(1);
        expect(await tx.quoteRequest.findUnique({ where: { inquiryId: result.inquiryId } })).toMatchObject({
          buyerId: buyer.id, conversationId: result.conversationId
        });

        const adminFeed = await tx.inquiry.findMany({
          include: { vendorProfile: true, listing: true, offering: true },
          orderBy: { createdAt: "desc" }, take: 20
        });
        const adminRecord = adminFeed.find((inquiry) => inquiry.id === result.inquiryId);
        expect(adminRecord?.vendorProfile.name).toBe(vendorProfile.name);
        expect(adminRecord?.listing?.title).toBe(listing.title);
      });
    } finally {
      state.transaction = null;
      state.userId = "";
    }

    // Deleting just the vendor user used to orphan VendorProfile (SetNull).
    // Assert directly that rollback removed the profile and other root fixtures.
    expect(await db.vendorProfile.findUnique({ where: { slug: vendorSlug } })).toBeNull();
    expect(await db.category.findUnique({ where: { name: categoryName } })).toBeNull();
    expect(await db.user.count({ where: { email: { in: [buyerEmail, vendorEmail] } } })).toBe(0);
  }, 30_000);
});
