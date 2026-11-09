const PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const EXTENSION_TYPES: Record<string, string> = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", heic:"image/heic", heif:"image/heif" };
export const MAX_PROFILE_PHOTO_SOURCE_BYTES = 20 * 1024 * 1024;

// Some mobile photo providers omit the MIME type. This is a client-side hint;
// the upload endpoint still verifies the converted image's actual bytes.
export function getProfilePhotoType(file: {type:string;name:string}) {
  const type = file.type.toLowerCase();
  if (PROFILE_PHOTO_TYPES.has(type)) return type;
  if (type && type !== "application/octet-stream") return null;
  return EXTENSION_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}
