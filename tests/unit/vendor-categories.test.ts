import { describe, expect, it } from "vitest";
import { VENDOR_CATEGORY_NAMES, normalizeVendorCategoryName, normalizeVendorCategoryId } from "@/lib/vendor-categories";
import { UNCLAIMED_VENDOR_CATEGORIES } from "@/lib/unclaimed-vendor";
describe("foundational vendor types", () => {
  it("shares one list across party tagging and vendor taxonomy", () => {
    expect(UNCLAIMED_VENDOR_CATEGORIES).toBe(VENDOR_CATEGORY_NAMES);
    expect(VENDOR_CATEGORY_NAMES.filter((name) => name === "Entertainment")).toHaveLength(1);
    expect(VENDOR_CATEGORY_NAMES).not.toContain("Children's Entertainment");
    expect(new Set(VENDOR_CATEGORY_NAMES).size).toBe(VENDOR_CATEGORY_NAMES.length);
  });
  it.each(["Children's Entertainment", "Children’s Entertainment", "Kids Entertainment"])("maps legacy label %s to Entertainment", (name) => {
    expect(normalizeVendorCategoryName(name)).toBe("Entertainment");
  });
  it("preserves old search links and leaves unrelated categories alone", () => {
    expect(normalizeVendorCategoryId("cmm8wteb5000599moyu2w5541")).toBe("standard-vendor-entertainment");
    expect(normalizeVendorCategoryName("Florals")).toBe("Florals");
    expect(normalizeVendorCategoryId("florals-id")).toBe("florals-id");
  });
});
