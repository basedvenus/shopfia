import type { Prisma } from "@prisma/client";
import { getUserProfileImage } from "@/lib/profile-image";

export const userProfileSelect = {
  avatar: { select: { updatedAt: true } },
  bio: true,
  email: true,
  id: true,
  image: true,
  imageCrop: true,
  instagramUrl: true,
  name: true,
  partyfulUrl: true,
  role: true,
  tiktokUrl: true,
  username: true,
  vendorProfile: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
} as const satisfies Prisma.UserSelect;

type StoredUserProfile = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

export type SharedUserProfile = Omit<StoredUserProfile, "avatar"> & {
  image: string | null;
};

export function serializeUserProfile(user: StoredUserProfile): SharedUserProfile {
  const { avatar, ...profile } = user;
  return {
    ...profile,
    image: getUserProfileImage({ ...profile, avatar })
  };
}
