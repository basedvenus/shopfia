import { NextResponse } from "next/server";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { readStripeMode } from "@/lib/services/stripe-mode";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }
  const limited = enforceRequestRateLimit(request, [
    { key: `stripe-mode:user:${session.user.id}`, limit: 6, intervalMs: 60_000 },
    { key: "stripe-mode:ip:{ip}", limit: 12, intervalMs: 60_000 }
  ]);
  if (limited) {
    limited.headers.set("Cache-Control", "private, no-store");
    return limited;
  }
  // A JWT role is only an initial filter. Revalidate current administrator
  // access so deleted accounts, revocations, and database outages fail closed.
  try {
    const { db } = await import("@/lib/db");
    const currentUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
    }
  } catch {
    return NextResponse.json({ error: "Administrator access could not be verified" }, { status: 503, headers: noStore });
  }
  try {
    return NextResponse.json(await readStripeMode(), { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Stripe mode could not be verified" }, { status: 503, headers: noStore });
  }
}
