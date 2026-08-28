import type { UserRole } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { getSafeProfileImage } from "@/lib/profile-image";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type MobileSessionUser = {
  email: string | null;
  id: string;
  image: string | null;
  name: string | null;
  role: UserRole;
  username: string | null;
};

export async function createMobileAuthSession(user: MobileSessionUser, requestUrl: string) {
  const authSecret = authProviderConfig.authSecret;
  if (!authSecret) throw new Error("ShopFia authentication is not configured.");

  const secure = new URL(requestUrl).protocol === "https:";
  const cookieName = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const sessionToken = await encode({
    maxAge: SESSION_MAX_AGE_SECONDS,
    salt: cookieName,
    secret: authSecret,
    token: {
      email: user.email,
      name: user.name,
      picture: getSafeProfileImage(user.image),
      role: user.role,
      sub: user.id,
      username: user.username
    }
  });
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const cookie = [
    `${cookieName}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : null
  ].filter(Boolean).join("; ");

  return {
    cookie,
    session: {
      expires: expiresAt.toISOString(),
      user: {
        email: user.email,
        id: user.id,
        image: getSafeProfileImage(user.image),
        name: user.name,
        role: user.role,
        username: user.username
      }
    }
  };
}
