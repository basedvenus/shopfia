import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { browserLoginParameters, issueBrowserHandoff } from "@/lib/auth/mobile-browser";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const limited = enforceRequestRateLimit(request, [{ key: "mobile-browser-complete:{ip}", limit: 20, intervalMs: 60_000 }]);
  if (limited) return limited;
  const url = new URL(request.url);
  const parsed = browserLoginParameters.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid app sign-in request." }, { status: 400 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to ShopFia first." }, { status: 401 });
  const callback = await issueBrowserHandoff(session.user.id, parsed.data);
  return NextResponse.redirect(callback, { status: 302, headers: {
    "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer"
  } });
}
