import type { Prisma } from "@prisma/client";
import { getSafeProfileImage } from "@/lib/profile-image";

export const userProfileSelect = {
  bio: true,
  email: true,
  id: true,
  image: true,
  instagramUrl: true,
  name: true,
  partyfulUrl: true,
  role: true,
  tiktokUrl: true,
  username: true
} satisfies Prisma.UserSelect;

export type SharedUserProfile = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}> & {
  image: string | null;
};

export function serializeUserProfile(user: Prisma.UserGetPayload<{ select: typeof userProfileSelect }>) {
  return {
    ...user,
    image: getSafeProfileImage(user.image)
  };
}
