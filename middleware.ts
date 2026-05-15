import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rate = checkRateLimit(`api:ip:${ip}`, 300, 60_000);

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rate.retryAfterMs ?? 60_000) / 1000))
        }
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
