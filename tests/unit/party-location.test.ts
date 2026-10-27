import { describe, expect, it } from "vitest";
import { getCounty, privatePartyLocation, countyDistance, US_COUNTIES } from "@/lib/party-location";
describe("private party counties", () => {
  it("has a complete unique national county list", () => {
    expect(US_COUNTIES.length).toBeGreaterThan(3200);
    expect(new Set(US_COUNTIES.map((county) => county.fips)).size).toBe(US_COUNTIES.length);
    expect(getCounty("06095")).toMatchObject({ name: "Solano County", state: "CA" });
  });
  it("uses canonical county points and discards private address fields", () => {
    expect(privatePartyLocation("06095")).toMatchObject({ location: "Private residence", county: "Solano County", state: "CA", city: null, formattedAddress: null, zipCode: null, googlePlaceId: null });
    expect(privatePartyLocation("99999")).toBeNull();
  });
  it("sorts by real approximate distances rather than a fixed city list", () => {
    const solano = getCounty("06095")!;
    expect(countyDistance({ locationLat: solano.lat, locationLng: solano.lng }, solano)).toBe(0);
    expect(countyDistance({ locationLat: 40.7, locationLng: -74 }, solano)).toBeGreaterThan(2000);
    expect(countyDistance({}, solano)).toBe(Infinity);
  });
});
