import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/app/actions/auth", () => ({ createPartyEventAction: vi.fn(), updatePartyEventAction: vi.fn(), followPartyVendorAction: vi.fn() }));
vi.mock("@/app/actions/vendor", () => ({ createUnclaimedVendorAction: vi.fn() }));
vi.mock("@/components/location/place-autocomplete-input", () => ({ PlaceAutocompleteInput: () => null }));
import { PartyEventForm } from "@/components/parties/party-event-form";
const photo = { id: "photo", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect width='800' height='800' fill='%23000000'/%3E%3Crect y='100' width='800' height='600' fill='%23e3a7a7'/%3E%3Ctext x='230' y='300' font-size='60' fill='%23ffffff'%3EParty photo%3C/text%3E%3C/svg%3E", crop: { x: 50, y: 50, zoom: 1 }, vendorIds: [], vendorContributions: {} };
const party = { id: "party", slug: "test-party", title: "Test party", theme: null, tags: [], description: null, location: "Private residence", countyFips: "06095", photos: [photo], appleMusicUrl: "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb", tiktokUrls: ["https://www.tiktok.com/@scout2015/video/6718335390845095173", "https://www.tiktok.com/@scout2015/video/6718335390845095174"] };
describe("party editor organization", () => {
  it("places videos and playlists below the photo grid on the left and moves the tag panel up", () => {
    const html = renderToStaticMarkup(createElement(PartyEventForm, { currentUserId: "owner", initialParty: party, composer: true, users: [], vendors: [] }));
    if (process.env.PARTY_PREVIEW_OUTPUT) { mkdirSync(path.dirname(process.env.PARTY_PREVIEW_OUTPUT), { recursive: true }); writeFileSync(process.env.PARTY_PREVIEW_OUTPUT, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main class="container py-8"><p class="mb-5 text-sm">Local layout verification · sample party</p>${html}</main></body></html>`); }
    expect(html.indexOf('aria-label="Edit photo 1 and tags"')).toBeLessThan(html.indexOf('aria-label="Party links"'));
    expect(html.indexOf('aria-label="Party links"')).toBeLessThan(html.indexOf('aria-label="Party title"'));
    expect(html).toContain('class="order-1 space-y-5');
    expect(html).toContain('class="order-2 space-y-5');
    expect(html).toContain('name="tiktokUrls"');
    expect(html).toContain("Add another video");
    expect(html).toContain("Spotify playlist");
    expect(html).toContain("Pinterest mood board");
    expect(html).toContain('aria-label="County" required=""');
    expect(html).toContain('value="06095" selected=""');
  });
});
