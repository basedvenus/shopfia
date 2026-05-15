import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { checkRateLimits, type RateLimitResult } from "@/lib/auth/rate-limit";

type RateLimitCheck = {
  intervalMs: number;
  key: string;
  limit: number;
};

export function getClientIp(headersLike: Headers) {
  const forwardedFor = headersLike.get("x-forwarded-for");
  const realIp = headersLike.get("x-real-ip");
  const vercelIp = headersLike.get("x-vercel-forwarded-for");
  const candidate = forwardedFor?.split(",")[0]?.trim() || vercelIp?.split(",")[0]?.trim() || realIp;

  return candidate?.replace(/[^a-fA-F0-9:., ]/g, "").slice(0, 80) || "unknown";
}

export async function getServerActionClientIp() {
  return getClientIp(await headers());
}

export function rateLimitResponse(result: RateLimitResult, message = "Too many requests. Please try again shortly.") {
  return NextResponse.json(
    { error: message, retryAfterSeconds: Math.ceil((result.retryAfterMs ?? 60_000) / 1000) },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000))
      }
    }
  );
}

export function enforceRequestRateLimit(
  request: Request,
  checks: RateLimitCheck[],
  message?: string
) {
  const ip = getClientIp(request.headers);
  const result = checkRateLimits(
    checks.map((check) => ({
      ...check,
      key: check.key.replace("{ip}", ip)
    }))
  );

  return result.ok ? null : rateLimitResponse(result, message);
}

export async function checkServerActionRateLimit(checks: RateLimitCheck[]) {
  const ip = await getServerActionClientIp();
  return checkRateLimits(
    checks.map((check) => ({
      ...check,
      key: check.key.replace("{ip}", ip)
    }))
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const url = new URL(request.url);
  return origin === `${url.protocol}//${url.host}`;
}
