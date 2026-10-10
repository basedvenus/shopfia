export const MAX_PROFILE_IMAGE_LENGTH = 10_000;

export function getSafeProfileImage(image?: string | null) {
  const value = image?.trim();
  if (!value) return null;
  if (value.startsWith("data:")) return null;
  if (value.toLowerCase().startsWith("javascript:")) return null;
  // Google is a login method, not consent to publish its account photo.
  // Keep stored values untouched; only user-uploaded photos are displayed.
  try {
    const hostname = new URL(value, "https://www.shopfia.app").hostname.toLowerCase();
    if (hostname === "googleusercontent.com" || hostname.endsWith(".googleusercontent.com")) return null;
  } catch {
    // Relative URLs from ShopFia's upload endpoints are valid profile images.
  }

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
