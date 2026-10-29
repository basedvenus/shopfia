import { beforeEach, describe, expect, it, vi } from "vitest";
import { OffsiteAdsTier, OrderStatus, QuoteRequestStatus, QuoteStatus } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const db = {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (input) => input),
    listing: {
      findUnique: vi.fn()
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    quote: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    quoteRequest: {
      update: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  };
  return {
    calculateOrderFees: vi.fn(async () => ({ totalFeesCents: 625 })),
    db,
    ensureSellerAccountForVendorProfile: vi.fn(async () => ({
      seller: { id: "seller_1", offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      shop: { id: "shop_1" }
    })),
    stripe: {
      paymentIntents: { retrieve: vi.fn() },
      checkout: {
        sessions: {
          create: vi.fn(async () => ({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/new" })),
          retrieve: vi.fn(async () => ({ id: "cs_test_existing", status: "open", url: "https://checkout.stripe.com/c/pay/existing" }))
        }
      }
    }
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/stripe", () => ({ getStripeServer: () => mocks.stripe }));
vi.mock("@/lib/services/marketplace-fees", () => ({
  calculateOrderFees: mocks.calculateOrderFees,
  ensureSellerAccountForVendorProfile: mocks.ensureSellerAccountForVendorProfile
}));

import { prepareQuoteCheckout } from "@/lib/services/quote-checkout";

const quote = {
  id: "quote_1",
  amountCents: 50000,
  depositAmountCents: 12500,
  expiresAt: new Date(Date.now() + 60_000),
  status: QuoteStatus.SENT,
  quoteRequest: {
    buyerId: "buyer_1",
    conversation: { id: "conversation_1" },
    id: "quote_request_1",
    offering: { id: "offering_1", title: "Balloon garland" },
    offeringId: "offering_1",
    vendor: {
      id: "vendor_profile_1",
      name: "Venus & Aura",
      stripeAccountId: "acct_test",
      stripeChargesEnabled: true,
      stripeOnboardingComplete: true,
      stripePayoutsEnabled: true,
      userId: "vendor_user_1"
    },
    vendorId: "vendor_profile_1"
  }
};

describe("quote checkout preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.quote.findUnique.mockResolvedValue(quote);
    mocks.db.order.findFirst.mockResolvedValue(null);
    mocks.db.user.findUnique.mockResolvedValue({ id: "vendor_user_1" });
    mocks.db.listing.findUnique.mockResolvedValue({ id: "listing_1" });
    mocks.db.order.create.mockResolvedValue({ id: "order_1" });
    mocks.db.order.update.mockResolvedValue({ id: "order_1" });
    mocks.db.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.quote.update.mockResolvedValue({ id: "quote_1" });
    mocks.db.quoteRequest.update.mockResolvedValue({ id: "quote_request_1" });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_test_existing", status: "open", url: "https://checkout.stripe.com/c/pay/existing" });
  });

  it("rejects a superseded structured quote before reopening checkout", async () => {
    mocks.db.quote.findUnique.mockResolvedValue({ ...quote, status: QuoteStatus.EXPIRED, lineItemsJson: { superseded: true, structured: { totals: { total: 50000, bookingPayment: 12500 } } } });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow("no longer payable");
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects a quote replaced while checkout was being prepared", async () => {
    const structured = { ...quote, lineItemsJson: { structured: { totals: { total: 50000, bookingPayment: 12500 } } } };
    mocks.db.quote.findUnique.mockResolvedValueOnce(structured).mockResolvedValueOnce({ ...structured, status: QuoteStatus.EXPIRED });
    mocks.db.$transaction.mockImplementationOnce(async input => typeof input === "function" ? input(mocks.db) : input);
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow("quote changed");
    expect(mocks.db.order.create).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates one awaiting payment order and returns a Stripe Checkout URL", async () => {
    const result = await prepareQuoteCheckout({
      buyerId: "buyer_1",
      origin: "https://www.shopfia.app",
      payMode: "deposit",
      quoteId: "quote_1"
    });

    expect(result).toEqual({
      checkoutSessionId: "cs_test_new",
      checkoutUrl: "https://checkout.stripe.com/c/pay/new",
      orderId: "order_1"
    });
    expect(mocks.db.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 12500,
          quoteId: "quote_1",
          status: OrderStatus.awaiting_payment
        })
      })
    );
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        success_url: expect.stringContaining("/messages?conversationId=conversation_1&payment=return"),
        payment_intent_data: expect.objectContaining({
          transfer_data: { destination: "acct_test" }
        })
      }),
      { idempotencyKey: "quote-checkout:order_1:initial" }
    );
    expect(mocks.db.quote.update).toHaveBeenCalledWith({
      where: { id: "quote_1" },
      data: { status: QuoteStatus.ACCEPTED }
    });
    expect(mocks.db.quoteRequest.update).toHaveBeenCalledWith({
      where: { id: "quote_request_1" },
      data: { status: QuoteRequestStatus.ACCEPTED }
    });
  });

  it("reuses an open checkout session for retried acceptance", async () => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500,
      id: "order_existing",
      seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1",
      shopId: "shop_1",
      status: OrderStatus.awaiting_payment,
      stripeCheckoutSessionId: "cs_test_existing"
    });

    const result = await prepareQuoteCheckout({
      buyerId: "buyer_1",
      origin: "https://www.shopfia.app",
      payMode: "deposit",
      quoteId: "quote_1"
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/existing");
    expect(result.orderId).toBe("order_existing");
    expect(mocks.db.order.create).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("reopens an accepted quote order when the prior checkout handoff did not complete", async () => {
    mocks.db.quote.findUnique.mockResolvedValue({ ...quote, status: QuoteStatus.ACCEPTED });
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500,
      id: "order_canceled",
      seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1",
      shopId: "shop_1",
      status: OrderStatus.canceled,
      stripeCheckoutSessionId: null
    });

    const result = await prepareQuoteCheckout({
      buyerId: "buyer_1",
      origin: "https://www.shopfia.app",
      payMode: "deposit",
      quoteId: "quote_1"
    });

    expect(result).toEqual({
      checkoutSessionId: "cs_test_new",
      checkoutUrl: "https://checkout.stripe.com/c/pay/new",
      orderId: "order_canceled"
    });
    expect(mocks.db.order.create).not.toHaveBeenCalled();
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order_canceled", stripeCheckoutSessionId: null, paymentSucceededAt: null,
        status: { in: [OrderStatus.draft, OrderStatus.awaiting_payment, OrderStatus.canceled] }
      },
      data: {
        status: OrderStatus.awaiting_payment,
        stripeCheckoutSessionId: "cs_test_new"
      }
    });
  });

  it("uses a new stable attempt key when replacing an expired Checkout", async () => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1", shopId: "shop_1", status: OrderStatus.canceled, stripeCheckoutSessionId: "cs_test_expired"
    });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_test_expired", status: "expired", url: "" });
    const input = { buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit" as const, quoteId: "quote_1" };
    await prepareQuoteCheckout(input);
    await prepareQuoteCheckout(input);
    const keys = mocks.stripe.checkout.sessions.create.mock.calls.map((call) => (call as unknown as [unknown, { idempotencyKey: string }])[1].idempotencyKey);
    expect(keys).toEqual(["quote-checkout:order_existing:cs_test_expired", "quote-checkout:order_existing:cs_test_expired"]);
    expect(mocks.db.order.create).not.toHaveBeenCalled();
  });

  it("does not create another payment when Checkout completed before its webhook arrived", async () => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1", shopId: "shop_1", status: OrderStatus.awaiting_payment, stripeCheckoutSessionId: "cs_test_complete"
    });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_test_complete", status: "complete", url: "" });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow(/being confirmed/);
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(mocks.db.order.update).not.toHaveBeenCalled();
  });

  it("will not reopen an order with verified payment even if another action canceled its status", async () => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", paymentSucceededAt: new Date(),
      status: OrderStatus.canceled, stripeCheckoutSessionId: "cs_test_existing"
    });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow(/active order/);
    expect(mocks.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("does not return a replacement checkout after its conditional order update loses a race", async () => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1", shopId: "shop_1", status: OrderStatus.canceled, stripeCheckoutSessionId: "cs_test_expired"
    });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_test_expired", status: "expired", url: "" });
    mocks.db.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow(/order changed/);
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stripeCheckoutSessionId: "cs_test_expired", paymentSucceededAt: null }) }));
  });

  it("refuses a stale order amount after the vendor revised an expired quote", async () => {
    mocks.db.quote.findUnique.mockResolvedValue({ ...quote, depositAmountCents: 20000 });
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", status: OrderStatus.canceled, stripeCheckoutSessionId: "cs_test_expired"
    });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow(/changed after checkout/);
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
  });

  it.each(["requires_payment_method", "canceled"])("allows a new attempt after a completed delayed payment is confirmed %s", async (status) => {
    mocks.db.order.findFirst.mockResolvedValue({
      amountCents: 12500, id: "order_existing", seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: "seller_1", shopId: "shop_1", status: OrderStatus.canceled, stripeCheckoutSessionId: "cs_test_failed"
    });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_failed", status: "complete", url: "", payment_status: "unpaid", payment_intent: "pi_test_failed"
    } as Awaited<ReturnType<typeof mocks.stripe.checkout.sessions.retrieve>>);
    mocks.stripe.paymentIntents.retrieve.mockResolvedValue({ status });
    await prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" });
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: "quote-checkout:order_existing:cs_test_failed" });
  });

  it("does not create a second attempt while a delayed payment is still processing", async () => {
    mocks.db.order.findFirst.mockResolvedValue({ amountCents: 12500, id: "order_existing", status: OrderStatus.awaiting_payment, stripeCheckoutSessionId: "cs_test_processing" });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_processing", status: "complete", url: "", payment_status: "unpaid", payment_intent: "pi_test_processing"
    } as Awaited<ReturnType<typeof mocks.stripe.checkout.sessions.retrieve>>);
    mocks.stripe.paymentIntents.retrieve.mockResolvedValue({ status: "processing" });
    await expect(prepareQuoteCheckout({ buyerId: "buyer_1", origin: "https://www.shopfia.app", payMode: "deposit", quoteId: "quote_1" })).rejects.toThrow(/being confirmed/);
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
