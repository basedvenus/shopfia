import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await auth();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401, headers });
  const limited = enforceRequestRateLimit(request, [{ key: `notifications:${session.user.id}`, limit: 60, intervalMs: 60_000 }]);
  if (limited) return limited;
  const unreadCount = await db.notification.count({ where: { userId: session.user.id, readAt: null } });
  return NextResponse.json({ unreadCount }, { headers });
}
