import { describe, expect, it } from "vitest";
import { canAcceptQuote, quotePayableAmount } from "@/lib/payments";

describe("quote acceptance flow", () => {
  it("uses deposit when requested and available", () => {
    expect(
      quotePayableAmount(
        { amountCents: 50000, depositAmountCents: 15000 },
        "deposit"
      )
    ).toBe(15000);
  });

  it("falls back to full amount when no deposit is set", () => {
    expect(
      quotePayableAmount(
        { amountCents: 50000, depositAmountCents: null },
        "deposit"
      )
    ).toBe(50000);
  });

  it("accepts only active, non-expired sent quotes", () => {
    expect(canAcceptQuote({ status: "SENT", expiresAt: new Date(Date.now() + 60_000) })).toBe(true);
    expect(canAcceptQuote({ status: "ACCEPTED", expiresAt: new Date(Date.now() + 60_000) })).toBe(false);
    expect(canAcceptQuote({ status: "SENT", expiresAt: new Date(Date.now() - 60_000) })).toBe(false);
  });
});
