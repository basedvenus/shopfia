import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimits } from "@/lib/auth/rate-limit";
import { securityLog } from "@/lib/security/audit-log";

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255, "Email is a little too long.")
});

export type PasswordResetRequestResult = {
  error?: string;
  message?: string;
  ok: boolean;
};

function getBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configured || "http://localhost:3000";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordResetEmail({
  email: rawEmail,
  ip = "unknown"
}: {
  email: unknown;
  ip?: string;
}): Promise<PasswordResetRequestResult> {
  try {
    const parsed = passwordResetRequestSchema.safeParse({ email: rawEmail });

    if (!parsed.success) {
      return { ok: false, error: "Enter the email on your ShopFia account." };
    }

    const email = parsed.data.email.toLowerCase();
    const rate = checkRateLimits([
      { key: `password-reset:ip:${ip}`, limit: 8, intervalMs: 60_000 },
      { key: `password-reset:email:${email}`, limit: 3, intervalMs: 60_000 }
    ]);
    if (!rate.ok) {
      return { ok: false, error: "Please wait a minute before requesting another reset link." };
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true }
    });

    if (user?.email && !user.passwordHash) {
      return {
        ok: false,
        error: "This email uses Google sign-in. Continue with Google for now, then add a password from account settings later."
      };
    }

    if (user?.email && user.passwordHash) {
      const rawToken = randomBytes(32).toString("base64url");
      const identifier = `password-reset:${email}`;
      const token = hashToken(rawToken);
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await db.verificationToken.deleteMany({ where: { identifier } });
      await db.verificationToken.create({
        data: { expires, identifier, token }
      });

      const resetUrl = `${getBaseUrl()}/account/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawToken)}`;
      const delivery = await sendPasswordResetEmail(email, resetUrl);
      if (!delivery.ok) {
        await db.verificationToken.deleteMany({ where: { identifier } });
        securityLog("password_reset_email_not_sent", {
          skipped: delivery.skipped,
          userId: user.id
        });
        return {
          ok: false,
          error: delivery.skipped
            ? "Password reset email is not configured yet. Add SMTP email settings in Vercel, then try again."
            : "We could not send the reset email right now. Please try again in a minute."
        };
      }
      securityLog("password_reset_requested", { userId: user.id });
    }

    return {
      ok: true,
      message: "If an account exists for that email, a reset link is on its way."
    };
  } catch (error) {
    securityLog("password_reset_request_failed", {
      error: error instanceof Error ? error.message : "Unknown password reset error"
    });
    return {
      ok: false,
      error: "We could not start the password reset right now. Please try again in a minute."
    };
  }
}
