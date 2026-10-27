"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { sendPasswordResetEmail } from "@/lib/email";
import { securityLog } from "@/lib/security/audit-log";
import { checkServerActionRateLimit } from "@/lib/security/request";

const emailSchema = z.string().trim().email().max(255);
const unavailable = "We couldn't send a reset email right now. Please try again shortly or contact ShopFia support.";

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter your account email address first." };
  const email = parsed.data.toLowerCase();

  try {
    const rate = await checkServerActionRateLimit([
      { key: "password-reset:ip:{ip}", limit: 10, intervalMs: 60_000 },
      { key: `password-reset:email:${email}`, limit: 3, intervalMs: 60_000 }
    ]);
    if (!rate.ok) return { ok: false, error: "Please wait a minute before requesting another reset link." };
    if (!authProviderConfig.emailEnabled) return { ok: false, error: unavailable };

    // Use trusted server configuration; never derive recovery links from request headers.
    const configured = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim() ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
    const base = new URL(configured || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000"));
    if (!["http:", "https:"].includes(base.protocol) ||
        (process.env.NODE_ENV === "production" && base.protocol !== "https:")) {
      return { ok: false, error: unavailable };
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const identifier = `password-reset:${email}`;
      const token = createHash("sha256").update(rawToken).digest("hex");
      await db.verificationToken.create({
        data: { identifier, token, expires: new Date(Date.now() + 60 * 60 * 1000) }
      });
      const url = new URL("/account/reset-password", base);
      url.searchParams.set("email", email);
      url.searchParams.set("token", rawToken);
      const delivery = await sendPasswordResetEmail(email, url.href);
      if (!delivery.ok) {
        await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } });
        return { ok: false, error: unavailable };
      }
    }
    return { ok: true, message: "If an account exists for that email, a reset link has been sent. Check your inbox and spam folder. The link expires in one hour." };
  } catch {
    // Recovery tokens and provider error details must never reach the client or logs.
    securityLog("password_reset_request_failed", {});
    return { ok: false, error: unavailable };
  }
}
