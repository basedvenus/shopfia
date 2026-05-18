import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptQuoteAndCreatePaymentIntentAction } from "@/app/actions/quotes";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

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

  const formData = new FormData();
  formData.set("quoteId", quote.id);
  formData.set("payMode", quote.depositAmountCents ? "deposit" : "full");

  try {
    const result = await acceptQuoteAndCreatePaymentIntentAction(formData);
    return NextResponse.json({
      clientSecret: result.clientSecret,
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
