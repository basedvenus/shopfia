import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { prepareQuoteCheckout } from "@/lib/services/quote-checkout";

export const dynamic = "force-dynamic";

const acceptQuoteSchema = z.object({
  quoteId: z.string().cuid()
});

export async function POST(request: Request) {
  const wantsJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const limited = enforceRequestRateLimit(request, [
    { key: "message-quote-accept:ip:{ip}", limit: 12, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = acceptQuoteSchema.safeParse(await readAcceptQuoteBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Quote could not be reviewed." }, { status: 400 });
  }

  const quote = await db.quote.findUnique({
    where: { id: parsed.data.quoteId },
    include: {
      quoteRequest: {
        select: {
          buyerId: true
        }
      }
    }
  });
  if (!quote || quote.quoteRequest.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  try {
    const result = await prepareQuoteCheckout({
      buyerId: session.user.id,
      origin: new URL(request.url).origin,
      payMode: quote.depositAmountCents ? "deposit" : "full",
      quoteId: quote.id
    });
    if (!wantsJson) {
      return NextResponse.redirect(result.checkoutUrl, { status: 303 });
    }
    return NextResponse.json({
      checkoutSessionId: result.checkoutSessionId,
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
      ok: true
    });
  } catch (error) {
    if (!wantsJson) {
      const url = new URL("/account", request.url);
      url.searchParams.set("quoteError", error instanceof Error ? error.message : "Could not prepare payment yet.");
      return NextResponse.redirect(url, { status: 303 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare payment yet." },
      { status: 400 }
    );
  }
}

async function readAcceptQuoteBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData().catch(() => null);
    return { quoteId: formData?.get("quoteId") };
  }
  return {};
}
