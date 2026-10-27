import type { NextRequest } from "next/server";

import { withSessionCookieProtection } from "@/lib/auth/session-resilience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { handlers } = await import("@/auth");
  return withSessionCookieProtection(() => handlers.GET(request));
}

export async function POST(request: NextRequest) {
  const { handlers } = await import("@/auth");
  return withSessionCookieProtection(() => handlers.POST(request));
}
