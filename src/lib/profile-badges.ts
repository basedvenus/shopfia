import type { PrismaClient } from "@prisma/client";

export type ProfileBadgeKind = "founder" | "original-member" | "original-vendor";

export type ProfileBadge = {
  kind: ProfileBadgeKind;
  label: string;
  title: string;
};

type BadgeUser = {
  createdAt?: Date | string | null;
  email?: string | null;
  username?: string | null;
};

const founderUsername = "basedvenus";
const founderEmail = "basedvenus@gmail.com";

export async function getOriginalMemberCutoffDate(db: Pick<PrismaClient, "user">) {
  const users = await db.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true },
    take: 100
  });

  return users.at(-1)?.createdAt ?? null;
}

export function getProfileBadge(
  user: BadgeUser | null | undefined,
  originalMemberCutoff: Date | string | null | undefined,
  options: { vendorContext?: boolean } = {}
): ProfileBadge | null {
  return getProfileBadges(user, originalMemberCutoff, options)[0] ?? null;
}

export function getProfileBadges(
  user: BadgeUser | null | undefined,
  originalMemberCutoff: Date | string | null | undefined,
  options: { vendorContext?: boolean } = {}
): ProfileBadge[] {
  if (!user) return [];

  const badges: ProfileBadge[] = [];

  if (isFounder(user)) {
    badges.push({
      kind: "founder",
      label: "Founder",
      title: "Founder of ShopFia."
    });
  }

  if (isOriginalMember(user, originalMemberCutoff)) {
    badges.push(
      options.vendorContext
        ? {
            kind: "original-vendor",
            label: "Original Vendor",
            title: "One of the first vendors on ShopFia."
          }
        : {
            kind: "original-member",
            label: "Original Member",
            title: "One of the first 100 members on ShopFia."
          }
    );
  }

  return badges;
}

function isFounder(user: BadgeUser) {
  const username = user.username?.toLowerCase();
  const email = user.email?.toLowerCase();

  return username === founderUsername || email === founderEmail;
}

function isOriginalMember(user: BadgeUser, cutoff: Date | string | null | undefined) {
  if (!user.createdAt || !cutoff) return false;

  return new Date(user.createdAt).getTime() <= new Date(cutoff).getTime();
}
