import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StorefrontNavigation } from "@/components/vendor/storefront-navigation";
import { APPROVED_STOREFRONT_SECTIONS, STOREFRONT_LAYOUTS, normalizeStorefrontLayout, sanitizeHiddenStorefrontSections, sanitizeStorefrontSections } from "@/lib/businesses";

function render(visibleSections: readonly string[], sectionLabels = {}) {
  return renderToStaticMarkup(createElement(StorefrontNavigation, { visibleSections, sectionLabels }));
}
describe("storefront navigation", () => {
  it("preserves all links when the matching sections are visible", () => {
    const html = render(APPROVED_STOREFRONT_SECTIONS);
    for (const anchor of ["storefront-home", "services", "portfolio", "about", "reviews", "faq"]) {
      expect(html).toContain(`href="#${anchor}"`);
    }
  });
  it("omits only links whose sections were hidden, retaining required reviews and home", () => {
    const hidden = sanitizeHiddenStorefrontSections(["all-services", "portfolio", "about", "faq", "reviews"]);
    const sections = sanitizeStorefrontSections([]).filter((section) => !hidden.includes(section));
    const html = render(sections);
    for (const anchor of ["services", "portfolio", "about", "faq"]) expect(html).not.toContain(`href="#${anchor}"`);
    expect(html).toContain('href="#reviews"');
    expect(html).toContain('href="#storefront-home"');
  });
  it("keeps customized section labels and their stable anchors", () => {
    expect(render(["portfolio"], { portfolio: "Recent work" })).toContain('href="#portfolio"');
    expect(render(["portfolio"], { portfolio: "Recent work" })).toContain("Recent work");
  });
  it("uses the same visibility list as page sections and preserves the separate inquiry action", () => {
    const source = readFileSync(new URL("../../src/app/vendor/profile/[slug]/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("visibleSections={sectionOrder}");
    expect(source).toContain('const showSection = (section: string) => sectionOrder.includes(section as never)');
    expect(source).toContain('<a href="#inquiry">');
    expect(source).toContain('value={STOREFRONT_LAYOUTS.find((layout) => layout.value === storefrontLayout)!.label}');
    expect(source).not.toContain("vendor.storefrontLayout.toLowerCase()");
  });
  it.each(["PORTFOLIO_FIRST", "PORTFOLIO", null])("displays an existing readable label for layout %s", (value) => {
    expect(STOREFRONT_LAYOUTS.find((layout) => layout.value === normalizeStorefrontLayout(value))?.label).toBe("Portfolio First");
  });
});
