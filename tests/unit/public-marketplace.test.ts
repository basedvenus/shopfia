import { describe, expect, it, vi } from "vitest";
import { getExploreCategoryCounts } from "@/lib/data/category-counts";
import {
  isQuarantinedOfferingId,
  isQuarantinedVendorId,
  publicOfferingWhere,
  publicVendorWhere,
  QUARANTINED_OFFERING_IDS,
  QUARANTINED_VENDOR_IDS
} from "@/lib/public-marketplace";

const verifiedVendorIds = [
  "cmv00417g000392dgmtxxlwjz",
  "cmu2v8qua0003i9d2b80nax04",
  "cmu2v60zy000311q88p01juy2"
];
const verifiedOfferingIds = [
  "cmv0042cg000592dgxq7ftq67",
  "cmu2v8qyz0005i9d2e0z92w4b",
  "cmu2v614x000511q8vqpxg9q6"
];

describe("verified public fixture quarantine", () => {
  it("contains only the three publicly verified vendors and offerings", () => {
    expect(QUARANTINED_VENDOR_IDS).toEqual(verifiedVendorIds);
    expect(QUARANTINED_OFFERING_IDS).toEqual(verifiedOfferingIds);
    verifiedVendorIds.forEach((id) => expect(isQuarantinedVendorId(id)).toBe(true));
    verifiedOfferingIds.forEach((id) => expect(isQuarantinedOfferingId(id)).toBe(true));
  });

  it("never classifies similar names, slugs, or unrelated IDs as fixtures", () => {
    for (const id of ["Codex Test Vendor", "codex-test-vendor-1791492049125", "legitimate-unclaimed-vendor", "Codex Test Offering"]) {
      expect(isQuarantinedVendorId(id)).toBe(false);
      expect(isQuarantinedOfferingId(id)).toBe(false);
    }
  });

  it("composes caller ID and OR filters without overriding the quarantine", () => {
    const lookup = { OR: [{ id: verifiedVendorIds[0] }, { slug: "same-slug" }] };
    expect(publicVendorWhere(lookup)).toEqual({
      AND: [{ id: { notIn: verifiedVendorIds } }, lookup]
    });
    expect(publicVendorWhere()).toEqual({ AND: [{ id: { notIn: verifiedVendorIds } }, {}] });
  });

  it("excludes both known offerings and all offerings belonging to a known fixture vendor", () => {
    const lookup = { id: verifiedOfferingIds[0], active: true };
    expect(publicOfferingWhere(lookup)).toEqual({
      AND: [{ id: { notIn: verifiedOfferingIds }, vendorId: { notIn: verifiedVendorIds } }, lookup]
    });
  });

  it("returns fresh predicate arrays rather than shared mutable ID filters", () => {
    const first = publicVendorWhere();
    const second = publicVendorWhere();
    expect(first).toEqual(second);
    expect(first.AND).not.toBe(second.AND);
    const offeringFirst = publicOfferingWhere();
    const offeringSecond = publicOfferingWhere();
    expect(offeringFirst).toEqual(offeringSecond);
    expect(offeringFirst.AND).not.toBe(offeringSecond.AND);
  });

  it("uses the same exclusions in category counts, including nested offering matches", async () => {
    const vendorCount = vi.fn().mockResolvedValue(4);
    const offeringCount = vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    await expect(getExploreCategoryCounts({
      vendorProfile: { count: vendorCount },
      offering: { count: offeringCount }
    }, "category_1")).resolves.toEqual({ vendors: 4, offerings: 6, eventOfferings: 2 });

    const vendorWhere = vendorCount.mock.calls[0][0].where;
    expect(vendorWhere.AND[0]).toEqual({ id: { notIn: verifiedVendorIds } });
    const nestedOffering = vendorWhere.AND[1].OR[1].offerings.some;
    expect(nestedOffering.AND[0]).toEqual({
      id: { notIn: verifiedOfferingIds },
      vendorId: { notIn: verifiedVendorIds }
    });
    for (const [{ where }] of offeringCount.mock.calls) {
      expect(where.AND[0]).toEqual({ id: { notIn: verifiedOfferingIds }, vendorId: { notIn: verifiedVendorIds } });
      expect(where.AND[1].active).toBe(true);
    }
  });
});
