import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { createMobileAuthSession } from "@/lib/auth/mobile-session";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "mobile-password-auth:ip:{ip}", limit: 20, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const rate = checkRateLimit(`mobile-password:${parsed.data.email}`, 5, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait a minute." }, { status: 429 });
  }

  if (!authProviderConfig.authSecret) {
    return NextResponse.json({ error: "ShopFia sign-in is temporarily unavailable." }, { status: 503 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        email: true,
        id: true,
        image: true,
        name: true,
        passwordHash: true,
        role: true,
        username: true
      }
    });
    const matches = user?.passwordHash
      ? await compare(parsed.data.password, user.passwordHash)
      : false;

    if (!user || !matches) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const mobileSession = await createMobileAuthSession(user, request.url);
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
    console.error("ShopFia mobile password sign-in failed", error);
    return NextResponse.json({ error: "ShopFia sign-in could not be completed." }, { status: 500 });
  }
}
