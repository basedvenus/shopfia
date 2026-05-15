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

const fallbackFounderUsernames = ["basedvenus"];
const fallbackFounderEmails = ["basedvenus@gmail.com"];

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
  if (!user) return null;

  if (isFounder(user)) {
    return {
      kind: "founder",
      label: "Founder",
      title: "Founder of ShopFia."
    };
  }

  if (isOriginalMember(user, originalMemberCutoff)) {
    return options.vendorContext
      ? {
          kind: "original-vendor",
          label: "Original Vendor",
          title: "One of the first vendors on ShopFia."
        }
      : {
          kind: "original-member",
          label: "Original Member",
          title: "One of the first 100 members on ShopFia."
        };
  }

  return null;
}

function isFounder(user: BadgeUser) {
  const founderUsernames = getConfiguredList(process.env.SHOPFIA_FOUNDER_USERNAMES, fallbackFounderUsernames);
  const founderEmails = getConfiguredList(process.env.SHOPFIA_FOUNDER_EMAILS, fallbackFounderEmails);
  const username = user.username?.toLowerCase();
  const email = user.email?.toLowerCase();

  return Boolean(
    (username && founderUsernames.includes(username)) ||
      (email && founderEmails.includes(email))
  );
}

function isOriginalMember(user: BadgeUser, cutoff: Date | string | null | undefined) {
  if (!user.createdAt || !cutoff) return false;

  return new Date(user.createdAt).getTime() <= new Date(cutoff).getTime();
}

function getConfiguredList(value: string | undefined, fallback: string[]) {
  const configured = value
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return configured?.length ? configured : fallback;
}
