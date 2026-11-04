import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMobileAuthSession } from "@/lib/auth/mobile-session";

const PREFIX = "mobile-browser-v1:";
const LIFETIME_MS = 60_000;
const opaqueValue = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const browserLoginParameters = z.object({ state: opaqueValue, challenge: opaqueValue });
export const browserExchangeParameters = z.object({
  state: opaqueValue,
  code: opaqueValue,
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/)
});
const bindingSchema = browserLoginParameters.extend({ userId: z.string().min(1).max(256) });
export class MobileBrowserAuthError extends Error {}

export function verifierChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function issueBrowserHandoff(userId: string, input: z.infer<typeof browserLoginParameters>) {
  const binding = bindingSchema.parse({ ...input, userId });
  const code = randomBytes(32).toString("base64url");
  const now = new Date();
  // Reuse Auth.js's expiring token table under a distinct namespace. No migration,
  // browser cookie, session token or personal data is placed in the return URL.
  await db.verificationToken.deleteMany({ where: { identifier: { startsWith: PREFIX }, expires: { lte: now } } });
  await db.verificationToken.create({ data: {
    identifier: PREFIX + JSON.stringify(binding),
    token: createHash("sha256").update(code).digest("hex"),
    expires: new Date(now.getTime() + LIFETIME_MS)
  } });
  const callback = new URL("shopfia-preview://auth");
  callback.searchParams.set("state", binding.state);
  callback.searchParams.set("code", code);
  return callback;
}

export async function redeemBrowserHandoff(input: z.infer<typeof browserExchangeParameters>, requestUrl: string) {
  const parsed = browserExchangeParameters.parse(input);
  const hash = createHash("sha256").update(parsed.code).digest("hex");
  const record = await db.verificationToken.findUnique({ where: { token: hash } });
  const invalid = () => new MobileBrowserAuthError("This app sign-in expired or could not be verified. Please try again.");
  if (!record || !record.identifier.startsWith(PREFIX) || record.expires.getTime() <= Date.now()) throw invalid();
  let binding: z.infer<typeof bindingSchema>;
  try { binding = bindingSchema.parse(JSON.parse(record.identifier.slice(PREFIX.length))); }
  catch { throw invalid(); }
  const expected = Buffer.from(binding.challenge);
  const actual = Buffer.from(verifierChallenge(parsed.verifier));
  if (binding.state !== parsed.state || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid();
  // Atomic consumption prevents replay, including two simultaneous exchanges.
  const consumed = await db.verificationToken.deleteMany({ where: {
    token: hash, identifier: record.identifier, expires: { gt: new Date() }
  } });
  if (consumed.count !== 1) throw invalid();
  const user = await db.user.findUnique({ where: { id: binding.userId }, select: {
    id: true, email: true, name: true, image: true, role: true, username: true
  } });
  if (!user) throw invalid();
  return createMobileAuthSession(user, requestUrl);
}
