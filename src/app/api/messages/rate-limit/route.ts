import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const res = checkRateLimit(`message:${session.user.id}`, 12, 60_000);
  return NextResponse.json(res, { status: res.ok ? 200 : 429 });
}
