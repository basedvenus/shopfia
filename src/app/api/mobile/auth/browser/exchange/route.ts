import { NextResponse } from "next/server";
import { browserExchangeParameters, MobileBrowserAuthError, redeemBrowserHandoff } from "@/lib/auth/mobile-browser";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const limited = enforceRequestRateLimit(request, [{ key: "mobile-browser-exchange:{ip}", limit: 20, intervalMs: 60_000 }]);
  if (limited) return limited;
  const input = browserExchangeParameters.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid app sign-in exchange." }, { status: 400 });
  try {
    const result = await redeemBrowserHandoff(input.data, request.url);
    return NextResponse.json({ ok: true }, { headers: {
      "Set-Cookie": result.cookie, "Cache-Control": "private, no-store"
    } });
  } catch (error) {
    if (error instanceof MobileBrowserAuthError) return NextResponse.json({ error: error.message }, { status: 401 });
    // Never log the handoff code, verifier, cookies or response body.
    console.error("ShopFia browser-to-app session exchange failed");
    return NextResponse.json({ error: "App sign-in is temporarily unavailable." }, { status: 503 });
  }
}
