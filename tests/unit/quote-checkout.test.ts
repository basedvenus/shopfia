import { beforeEach, describe, expect, it, vi } from "vitest";
import { OffsiteAdsTier, OrderStatus, QuoteRequestStatus, QuoteStatus } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const db = {
    $transaction: vi.fn(async (input) => input),
    listing: {
      findUnique: vi.fn()
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
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
    mocks.db.quote.update.mockResolvedValue({ id: "quote_1" });
    mocks.db.quoteRequest.update.mockResolvedValue({ id: "quote_request_1" });
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
      { idempotencyKey: "quote-checkout:quote_1:buyer_1:deposit" }
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
      id: "order_existing",
      seller: { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
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
});
