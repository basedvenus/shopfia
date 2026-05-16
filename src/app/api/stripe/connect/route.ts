import { NextResponse } from "next/server";
import {
  createConnectAccountLink,
  createConnectLoginLink,
  createVendorConnectAccount,
  getConnectReadiness,
  retrieveConnectAccount
} from "@/lib/stripe";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";
import { securityLog } from "@/lib/security/audit-log";

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

  const limited = enforceRequestRateLimit(request, [
    { key: "stripe-connect:ip:{ip}", limit: 15, intervalMs: 60_000 },
    { key: `stripe-connect:user:${session.user.id}`, limit: 6, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${url.host}`;
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const vendor = await db.vendorProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { email: true } }
    }
  });
  if (!vendor) return NextResponse.json({ error: "Vendor profile not found" }, { status: 404 });
  if (!vendor.verified && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Vendor account is suspended" }, { status: 403 });
  }

  let stripeAccountId = vendor.stripeAccountId;
  if (!stripeAccountId) {
    const account = await createVendorConnectAccount({
      businessName: vendor.name,
      email: vendor.user.email,
      userId: vendor.userId,
      vendorProfileId: vendor.id
    });
    stripeAccountId = account.id;
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: {
        stripeAccountId,
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false
      }
    });
  } else {
    try {
      const account = await retrieveConnectAccount(stripeAccountId);
      const readiness = getConnectReadiness(account);
      await db.vendorProfile.update({
        where: { id: vendor.id },
        data: {
          stripeOnboardingComplete: readiness.onboardingComplete,
          stripeChargesEnabled: readiness.chargesEnabled,
          stripePayoutsEnabled: readiness.payoutsEnabled
        }
      });

      if (readiness.onboardingComplete) {
        const loginLink = await createConnectLoginLink(stripeAccountId);
        return NextResponse.json({ url: loginLink.url });
      }
    } catch (error) {
      securityLog("stripe_connect_status_refresh_failed", {
        error: error instanceof Error ? error.message : "unknown",
        vendorId: vendor.id
      });
    }
  }

  const link = await createConnectAccountLink(
    stripeAccountId,
    `${expectedOrigin}/vendor/dashboard?stripe=refresh`,
    `${expectedOrigin}/vendor/dashboard?stripe=return`
  );

  return NextResponse.json({ url: link.url });
}
