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

// The persisted upload is the user's chosen photo. A provider URL or an old
// denormalized User.image value must not take precedence over those saved bytes.
// Read only metadata here; image bytes continue to be served by the avatar route.
export function getUserProfileImage(user: {
  id: string;
  image?: string | null;
  avatar?: { updatedAt: Date } | null;
}) {
  if (user.avatar) {
    return `/api/users/${encodeURIComponent(user.id)}/avatar?v=${user.avatar.updatedAt.getTime()}`;
  }
  return getSafeProfileImage(user.image);
}
