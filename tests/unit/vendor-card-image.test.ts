import { describe, expect, it } from "vitest";
import { getVendorCardImage } from "@/lib/vendor-card-image";
const photo = {id: "tagged-photo", updatedAt: new Date("2026-11-05T00:00:00Z"), crop: {x: 20, y: 70, zoom: 1.5}};
const vendor = {status: "UNCLAIMED", offerings: [], coverPhoto: null, photos: [], taggedPartyPhotos: [photo]};
describe("Explore vendor card image", () => {
  it("uses a tagged party photo and its crop as the unclaimed vendor fallback", () => {
    const image = getVendorCardImage(vendor);
    expect(image?.src).toContain("/api/party-photos/tagged-photo");
    expect(image?.partyCrop).toMatchObject(photo.crop);
  });
  it("keeps service and profile images ahead of the party fallback", () => {
    expect(getVendorCardImage({...vendor, offerings: [{photos: ["service.jpg"]}]} )?.src).toBe("service.jpg");
    expect(getVendorCardImage({...vendor, coverPhoto: "cover.jpg"})?.src).toBe("cover.jpg");
    expect(getVendorCardImage({...vendor, photos: ["profile.jpg"]})?.src).toBe("profile.jpg");
  });
  it("leaves the placeholder when there is no published tagged photo or the vendor is claimed", () => {
    expect(getVendorCardImage({...vendor, taggedPartyPhotos: []})).toBeNull();
    expect(getVendorCardImage({...vendor, status: "CLAIMED"})).toBeNull();
  });
});
