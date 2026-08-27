import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { createMobileGoogleSession, MobileGoogleAuthError } from "@/lib/auth/mobile-google";
import { sendWelcomeEmail } from "@/lib/email";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ idToken: z.string().min(100).max(10_000) });

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "mobile-google-auth:ip:{ip}", limit: 20, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing Google identity token." }, { status: 400 });
  }

  const result = checkRateLimit(`mobile-google-token:${parsed.data.idToken.slice(-32)}`, 5, 60_000);
  if (!result.ok) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait a minute." }, { status: 429 });
  }

  try {
    const mobileSession = await createMobileGoogleSession(parsed.data.idToken, request.url);

    if (mobileSession.createdUser && mobileSession.session.user.email) {
      await sendWelcomeEmail(mobileSession.session.user.email).catch((error) => {
        console.error("ShopFia mobile welcome email failed", error);
      });
    }

    return NextResponse.json(
      {
        session: mobileSession.session,
        sessionCookie: mobileSession.cookie.split(";")[0]
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store",
          "Set-Cookie": mobileSession.cookie
        }
      }
    );
  } catch (error) {
    if (error instanceof MobileGoogleAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("ShopFia mobile Google sign-in failed", error);
    return NextResponse.json({ error: "Google sign-in could not be completed." }, { status: 500 });
  }
}
