"use server";
import { db } from "@/lib/db";
import { isReservedStorefrontSlug } from "@/lib/businesses";
import { checkServerActionRateLimit } from "@/lib/security/request";

export async function checkStorefrontUsernameAction(username: string) {
  if (!/^[a-z0-9-]{2,80}$/.test(username) || isReservedStorefrontSlug(username)) {
    return { available: false, error: "Choose 2–80 lowercase letters, numbers, or dashes. This username may be reserved." };
  }
  const rate = await checkServerActionRateLimit([{key: "storefront-username:ip:{ip}", limit: 60, intervalMs: 60_000}]);
  if (!rate.ok) return {available: false, error: "Please wait a moment before checking another username."};
  const existing = await db.vendorProfile.findFirst({where: {OR: [{slug: username}, {username}]}, select: {id: true}});
  return existing ? {available: false, error: "That business username is already taken."} : {available: true};
}
