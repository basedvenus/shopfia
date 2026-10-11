import { describe, expect, it } from "vitest";
import { recommendStorefrontLook, STOREFRONT_LOOKS } from "@/lib/storefront-looks";
import { STOREFRONT_FONT_STYLE_VALUES, STOREFRONT_LAYOUT_VALUES, STOREFRONT_PALETTE_VALUES, STOREFRONT_IMAGE_SHAPES } from "@/lib/businesses";

describe("coordinated storefront looks", () => {
  it("suggests a relevant look from the business story without requiring design choices", () => {
    expect(recommendStorefrontLook("Moon Matcha mobile cart").id).toBe("botanical");
    expect(recommendStorefrontLook("Wedding cake bakery").id).toBe("romantic");
    expect(recommendStorefrontLook("Birthday balloon installations").id).toBe("playful");
    expect(recommendStorefrontLook("").id).toBe("boutique");
  });
  it("uses supported values that publish and render on the existing storefront", () => {
    for (const look of STOREFRONT_LOOKS) {
      expect(STOREFRONT_FONT_STYLE_VALUES).toContain(look.fontStyle);
      expect(STOREFRONT_LAYOUT_VALUES).toContain(look.layout);
      expect(STOREFRONT_PALETTE_VALUES).toContain(look.palette);
      expect(STOREFRONT_IMAGE_SHAPES.map((shape) => shape.value)).toContain(look.imageShape);
    }
  });
});
