import { OffsiteAdsTier, OrderStatus, QuoteRequestStatus, QuoteStatus } from "@prisma/client";
import { canAcceptQuote, quotePayableAmount } from "@/lib/payments";
import { calculateOrderFees, ensureSellerAccountForVendorProfile } from "@/lib/services/marketplace-fees";
import { getStripeServer } from "@/lib/stripe";

export type PrepareQuoteCheckoutInput = {
  buyerId: string;
  origin: string;
  payMode: "deposit" | "full";
  quoteId: string;
};

export async function prepareQuoteCheckout({
  buyerId,
  origin,
  payMode,
  quoteId
}: PrepareQuoteCheckoutInput) {
  const { db } = await import("@/lib/db");
  const stripe = getStripeServer();

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      quoteRequest: {
        include: {
          conversation: { select: { id: true } },
          offering: { select: { id: true, title: true } },
          vendor: true
        }
      }
    }
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.quoteRequest.buyerId !== buyerId) {
    throw new Error("Forbidden");
  }

  const structured = (quote.lineItemsJson as { structured?: { totals: { total: number; bookingPayment: number } }; superseded?: boolean } | null);
  if (structured?.structured && (structured.superseded || !canPrepareQuoteCheckout(quote) || structured.structured.totals.total !== quote.amountCents || structured.structured.totals.bookingPayment !== (quote.depositAmountCents ?? quote.amountCents))) {
    throw new Error("This quote is no longer payable. Review the current quote in your conversation.");
  }
  const existingOrder = await db.order.findFirst({
    where: {
      quoteId: quote.id,
      buyerId
    },
    orderBy: { createdAt: "desc" },
    select: {
      amountCents: true,
      id: true,
      paymentSucceededAt: true,
      seller: { select: { offsiteAdsEnabled: true, offsiteAdsTier: true } },
      sellerId: true,
      shopId: true,
      status: true,
      stripeCheckoutSessionId: true
    }
  });
  if (existingOrder) {
    if (
      existingOrder.paymentSucceededAt ||
      existingOrder.status === OrderStatus.refunded ||
      existingOrder.status === OrderStatus.paid ||
      existingOrder.status === OrderStatus.in_progress ||
      existingOrder.status === OrderStatus.completed
    ) {
      throw new Error("Quote already has an active order");
    }
    if (existingOrder.amountCents !== quotePayableAmount(quote, payMode)) {
      // A canceled order's quote can have been revised. Never charge the old
      // amount while the buyer is viewing a different price or payment option.
      throw new Error("This quote or payment option changed after checkout began. Please request a new quote before paying.");
    }

    const checkoutUrl = existingOrder.stripeCheckoutSessionId
      ? await getOpenCheckoutSessionUrl(existingOrder.stripeCheckoutSessionId)
      : null;
    if (checkoutUrl) {
      if (existingOrder.status !== OrderStatus.awaiting_payment) {
        const reopened = await db.order.updateMany({
          where: {
            id: existingOrder.id,
            stripeCheckoutSessionId: existingOrder.stripeCheckoutSessionId,
            paymentSucceededAt: null,
            status: { in: [OrderStatus.draft, OrderStatus.awaiting_payment, OrderStatus.canceled] }
          },
          data: { status: OrderStatus.awaiting_payment }
        });
        if (reopened.count !== 1) throw new Error("The order changed while preparing payment. Please refresh it.");
      }
      return {
        checkoutSessionId: existingOrder.stripeCheckoutSessionId,
        checkoutUrl,
        orderId: existingOrder.id
      };
    }

    const session = await createCheckoutSessionForOrder({
      amountCents: existingOrder.amountCents || existingOrderAmount(quote, payMode),
      buyerId,
      conversationId: quote.quoteRequest.conversation?.id ?? null,
      destinationAccountId: requireStripeReadyVendor(quote.quoteRequest.vendor),
      orderId: existingOrder.id,
      previousSessionId: existingOrder.stripeCheckoutSessionId,
      origin,
      payMode,
      productName: checkoutProductName(quote.quoteRequest.vendor.name, quote.quoteRequest.offering?.title),
      quoteId: quote.id,
      seller: existingOrder.seller ?? { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: existingOrder.sellerId,
      shopId: existingOrder.shopId,
      vendorProfileId: quote.quoteRequest.vendorId
    });
    const replaced = await db.order.updateMany({
      where: {
        id: existingOrder.id,
        stripeCheckoutSessionId: existingOrder.stripeCheckoutSessionId,
        paymentSucceededAt: null,
        status: { in: [OrderStatus.draft, OrderStatus.awaiting_payment, OrderStatus.canceled] }
      },
      data: {
        status: OrderStatus.awaiting_payment,
        stripeCheckoutSessionId: session.id
      }
    });
    if (replaced.count !== 1) throw new Error("The order changed while preparing payment. Please refresh it.");
    return {
      checkoutSessionId: session.id,
      checkoutUrl: requireCheckoutUrl(session.url),
      orderId: existingOrder.id
    };
  }

  if (!canPrepareQuoteCheckout(quote)) throw new Error("Quote is not payable");
  const destinationAccountId = requireStripeReadyVendor(quote.quoteRequest.vendor);
  if (!quote.quoteRequest.vendor.userId) {
    throw new Error("This business has not claimed their ShopFia profile yet.");
  }

  const vendorUser = await db.user.findUnique({
    where: { id: quote.quoteRequest.vendor.userId },
    select: { id: true }
  });
  if (!vendorUser) throw new Error("Vendor user not found");

  const amountCents = quotePayableAmount(quote, payMode);
  const { seller, shop } = await ensureSellerAccountForVendorProfile(quote.quoteRequest.vendorId);
  const listing = quote.quoteRequest.offeringId
    ? await db.listing.findUnique({
        where: { offeringId: quote.quoteRequest.offeringId },
        select: { id: true }
      })
    : null;

  const createOrder = (client: Pick<typeof db, "order">) => client.order.create({
    data: {
      buyerId,
      vendorId: vendorUser.id,
      vendorProfileId: quote.quoteRequest.vendorId,
      sellerId: seller.id,
      shopId: shop.id,
      listingId: listing?.id ?? null,
      offeringId: quote.quoteRequest.offeringId,
      quoteId: quote.id,
      amountCents,
      itemSubtotalCents: amountCents,
      buyerTotalCents: amountCents,
      status: OrderStatus.awaiting_payment
    }
  });
  const order = structured?.structured ? await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${quote.quoteRequest.conversationId ?? quote.id}))`;
    const current = await tx.quote.findUnique({ where: { id: quote.id } });
    if (!current || !canAcceptQuote(current) || current.amountCents !== quote.amountCents || current.depositAmountCents !== quote.depositAmountCents) throw new Error("This quote changed. Review the current version before paying.");
    const alreadyStarted = await tx.order.findFirst({ where: { quoteId: quote.id } });
    if (alreadyStarted) throw new Error("Checkout has already started. Refresh the conversation to continue payment.");
    const created = await createOrder(tx);
    await tx.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.ACCEPTED } });
    await tx.quoteRequest.update({ where: { id: quote.quoteRequest.id }, data: { status: QuoteRequestStatus.ACCEPTED } });
    return created;
  }) : await createOrder(db);


  const session = await createCheckoutSessionForOrder({
    amountCents,
    buyerId,
    conversationId: quote.quoteRequest.conversation?.id ?? null,
    destinationAccountId,
    orderId: order.id,
    previousSessionId: null,
    origin,
    payMode,
    productName: checkoutProductName(quote.quoteRequest.vendor.name, quote.quoteRequest.offering?.title),
    quoteId: quote.id,
    seller,
    sellerId: seller.id,
    shopId: shop.id,
    vendorProfileId: quote.quoteRequest.vendorId
  });

  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id }
    }),
    db.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED }
    }),
    db.quoteRequest.update({
      where: { id: quote.quoteRequest.id },
      data: { status: QuoteRequestStatus.ACCEPTED }
    })
  ]);

  return {
    checkoutSessionId: session.id,
    checkoutUrl: requireCheckoutUrl(session.url),
    orderId: order.id
  };
}

function existingOrderAmount(
  quote: { amountCents: number; depositAmountCents: number | null },
  payMode: "deposit" | "full"
) {
  return quotePayableAmount(quote, payMode);
}

function canPrepareQuoteCheckout(quote: { status: QuoteStatus; expiresAt: Date }) {
  if (canAcceptQuote(quote)) return true;
  return quote.status === QuoteStatus.ACCEPTED && quote.expiresAt > new Date();
}

function requireStripeReadyVendor(vendor: {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripeOnboardingComplete: boolean;
  stripePayoutsEnabled: boolean;
}) {
  if (
    !vendor.stripeAccountId ||
    !vendor.stripeOnboardingComplete ||
    !vendor.stripeChargesEnabled ||
    !vendor.stripePayoutsEnabled
  ) {
    throw new Error("This vendor has not finished payout setup yet.");
  }
  return vendor.stripeAccountId;
}

async function getOpenCheckoutSessionUrl(sessionId: string) {
  const stripe = getStripeServer();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === "open" && session.url) {
    return session.url;
  }
  if (session.status === "complete" && session.payment_status === "unpaid") {
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status === "requires_payment_method" || intent.status === "canceled") {
        // A completed delayed-payment Checkout cannot be reused after a
        // provider-confirmed failed attempt. Processing payments stay blocked.
        return null;
      }
    }
  }
  if (session.status !== "expired") {
    // A completed Checkout can still be waiting for its webhook. Never open a
    // second payment while the first payment may already have succeeded.
    throw new Error("This payment is being confirmed. Please refresh your order instead of paying again.");
  }
  return null;
}

async function createCheckoutSessionForOrder(input: {
  amountCents: number;
  buyerId: string;
  conversationId: string | null;
  destinationAccountId: string;
  orderId: string;
  previousSessionId: string | null;
  origin: string;
  payMode: "deposit" | "full";
  productName: string;
  quoteId: string;
  seller: { offsiteAdsEnabled: boolean; offsiteAdsTier: OffsiteAdsTier };
  sellerId: string | null;
  shopId: string | null;
  vendorProfileId: string;
}) {
  const stripe = getStripeServer();
  const fees = await calculateOrderFees(
    {
      itemSubtotalCents: input.amountCents,
      shippingAmountCents: 0,
      taxAmountCents: 0,
      giftWrapAmountCents: 0,
      buyerTotalCents: input.amountCents,
      taxRemittedByMarketplace: false,
      listingFeeCents: 0,
      offsiteAdsAttributed: false,
      offsiteAdsTier: input.seller.offsiteAdsTier
    },
    input.seller
  );
  const applicationFeeAmount = Math.min(input.amountCents, Math.max(0, fees.totalFeesCents));
  const successUrl = buildMessagesReturnUrl(input.origin, input.conversationId, input.orderId, "return");
  const cancelUrl = buildMessagesReturnUrl(input.origin, input.conversationId, input.orderId, "canceled");

  return stripe.checkout.sessions.create(
    {
      cancel_url: cancelUrl,
      client_reference_id: input.orderId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: input.productName
            },
            unit_amount: input.amountCents
          },
          quantity: 1
        }
      ],
      metadata: {
        buyerId: input.buyerId,
        orderContext: "quote_acceptance",
        orderId: input.orderId,
        payableMode: input.payMode,
        platformFeeCents: String(applicationFeeAmount),
        quoteId: input.quoteId,
        sellerId: input.sellerId ?? "",
        shopId: input.shopId ?? "",
        vendorProfileId: input.vendorProfileId
      },
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        metadata: {
          buyerId: input.buyerId,
          orderContext: "quote_acceptance",
          orderId: input.orderId,
          payableMode: input.payMode,
          platformFeeCents: String(applicationFeeAmount),
          quoteId: input.quoteId,
          sellerId: input.sellerId ?? "",
          shopId: input.shopId ?? "",
          vendorProfileId: input.vendorProfileId
        },
        transfer_data: {
          destination: input.destinationAccountId
        }
      },
      success_url: successUrl
    },
    {
      // Retrying the same attempt reuses its key; replacing an expired session
      // starts a new attempt, even while Stripe retains the original response.
      idempotencyKey: `quote-checkout:${input.orderId}:${input.previousSessionId ?? "initial"}`
    }
  );
}

function buildMessagesReturnUrl(
  origin: string,
  conversationId: string | null,
  orderId: string,
  payment: "return" | "canceled"
) {
  const url = new URL("/messages", origin);
  if (conversationId) url.searchParams.set("conversationId", conversationId);
  url.searchParams.set("payment", payment);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  return url.toString();
}

function checkoutProductName(vendorName: string, offeringTitle?: string | null) {
  return offeringTitle ? `${offeringTitle} from ${vendorName}` : `Custom quote from ${vendorName}`;
}

function requireCheckoutUrl(url: string | null) {
  if (!url) {
    throw new Error("Stripe checkout is not ready yet. Please try again.");
  }
  return url;
}
