import { describe, expect, it } from "vitest";
import { offeringSchema, vendorOnboardingSchema } from "@/lib/validators/vendor";

describe("vendor validators", () => {
  it("requires at least one vendor category during business setup", () => {
    const result = vendorOnboardingSchema.safeParse({
      name: "Venus & Aura",
      slug: "venus-aura-second",
      username: "venus.aura.second",
      city: "Napa",
      categoryIds: []
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["categoryIds"]);
  });

  it("accepts persisted category IDs that are not Prisma cuid strings", () => {
    const result = vendorOnboardingSchema.safeParse({
      name: "Venus & Aura",
      slug: "venus-aura-second",
      username: "venus.aura.second",
      city: "Napa",
      categoryIds: ["vendor-catering-beverages"]
    });

    expect(result.success).toBe(true);
  });

  it("accepts service category IDs from legacy or migrated category records", () => {
    const result = offeringSchema.safeParse({
      type: "SERVICE",
      title: "Tablescape Styling",
      slug: "tablescape-styling",
      description: "Custom styling support for thoughtful celebration tables and floral moments.",
      categoryIds: ["vendor-styling-decor"],
      eventCategoryIds: ["ALL"],
      photos: []
    });

    expect(result.success).toBe(true);
  });
});
