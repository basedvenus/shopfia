import { NextResponse } from "next/server";
import { requestPasswordResetAction } from "@/app/actions/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const formData = new FormData();
    formData.set("email", typeof body?.email === "string" ? body.email : "");

    const result = await requestPasswordResetAction(formData);
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
