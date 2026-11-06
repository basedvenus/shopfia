"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkServerActionRateLimit } from "@/lib/security/request";

export async function updateBusinessSmsAction(enabled: boolean): Promise<{ok: boolean; error?: string}> {
  const session = await auth();
  if (!session?.user?.id) return {ok: false, error: "Please sign in again."};
  if (typeof enabled !== "boolean") return {ok: false, error: "Choose whether to receive texts."};
  const limit = await checkServerActionRateLimit([{key:`business-sms:${session.user.id}`,limit:12,intervalMs:60000}]);
  if (!limit.ok) return {ok: false, error: "Please wait a minute and try again."};
  try {
    const updated = await db.$executeRaw`UPDATE "PhoneVerificationProfile"
      SET "businessSmsEnabled" = ${enabled}, "businessSmsConsentAt" = ${enabled ? new Date() : null}
      WHERE "userId" = ${session.user.id} AND (NOT ${enabled} OR ("verifiedAt" IS NOT NULL AND "phone" IS NOT NULL))`;
    if (updated !== 1) return {ok:false,error:"Verify your mobile number below before enabling text alerts."};
    revalidatePath("/account/notifications");
    return {ok:true};
  } catch { return {ok:false,error:"Could not save your text preference. Please try again."}; }
}
