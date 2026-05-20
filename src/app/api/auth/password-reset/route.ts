import { NextResponse } from "next/server";
import { requestPasswordResetEmail } from "@/lib/auth/password-reset";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const result = await requestPasswordResetEmail({
      email: body?.email,
      ip: getClientIp(request.headers)
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "We could not start the password reset right now. Please try again in a minute."
      },
      { status: 500 }
    );
  }
}
