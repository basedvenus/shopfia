import { expect, it } from "vitest";
import sharp from "sharp";
import { renderPartyPhoto } from "@/lib/render-party-photo";

async function source() {
  const band = async (background: string) => sharp({ create: { width: 100, height: 100, channels: 3, background } }).png().toBuffer();
  return sharp({ create: { width: 300, height: 100, channels: 3, background: "black" } }).composite([
    { input: await band("red"), left: 0, top: 0 },
    { input: await band("#00ff00"), left: 100, top: 0 },
    { input: await band("blue"), left: 200, top: 0 }
  ]).png().toBuffer();
}

it("removes excluded pixels from the actual full-size image", async () => {
  const output = await renderPartyPhoto(await source(), { x: 50, y: 50, zoom: 1, aspectRatio: 1 }, 100);
  const meta = await sharp(output).metadata();
  const stats = await sharp(output).stats();
  expect([meta.width, meta.height]).toEqual([100, 100]);
  expect(stats.channels[0].mean).toBeLessThan(5);
  expect(stats.channels[1].mean).toBeGreaterThan(250);
  expect(stats.channels[2].mean).toBeLessThan(5);
});

it("honors saved position and zoom without exposing the other bands", async () => {
  const output = await renderPartyPhoto(await source(), { x: 0, y: 50, zoom: 2, aspectRatio: 1 }, 100);
  const stats = await sharp(output).stats();
  expect(stats.channels[0].mean).toBeGreaterThan(250);
  expect(stats.channels[1].mean).toBeLessThan(5);
  expect(stats.channels[2].mean).toBeLessThan(5);
});

it("preserves the selected aspect ratio at thumbnail and large sizes", async () => {
  for (const width of [96, 600]) {
    const output = await renderPartyPhoto(await source(), { x: 50, y: 50, zoom: 1.64, aspectRatio: 4 / 3 }, width);
    const meta = await sharp(output).metadata();
    expect(Math.abs(meta.width! / meta.height! - 4 / 3)).toBeLessThan(0.02);
  }
});
