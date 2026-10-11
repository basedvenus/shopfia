import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page, { metadata } from "@/app/page";

const html = renderToStaticMarkup(createElement(Page));
describe("vendor-first homepage", () => {
  it("leads with the requested headline and vendor discovery", () => {
    expect(html).toContain("Your one-stop shop for party planning");
    expect(html.indexOf("Find Local Vendors")).toBeLessThan(html.indexOf("Explore Real Events"));
    expect(html).toMatch(/href="\/explore"[^>]*>Find Local Vendors/);
    expect(metadata.description).toContain("Find local vendors");
  });
  it("keeps decorative inspiration disclosed and separate from real events", () => {
    for (const title of ["Positano Brunch", "Spring Cookies", "Table Arrangements", "Tablescapes"]) {
      expect(html).toContain(`${title} — inspiration example`);
    }
    expect(html).toContain("Inspiration examples");
    expect(html).toContain("Discover through real events, then find your vendor.");
    for (const misleading of ["Every vendor is discovered", "trusted vendors", "Recently Added Vendors", "Built from real parties", "Start with the celebration, not a search form", "Save what you love and book the look"]) {
      expect(html).not.toContain(misleading);
    }
  });
  it("links services to existing Explore searches and has no nested button links", () => {
    for (const category of ["cakes", "balloons", "florals", "decor", "cookies", "rentals", "photography", "bartending"]) expect(html).toContain(`href="/explore?q=${category}"`);
    expect(html).not.toContain("<button");
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(html).not.toContain("photo-1519225421980-715cb0215aed");
  });
});
