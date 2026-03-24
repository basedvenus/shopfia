import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { db } from "@/lib/db";
import { createListing } from "@/lib/services/marketplace-fees";

describe("public inquiry flow", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("has the inquiry migration applied", async () => {
    const rows = await db.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
      `SELECT migration_name, finished_at
       FROM "_prisma_migrations"
       WHERE migration_name = '20260304190000_add_public_inquiries'`
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.finished_at).not.toBeNull();
  });

  it("submits an inquiry, writes it to the database, and reads it through the admin query", async () => {
    const category = await db.category.findFirst({
      where: {
        audience: "VENDOR"
      },
      select: {
        id: true,
        name: true
      }
    });
    expect(category).toBeTruthy();
    if (!category) {
      return;
    }

    const uniqueKey = Date.now().toString();
    const user = await db.user.create({
      data: {
        email: `codex-vendor-${uniqueKey}@example.com`,
        name: "Codex Test Vendor",
        role: "VENDOR"
      }
    });

    const vendorProfile = await db.vendorProfile.create({
      data: {
        userId: user.id,
        slug: `codex-test-vendor-${uniqueKey}`,
        name: "Codex Test Vendor",
        city: "Austin",
        state: "TX",
        photos: [],
        verified: true
      }
    });

    const offering = await db.offering.create({
      data: {
        vendorId: vendorProfile.id,
        type: "SERVICE",
        title: `Codex Test Offering ${uniqueKey}`,
        slug: `codex-test-offering-${uniqueKey}`,
        description: "Temporary offering used to verify inquiry wiring.",
        basePriceCents: 25000,
        categoryId: category.id,
        tags: ["test"],
        photos: [],
        active: true
      }
    });

    const listing = await createListing({
      vendorProfileId: vendorProfile.id,
      offeringId: offering.id,
      title: offering.title,
      category: category.name,
      description: offering.description,
      priceFrom: offering.basePriceCents,
      city: vendorProfile.city,
      quantity: 1,
      publish: true
    });

    const uniqueEmail = `codex-inquiry-${Date.now()}@example.com`;
    const before = await db.inquiry.count();
    const form = new FormData();
    form.set("vendorProfileId", vendorProfile.id);
    form.set("listingId", listing.id);
    form.set("offeringId", offering.id);
    form.set("name", "Codex Inquiry Test");
    form.set("email", uniqueEmail);
    form.set("phone", "555-0100");
    form.set("eventDate", "2026-04-15");
    form.set("eventLocation", "Austin, TX");
    form.set("budgetDollars", "125.50");
    form.set("message", "Testing the public inquiry flow.");

    const result = await createPublicInquiryAction(form);

    expect(result.success).toBe(true);
    expect(result.inquiryId).toBeTruthy();

    const after = await db.inquiry.count();
    expect(after).toBe(before + 1);

    const saved = await db.inquiry.findUnique({
      where: { id: result.inquiryId },
      include: {
        vendorProfile: true,
        listing: true,
        offering: true
      }
    });

    expect(saved).toBeTruthy();
    expect(saved?.email).toBe(uniqueEmail);
    expect(saved?.vendorProfileId).toBe(vendorProfile.id);
    expect(saved?.listingId).toBe(listing.id);
    expect(saved?.offeringId).toBe(offering.id);
    expect(saved?.budgetCents).toBe(12550);

    const adminFeed = await db.inquiry.findMany({
      include: {
        vendorProfile: true,
        listing: true,
        offering: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    const adminRecord = adminFeed.find((inquiry) => inquiry.id === result.inquiryId);
    expect(adminRecord).toBeTruthy();
    expect(adminRecord?.vendorProfile.name).toBe(vendorProfile.name);
    expect(adminRecord?.listing?.title).toBe(listing.title);

    await db.inquiry.delete({
      where: { id: result.inquiryId }
    });
    await db.user.delete({
      where: { id: user.id }
    });
  }, 20000);
});
