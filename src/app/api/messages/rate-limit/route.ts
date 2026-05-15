import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "message-probe:ip:{ip}", limit: 60, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value ??
    cookieStore.get("__Secure-next-auth.session-token")?.value ??
    cookieStore.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const res = checkRateLimit(`message:${sessionToken}`, 12, 60_000);
  return NextResponse.json(res, {
    status: res.ok ? 200 : 429,
    headers: res.retryAfterMs ? { "Retry-After": String(Math.ceil(res.retryAfterMs / 1000)) } : undefined
  });
}
