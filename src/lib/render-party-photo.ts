import sharp from "sharp";
import { normalizePartyPhotoCrop } from "@/lib/image-crop";

/** Render the saved frame into the actual public pixels, including enlarged views. */
export async function renderPartyPhoto(data: Buffer, cropValue: unknown, requestedWidth = 2400) {
  const crop = normalizePartyPhotoCrop(cropValue);
  const { data: oriented, info } = await sharp(data).rotate().toBuffer({ resolveWithObject: true });
  const ratio = crop.aspectRatio!;
  const width = Math.max(1, Math.round(Math.min(requestedWidth, info.width, 2400, 2400 * ratio)));
  const height = Math.max(1, Math.round(width / ratio));
  const scale = Math.max(width / info.width, height / info.height);
  const zoom = crop.zoom;
  const offset = (frame: number, natural: number, position: number) =>
    frame * (1 - zoom) / 2 + (0.5 - position) * Math.max(0, zoom - 1) * frame + zoom * (frame - natural * scale) * position;
  const x = offset(width, info.width, crop.x / 100);
  const y = offset(height, info.height, crop.y / 100);
  const left = Math.max(0, Math.min(info.width - 1, Math.round(-x / (scale * zoom))));
  const top = Math.max(0, Math.min(info.height - 1, Math.round(-y / (scale * zoom))));
  const destLeft = Math.max(0, Math.round(x));
  const destTop = Math.max(0, Math.round(y));
  const visibleWidth = Math.max(1, Math.min(width - destLeft, Math.round(info.width * scale * zoom + x) - destLeft));
  const visibleHeight = Math.max(1, Math.min(height - destTop, Math.round(info.height * scale * zoom + y) - destTop));
  const extractWidth = Math.max(1, Math.min(info.width - left, Math.round(visibleWidth / (scale * zoom))));
  const extractHeight = Math.max(1, Math.min(info.height - top, Math.round(visibleHeight / (scale * zoom))));
  const frame = await sharp(oriented)
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .resize(visibleWidth, visibleHeight, { fit: "fill" })
    .modulate({ brightness: crop.brightness ?? 1, saturation: crop.saturation ?? 1 })
    .png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: "#fff8f5" } })
    .composite([{ input: frame, left: destLeft, top: destTop }]).webp({ quality: 88 }).toBuffer();
}
