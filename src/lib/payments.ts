import { Quote, QuoteStatus } from "@prisma/client";

export function quotePayableAmount(quote: Pick<Quote, "amountCents" | "depositAmountCents">, mode: "deposit" | "full") {
  if (mode === "deposit" && quote.depositAmountCents) return quote.depositAmountCents;
  return quote.amountCents;
}

export function canAcceptQuote(quote: Pick<Quote, "status" | "expiresAt">) {
  return quote.status === QuoteStatus.SENT && quote.expiresAt > new Date();
}
