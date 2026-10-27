import type { Prisma } from "@prisma/client";

export type ImageCrop = {
  x: number;
  y: number;
  zoom: number;
  brightness?: number;
  saturation?: number;
  aspectRatio?: number;
};

export const DEFAULT_IMAGE_CROP: ImageCrop = {
  x: 50,
  y: 50,
  zoom: 1
};

export const MIN_IMAGE_ZOOM = 0.25;
export const MAX_IMAGE_ZOOM = 3;

export function normalizeImageCrop(value: unknown): ImageCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_IMAGE_CROP;
  }

  const record = value as Record<string, unknown>;
  return {
    x: clampNumber(record.x, 0, 100, DEFAULT_IMAGE_CROP.x),
    y: clampNumber(record.y, 0, 100, DEFAULT_IMAGE_CROP.y),
    zoom: clampNumber(record.zoom, MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM, DEFAULT_IMAGE_CROP.zoom),
    brightness: clampNumber(record.brightness ?? 1, 0.5, 1.5, 1),
    saturation: clampNumber(record.saturation ?? 1, 0, 2, 1),
    ...(record.aspectRatio != null ? { aspectRatio: clampNumber(record.aspectRatio, 0.1, 10, 4 / 3) } : {})
  };
}

/** Older party crops were composed in the editor's 4:3 frame. */
export function normalizePartyPhotoCrop(value: unknown): ImageCrop {
  const crop = normalizeImageCrop(value);
  return { ...crop, aspectRatio: crop.aspectRatio ?? 4 / 3 };
}

export function parseImageCrop(value: FormDataEntryValue | null | undefined): Prisma.InputJsonObject | undefined {
  if (!value) return undefined;

  try {
    return normalizeImageCrop(JSON.parse(String(value))) as Prisma.InputJsonObject;
  } catch {
    return undefined;
  }
}

export function parseImageCropArray(value: FormDataEntryValue[]): Prisma.InputJsonObject[] {
  return value
    .map((entry) => parseImageCrop(entry))
    .filter((crop): crop is Prisma.InputJsonObject => Boolean(crop));
}

export function imageCropToCss(crop?: unknown) {
  const normalized = normalizeImageCrop(crop);
  return {
    objectPosition: `${normalized.x}% ${normalized.y}%`,
    transform: `translate(${(50 - normalized.x) * Math.max(0, normalized.zoom - 1)}%, ${(50 - normalized.y) * Math.max(0, normalized.zoom - 1)}%) scale(${normalized.zoom})`,
    filter: `brightness(${normalized.brightness ?? 1}) saturate(${normalized.saturation ?? 1})`
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}
