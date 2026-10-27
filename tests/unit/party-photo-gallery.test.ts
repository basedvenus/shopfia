import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PartyPhotoGallery } from "@/components/parties/party-photo-gallery";
describe("public party gallery", () => {
  it("turns each photo into a labelled viewer trigger and preserves vendor anchors", () => {
    const html = renderToStaticMarkup(createElement(PartyPhotoGallery, { title: "Birthday", photos: [{ id: "one", url: "/api/party-photos/one?w=1400", fullUrl: "/api/party-photos/one", crop: { x: 50, y: 50, zoom: 1 }, vendorAnchors: ["vendor-florist-photos"] }] }));
    expect(html).toContain('aria-label="Enlarge Birthday photo 1"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('id="vendor-florist-photos"');
    expect(html).toContain('id="party-gallery"');
  });
  it("handles a party with no photos", () => {
    expect(renderToStaticMarkup(createElement(PartyPhotoGallery, { title: "Party", photos: [] }))).toContain("No party photos have been added yet.");
  });
});
