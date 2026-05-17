export const MAX_PROFILE_IMAGE_LENGTH = 10_000;

export function getSafeProfileImage(image?: string | null) {
  const value = image?.trim();
  if (!value) return null;
  if (value.startsWith("data:")) return null;
  if (value.toLowerCase().startsWith("javascript:")) return null;

  return value.length <= MAX_PROFILE_IMAGE_LENGTH ? value : null;
}

export function isUnsafeProfileImage(image?: string | null) {
  return Boolean(image && !getSafeProfileImage(image));
}
