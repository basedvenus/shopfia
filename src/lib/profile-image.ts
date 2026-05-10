export const MAX_PROFILE_IMAGE_LENGTH = 2_000;

export function getSafeProfileImage(image?: string | null) {
  if (!image) return null;
  if (image.startsWith("data:")) return null;

  return image.length <= MAX_PROFILE_IMAGE_LENGTH ? image : null;
}

export function isUnsafeProfileImage(image?: string | null) {
  return Boolean(image && !getSafeProfileImage(image));
}
