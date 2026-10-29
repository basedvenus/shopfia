import { describe, expect, it } from "vitest";
import { cropImageRect, fitImageZoom, imageCropToCss, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImageCrop } from "@/lib/image-crop";

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

  it("positions zoomed photos in both axes in saved previews", () => {
    expect(imageCropToCss({ x: 32, y: 68, zoom: 2 })).toEqual({
      objectPosition: "32% 68%",
      transform: "translate(18%, -18%) scale(2)",
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

it("preserves saved frame geometry without changing legacy general image crops", async () => {
  const { normalizePartyPhotoCrop } = await import("@/lib/image-crop");
  expect(normalizeImageCrop({ x: 50, y: 50, zoom: 1 })).not.toHaveProperty("aspectRatio");
  expect(normalizePartyPhotoCrop({ x: 50, y: 50, zoom: 1 }).aspectRatio).toBe(4 / 3);
  expect(normalizePartyPhotoCrop({ x: 50, y: 50, zoom: 1, aspectRatio: 1.6 }).aspectRatio).toBe(1.6);
});

describe("original image crop geometry",()=>{
 it("reveals the full portrait at fit zoom instead of shrinking a pre-cropped rectangle",()=>{
  const zoom=fitImageZoom(1200,1800,800,600);
  expect(zoom).toBe(0.5);
  expect(cropImageRect(1200,1800,800,600,{x:50,y:50,zoom})).toEqual({width:400,height:600,x:200,y:0});
  expect(cropImageRect(1200,1800,800,600,{x:50,y:50,zoom:1})).toEqual({width:800,height:1200,x:0,y:-300});
 });
 it("fits a landscape edge to edge horizontally and uses the same framing at export scale",()=>{
  const zoom=fitImageZoom(1800,900,800,600);
  const rect=cropImageRect(1800,900,800,600,{x:50,y:50,zoom});
  expect(rect.width).toBeCloseTo(800);expect(rect.height).toBeCloseTo(400);expect(rect.y).toBeCloseTo(100);
  const exported=cropImageRect(1800,900,1600,1200,{x:50,y:50,zoom});
  expect(exported.width).toBeCloseTo(rect.width*2);expect(exported.y).toBeCloseTo(rect.y*2);
 });
});
