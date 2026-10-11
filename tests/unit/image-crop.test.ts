import { describe, expect, it } from "vitest";
import { imageCropToCss, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImageCrop } from "@/lib/image-crop";

describe("image crop utilities", () => {
  it("allows wider zoomed-out crops for profile and storefront images", () => {
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 0.5 })).toEqual({
      x: 50,
      y: 50,
      zoom: 0.5,
      brightness: 1,
      saturation: 1
    });
  });

  it("clamps crop zoom to the supported editor range", () => {
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 0.05 }).zoom).toBe(MIN_IMAGE_ZOOM);
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 10 }).zoom).toBe(MAX_IMAGE_ZOOM);
  });

  it("keeps crop scaling centered so saved previews do not drift", () => {
    expect(imageCropToCss({ x: 32, y: 68, zoom: 1.4 })).toEqual({
      objectPosition: "32% 68%",
      transform: "scale(1.4)",
      filter: "brightness(1) saturate(1)"
    });
  });
  it("preserves saved brightness and saturation when reopening a photo", () => {
    const saved = normalizeImageCrop({ x: 40, y: 60, zoom: 1.2, brightness: 1.25, saturation: 0.8 });
    expect(normalizeImageCrop(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(imageCropToCss(saved).filter).toBe("brightness(1.25) saturate(0.8)");
  });
  it("bounds image adjustments and keeps older photos at their original appearance", () => {
    expect(normalizeImageCrop({ brightness: 10, saturation: -1 })).toMatchObject({ brightness: 1.5, saturation: 0 });
    expect(imageCropToCss(null).filter).toBe("brightness(1) saturate(1)");
  });
});
