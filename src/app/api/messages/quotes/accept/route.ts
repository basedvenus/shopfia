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
  const limited = enforceRequestRateLimit(request, [
    { key: "message-quote-accept:ip:{ip}", limit: 12, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = acceptQuoteSchema.safeParse(await request.json().catch(() => ({})));
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
    return NextResponse.json({
      checkoutSessionId: result.checkoutSessionId,
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
      ok: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare payment yet." },
      { status: 400 }
    );
  }
}
