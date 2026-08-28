import { describe, expect, it } from "vitest";
import { MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImageCrop } from "@/lib/image-crop";

describe("image crop utilities", () => {
  it("allows wider zoomed-out crops for profile and storefront images", () => {
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 0.5 })).toEqual({
      x: 50,
      y: 50,
      zoom: 0.5
    });
  });

  it("clamps crop zoom to the supported editor range", () => {
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 0.05 }).zoom).toBe(MIN_IMAGE_ZOOM);
    expect(normalizeImageCrop({ x: 50, y: 50, zoom: 10 }).zoom).toBe(MAX_IMAGE_ZOOM);
  });
});
