import type { Prisma } from "@prisma/client";

export type ImageCrop = {
  x: number;
  y: number;
  zoom: number;
};

export const DEFAULT_IMAGE_CROP: ImageCrop = {
  x: 50,
  y: 50,
  zoom: 1
};

export function normalizeImageCrop(value: unknown): ImageCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_IMAGE_CROP;
  }

  const record = value as Record<string, unknown>;
  return {
    x: clampNumber(record.x, 0, 100, DEFAULT_IMAGE_CROP.x),
    y: clampNumber(record.y, 0, 100, DEFAULT_IMAGE_CROP.y),
    zoom: clampNumber(record.zoom, 1, 3, DEFAULT_IMAGE_CROP.zoom)
  };
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
    transform: `scale(${normalized.zoom})`
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}
