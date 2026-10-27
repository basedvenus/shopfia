import countyData from "@/lib/data/us-counties.json";
// U.S. Census Bureau 2026 Gazetteer. County internal points, never home coordinates.
export const US_COUNTIES = countyData;
export const COUNTY_STATES = [...new Set(countyData.map((county) => county.state))].sort();
const countiesByFips = new Map(countyData.map((county) => [county.fips, county]));
export function getCounty(fips?: string | null) { return fips ? countiesByFips.get(fips) ?? null : null; }
export function privatePartyLocation(fips?: string | null) {
  const county = getCounty(fips);
  if (!county) return null;
  return { location: "Private residence", formattedAddress: null, city: null, state: county.state, zipCode: null, googlePlaceId: null, county: county.name, countyFips: county.fips, locationLat: county.lat, locationLng: county.lng };
}
export function countyDistance(party: { locationLat?: number | null; locationLng?: number | null }, county: { lat: number; lng: number } | null) {
  if (!county || party.locationLat == null || party.locationLng == null) return Infinity;
  const rad = Math.PI / 180;
  const a = Math.sin((party.locationLat - county.lat) * rad / 2) ** 2 + Math.cos(county.lat * rad) * Math.cos(party.locationLat * rad) * Math.sin((party.locationLng - county.lng) * rad / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
