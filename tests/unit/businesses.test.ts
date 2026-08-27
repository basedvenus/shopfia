import { describe, expect, it } from "vitest";
import {
  businessManagerWhere,
  isReservedStorefrontSlug,
  sanitizeStorefrontSections,
  slugifyBusinessUrl,
  storefrontPath
} from "@/lib/businesses";

describe("business storefront utilities", () => {
  it("suggests public storefront slugs from business names", () => {
    expect(slugifyBusinessUrl("Venus & Aura")).toBe("venus-and-aura");
    expect(storefrontPath("Venus & Aura")).toBe("/venus-and-aura");
  });

  it("blocks reserved storefront URL endings", () => {
    expect(isReservedStorefrontSlug("admin")).toBe(true);
    expect(isReservedStorefrontSlug("login")).toBe(true);
    expect(isReservedStorefrontSlug("explore")).toBe(true);
    expect(isReservedStorefrontSlug("settings")).toBe(true);
    expect(isReservedStorefrontSlug("businesses")).toBe(true);
    expect(isReservedStorefrontSlug("venus-and-aura")).toBe(false);
  });

  it("filters business dashboards by legacy owner or manager membership", () => {
    expect(businessManagerWhere("user_1", "VENDOR")).toEqual({
      OR: [
        { userId: "user_1" },
        { managers: { some: { userId: "user_1" } } }
      ]
    });
    expect(businessManagerWhere("admin_1", "ADMIN")).toEqual({});
  });

  it("keeps only approved storefront sections", () => {
    expect(sanitizeStorefrontSections(["portfolio", "custom-html", "about"])).toEqual([
      "portfolio",
      "about",
      "hero",
      "services",
      "featured-parties",
      "reviews",
      "service-area",
      "inquiry-form",
      "social-links"
    ]);
  });
});
