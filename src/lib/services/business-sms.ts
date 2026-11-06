import "server-only";
import { db } from "@/lib/db";

export function isBusinessSmsConfigured() {
  return Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID && process.env.TWILIO_MESSAGING_API_KEY_SID && process.env.TWILIO_MESSAGING_API_KEY_SECRET && process.env.TWILIO_ACCOUNT_SID);
}

/** Called only after an incoming business message or inquiry has been saved. */
export async function notifyBusinessSms(userId: string, eventKey: string) {
  try {
    if (!isBusinessSmsConfigured()) return;
    const profiles = await db.$queryRaw<Array<{phone: string}>>`
      SELECT "phone" FROM "PhoneVerificationProfile"
      WHERE "userId" = ${userId} AND "businessSmsEnabled" = TRUE
        AND "businessSmsConsentAt" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "phone" IS NOT NULL`;
    if (!profiles[0]) return;
    // Claim once before calling the provider: duplicate application events must
    // never generate repeated paid texts. Provider failures are recorded.
    const claimed = await db.$queryRaw<Array<{eventKey: string}>>`
      INSERT INTO "BusinessSmsDelivery" ("eventKey", "userId", "status")
      VALUES (${eventKey}, ${userId}, 'sending') ON CONFLICT DO NOTHING RETURNING "eventKey"`;
    if (!claimed.length) return;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_MESSAGING_API_KEY_SID}:${process.env.TWILIO_MESSAGING_API_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        To: profiles[0].phone,
        MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
        Body: "Shopfia: You have a new business message or inquiry. View your inbox: https://www.shopfia.app/messages. Reply STOP to unsubscribe."
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    const accepted = response.ok && typeof result.sid === "string";
    await db.$executeRaw`UPDATE "BusinessSmsDelivery" SET "status" = ${accepted ? "accepted" : "failed"}, "providerSid" = ${accepted ? result.sid : null} WHERE "eventKey" = ${eventKey} AND "userId" = ${userId}`;
    if (!accepted && result.code === 21610) {
      // Twilio reports a recipient STOP request; keep the account toggle in sync.
      await db.$executeRaw`UPDATE "PhoneVerificationProfile" SET "businessSmsEnabled" = FALSE, "businessSmsConsentAt" = NULL WHERE "userId" = ${userId}`;
    }
    if (!accepted) console.error("business_sms_rejected", {status: response.status, code: result.code});
  } catch {
    // Preserve the conversation/inquiry even if SMS is unavailable or times out.
    console.error("business_sms_delivery_failed");
  }
}
