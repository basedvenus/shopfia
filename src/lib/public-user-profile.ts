import { getSafeProfileImage } from "@/lib/profile-image";

type PublicProfileFields = {
  id?: string;
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

// Server-rendered pages use private account fields for badge calculation.
// Public JSON must project only display fields, never serialize that account.
export function publicUserProfile(user: PublicProfileFields | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    image: user.image === undefined ? undefined : getSafeProfileImage(user.image),
    name: user.name,
    username: user.username
  };
}
