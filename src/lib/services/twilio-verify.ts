import "server-only";

export function isPhoneVerificationConfigured() {
  return Boolean(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_VERIFY_SERVICE_SID);
}

export class PhoneVerificationError extends Error {
  constructor(public readonly providerCode: number | undefined, public readonly status: number) {
    super("Phone verification could not be completed.");
  }
}

async function verifyRequest(resource: "Verifications" | "VerificationCheck", body: URLSearchParams): Promise<{sid: string; status: string}> {
  if (!isPhoneVerificationConfigured()) throw new Error("Phone verification is not configured.");
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  if (!/^VA[a-f0-9]{32}$/i.test(service)) throw new Error("Invalid verification configuration.");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${resource}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new PhoneVerificationError(result.code, response.status);
  if (typeof result.sid !== "string" || typeof result.status !== "string") throw new Error("Invalid verification response.");
  return { sid: result.sid, status: result.status };
}

export async function sendPhoneVerification(phone: string) {
  return verifyRequest("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
}

export async function checkPhoneVerification(sid: string, code: string) {
  return verifyRequest("VerificationCheck", new URLSearchParams({ VerificationSid: sid, Code: code }));
}
