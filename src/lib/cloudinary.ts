import { randomUUID } from "crypto";

export function buildCloudinaryUnsignedUploadPayload(folder = "shopfia") {
  return {
    folder,
    publicId: `${folder}/${randomUUID()}`
  };
}

export function cloudinaryImageUrl(path?: string | null) {
  if (!path) return "/placeholder.jpg";
  return path;
}
