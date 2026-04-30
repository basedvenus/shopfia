import { NextResponse } from "next/server";
import { createConnectAccount, createConnectAccountLink } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== "VENDOR" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${url.host}`;
  if (origin && origin !== expectedOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const vendor = await db.vendorProfile.findUnique({ where: { userId: session.user.id } });
  if (!vendor) return NextResponse.json({ error: "Vendor profile not found" }, { status: 404 });
  if (!vendor.verified && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Vendor account is suspended" }, { status: 403 });
  }

  let stripeAccountId = vendor.stripeAccountId;
  if (!stripeAccountId) {
    const account = await createConnectAccount();
    stripeAccountId = account.id;
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: { stripeAccountId }
    });
  }

  const link = await createConnectAccountLink(
    stripeAccountId,
    `${expectedOrigin}/vendor/dashboard?stripe=refresh`,
    `${expectedOrigin}/vendor/dashboard?stripe=return`
  );

  return NextResponse.json({ url: link.url });
}
