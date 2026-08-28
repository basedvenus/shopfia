import { OAuth2Client } from "google-auth-library";
import { UserRole } from "@prisma/client";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { db } from "@/lib/db";
import { createMobileAuthSession } from "@/lib/auth/mobile-session";
import { getSafeProfileImage } from "@/lib/profile-image";

export class MobileGoogleAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MobileGoogleAuthError";
  }
}

export async function createMobileGoogleSession(idToken: string, requestUrl: string) {
  const authSecret = authProviderConfig.authSecret;
  const googleIosClientId = authProviderConfig.googleIosClientId;

  if (!authSecret || !googleIosClientId) {
    throw new MobileGoogleAuthError(
      "Mobile Google sign-in is not configured on the ShopFia backend.",
      503
    );
  }

  const ticket = await new OAuth2Client().verifyIdToken({
    audience: googleIosClientId,
    idToken
  }).catch(() => null);
  const identity = ticket?.getPayload();

  if (!identity?.sub || !identity.email || identity.email_verified !== true) {
    throw new MobileGoogleAuthError("Google could not verify this account.", 401);
  }

  const email = identity.email.trim().toLowerCase();
  const existingAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identity.sub
      }
    },
    include: { user: true }
  });

  let user = existingAccount?.user ?? null;
  let createdUser = false;

  if (!user) {
    user = await db.user.findUnique({ where: { email } });

    if (user) {
      await db.account.create({
        data: {
          provider: "google",
          providerAccountId: identity.sub,
          type: "oidc",
          userId: user.id
        }
      }).catch(async (error) => {
        const racedAccount = await db.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: identity.sub
            }
          },
          include: { user: true }
        });
        if (!racedAccount || racedAccount.userId !== user?.id) throw error;
      });
    } else {
      user = await db.user.create({
        data: {
          accounts: {
            create: {
              provider: "google",
              providerAccountId: identity.sub,
              type: "oidc"
            }
          },
          email,
          emailVerified: new Date(),
          image: getSafeProfileImage(identity.picture),
          name: identity.name ?? null,
          role: UserRole.BUYER
        }
      });
      createdUser = true;
    }
  }

  const mobileSession = await createMobileAuthSession(user, requestUrl);

  return {
    ...mobileSession,
    createdUser,
  };
}
