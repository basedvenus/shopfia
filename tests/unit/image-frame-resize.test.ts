import {describe,it,expect} from "vitest";
import {normalizeImageCrop,cropImageRect,fitImageZoom,resizeImageFrame} from "@/lib/image-crop";
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

describe("diagonal frame grips",()=>{
 it.each([[-1,-1],[1,-1],[-1,1],[1,1]])("scales both dimensions from corner %s,%s",(sx,sy)=>{
  const grown=resizeImageFrame(400,200,60,40*sx,20*sy,sx,sy);
  expect(grown.aspectRatio).toBe(2);expect(grown.frameWidth).toBeCloseTo(66);
  const shrunk=resizeImageFrame(400,200,60,-40*sx,-20*sy,sx,sy);
  expect(shrunk.aspectRatio).toBe(2);expect(shrunk.frameWidth).toBeCloseTo(54);
 });
 it("keeps proportions at the available width limit",()=>{
  expect(resizeImageFrame(400,200,95,400,200,1,1)).toEqual({aspectRatio:2,frameWidth:100});
 });
 it("still reshapes the frame from its bottom edge",()=>{
  expect(resizeImageFrame(400,200,60,0,50,0,1)).toEqual({aspectRatio:1.6,frameWidth:60});
 });
});
