import { describe, expect, it, vi } from "vitest";
import { collectPartyVendorRatings, persistPartyVendorRatings } from "@/lib/party-vendor-ratings";
describe("one party rating per user and vendor", () => {
  it("shares a rating across photos, ignores ratings for vendors not tagged, and retains saved ratings", () => {
    expect(collectPartyVendorRatings([{ vendorIds: ["v"], vendorRatings: { v: 5, unrelated: 2 } }, { vendorIds: ["v"] }], { saved: 4 })).toEqual({ v: 5, saved: 4 });
  });
  it("writes duplicate tags once and keeps different users' keys separate", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const tx = { partyVendorRating: { upsert } } as unknown as Parameters<typeof persistPartyVendorRatings>[0];
    await persistPartyVendorRatings(tx, "party", "user-a", ["vendor", "vendor"], { vendor: 5 });
    await persistPartyVendorRatings(tx, "party", "user-b", ["vendor"], { vendor: 3 });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(([call]) => call.where.eventId_userId_vendorId.userId)).toEqual(["user-a", "user-b"]);
  });
});
