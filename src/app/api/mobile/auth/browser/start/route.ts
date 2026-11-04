import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { browserLoginParameters } from "@/lib/auth/mobile-browser";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const limited = enforceRequestRateLimit(request, [{ key: "mobile-browser-start:{ip}", limit: 20, intervalMs: 60_000 }]);
  if (limited) return limited;
  const url = new URL(request.url);
  const parsed = browserLoginParameters.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid app sign-in request." }, { status: 400 });
  const complete = new URL("/api/mobile/auth/browser/complete", url.origin);
  complete.searchParams.set("state", parsed.data.state);
  complete.searchParams.set("challenge", parsed.data.challenge);
  // Auth.js starts a new, normal Google flow in the system authentication browser,
  // with its own state and PKCE cookies. Existing website sign-in stays unchanged.
  return signIn("google", { redirectTo: complete.toString() });
}
