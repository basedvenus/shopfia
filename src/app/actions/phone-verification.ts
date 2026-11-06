"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone-verification";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { PhoneVerificationError, checkPhoneVerification, sendPhoneVerification } from "@/lib/services/twilio-verify";

type Result = { ok: boolean; error?: string };

export async function sendPhoneCodeAction(form: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };
  const phone = normalizePhoneNumber(String(form.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "Enter a valid phone number, including the country code outside the US." };
  if (form.get("consent") !== "on") return { ok: false, error: "Please agree to receive a verification text." };
  const rate = await checkServerActionRateLimit([
    { key: "phone-send:ip:{ip}", limit: 5, intervalMs: 60 * 60 * 1000 },
    { key: `phone-send:number:${phone}`, limit: 5, intervalMs: 60 * 60 * 1000 }
  ]);
  if (!rate.ok) return { ok: false, error: "Too many code requests. Please try again later." };
  const userId = session.user.id;
  const requestId = randomUUID();
  try {
    // Reserve the send atomically before calling a paid provider. This limit also
    // survives reloads, server restarts, and multiple application instances.
    const reserved = await db.$queryRaw<Array<{userId: string}>>`
      INSERT INTO "PhoneVerificationProfile" ("userId", "lastSentAt", "sendWindowStart", "sendCount", "requestId")
      VALUES (${userId}, NOW(), NOW(), 1, ${requestId})
      ON CONFLICT ("userId") DO UPDATE SET
        "lastSentAt" = NOW(),
        "sendWindowStart" = CASE WHEN "PhoneVerificationProfile"."sendWindowStart" < NOW() - INTERVAL '1 hour' THEN NOW() ELSE "PhoneVerificationProfile"."sendWindowStart" END,
        "sendCount" = CASE WHEN "PhoneVerificationProfile"."sendWindowStart" < NOW() - INTERVAL '1 hour' THEN 1 ELSE "PhoneVerificationProfile"."sendCount" + 1 END,
        "requestId" = ${requestId}, "pendingSid" = NULL, "pendingPhone" = NULL
      WHERE ("PhoneVerificationProfile"."lastSentAt" IS NULL OR "PhoneVerificationProfile"."lastSentAt" < NOW() - INTERVAL '1 minute')
        AND ("PhoneVerificationProfile"."sendWindowStart" < NOW() - INTERVAL '1 hour' OR "PhoneVerificationProfile"."sendCount" < 5)
      RETURNING "userId"`;
    if (!reserved.length) return { ok: false, error: "Please wait a minute between requests. You can request up to five codes per hour." };
    const result = await sendPhoneVerification(phone);
    if (result.status !== "pending") return { ok: false, error: "A verification code could not be sent. Please try again later." };
    await db.$executeRaw`UPDATE "PhoneVerificationProfile" SET "pendingPhone" = ${phone}, "pendingSid" = ${result.sid}, "pendingExpiresAt" = NOW() + INTERVAL '10 minutes', "checkCount" = 0 WHERE "userId" = ${userId} AND "requestId" = ${requestId}`;
    return { ok: true };
  } catch (error) {
    console.error("phone_verification_send_failed", error instanceof PhoneVerificationError ? {status: error.status, code: error.providerCode} : {type: error instanceof Error ? error.name : "unknown", code: typeof error === "object" && error && "code" in error ? error.code : undefined});
    if (error instanceof PhoneVerificationError && error.providerCode === 21608) return { ok: false, error: "Twilio blocked this text because this number is not approved for testing. Verify the recipient in Twilio Console, or complete the account’s compliance approval, then try again." };
    return { ok: false, error: "We couldn’t send the verification text. Please wait a minute and try again." };
  }
}

export async function confirmPhoneCodeAction(form: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };
  const code = String(form.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the six-digit code from your text." };
  const rate = await checkServerActionRateLimit([{key: "phone-check:ip:{ip}", limit: 20, intervalMs: 60_000}]);
  if (!rate.ok) return { ok: false, error: "Too many attempts. Please wait a minute." };
  const userId = session.user.id;
  try {
    const pending = await db.$queryRaw<Array<{pendingSid: string; pendingPhone: string; requestId: string}>>`
      UPDATE "PhoneVerificationProfile" SET "checkCount" = "checkCount" + 1
      WHERE "userId" = ${userId} AND "pendingSid" IS NOT NULL AND "pendingPhone" IS NOT NULL
        AND "pendingExpiresAt" > NOW() AND "checkCount" < 5
      RETURNING "pendingSid", "pendingPhone", "requestId"`;
    const attempt = pending[0];
    if (!attempt) return { ok: false, error: "This code expired or reached its attempt limit. Please request a new code." };
    const result = await checkPhoneVerification(attempt.pendingSid, code);
    if (result.status !== "approved") return { ok: false, error: "That code isn’t correct. Please try again." };
    const changed = await db.$executeRaw`UPDATE "PhoneVerificationProfile" SET "businessSmsEnabled" = CASE WHEN "phone" = ${attempt.pendingPhone} THEN "businessSmsEnabled" ELSE FALSE END, "businessSmsConsentAt" = CASE WHEN "phone" = ${attempt.pendingPhone} THEN "businessSmsConsentAt" ELSE NULL END, "phone" = ${attempt.pendingPhone}, "verifiedAt" = NOW(), "pendingPhone" = NULL, "pendingSid" = NULL, "pendingExpiresAt" = NULL WHERE "userId" = ${userId} AND "requestId" = ${attempt.requestId} AND "pendingSid" = ${attempt.pendingSid}`;
    if (changed !== 1) return { ok: false, error: "A newer code was requested. Please use the latest code." };
    revalidatePath("/account/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "The code is incorrect or has expired. Please try again or request a new code." };
  }
}
