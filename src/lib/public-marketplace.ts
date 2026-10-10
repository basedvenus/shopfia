import type { Prisma } from "@prisma/client";

// Verified public fixtures matching the inquiry-flow integration test writer.
// Keep the quarantine exact-ID only: names, slugs, ownership and status are not
// evidence that another business is a fixture. This only affects public reads;
// the records remain available to their owners and administrators.
export const QUARANTINED_VENDOR_IDS = [
  "cmv00417g000392dgmtxxlwjz",
  "cmu2v8qua0003i9d2b80nax04",
  "cmu2v60zy000311q88p01juy2"
] as const;

export const QUARANTINED_OFFERING_IDS = [
  "cmv0042cg000592dgxq7ftq67",
  "cmu2v8qyz0005i9d2e0z92w4b",
  "cmu2v614x000511q8vqpxg9q6"
] as const;

export function isQuarantinedVendorId(id: string) {
  return QUARANTINED_VENDOR_IDS.some((fixtureId) => fixtureId === id);
}

export function isQuarantinedOfferingId(id: string) {
  return QUARANTINED_OFFERING_IDS.some((fixtureId) => fixtureId === id);
}

export function publicVendorWhere(where: Prisma.VendorProfileWhereInput = {}): Prisma.VendorProfileWhereInput {
  return {
    AND: [{ id: { notIn: [...QUARANTINED_VENDOR_IDS] } }, where]
  };
}

export function publicOfferingWhere(where: Prisma.OfferingWhereInput = {}): Prisma.OfferingWhereInput {
  return {
    AND: [
      {
        id: { notIn: [...QUARANTINED_OFFERING_IDS] },
        vendorId: { notIn: [...QUARANTINED_VENDOR_IDS] }
      },
      where
    ]
  };
}
