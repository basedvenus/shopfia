import {describe,it,expect} from "vitest";
import {normalizeImageCrop,cropImageRect,fitImageZoom} from "@/lib/image-crop";
describe("resizable image frame",()=>{
 it("preserves frame width and aspect ratio through saved crop normalization",()=>{
  expect(normalizeImageCrop({x:50,y:50,zoom:1,frameWidth:70,aspectRatio:1.2})).toMatchObject({frameWidth:70,aspectRatio:1.2});
  expect(normalizeImageCrop({frameWidth:500,aspectRatio:1})).toMatchObject({frameWidth:100});
 });
 it("fits the whole square logo into a wide frame without clipping it",()=>{
  const zoom=fitImageZoom(1000,1000,600,240);
  const rect=cropImageRect(1000,1000,600,240,{x:50,y:50,zoom});
  expect(zoom).toBeLessThan(1);expect(rect.width).toBeLessThanOrEqual(600);expect(rect.height).toBeLessThanOrEqual(240);
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);
 });
});
