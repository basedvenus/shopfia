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

  const existingOrder = await db.order.findFirst({
    where: {
      quoteId: quote.id,
      buyerId,
      status: { in: [OrderStatus.awaiting_payment, OrderStatus.paid, OrderStatus.in_progress, OrderStatus.completed] }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      seller: { select: { offsiteAdsEnabled: true, offsiteAdsTier: true } },
      status: true,
      stripeCheckoutSessionId: true
    }
  });
  if (existingOrder) {
    if (existingOrder.status !== OrderStatus.awaiting_payment) {
      throw new Error("Quote already has an active order");
    }

    const checkoutUrl = existingOrder.stripeCheckoutSessionId
      ? await getOpenCheckoutSessionUrl(existingOrder.stripeCheckoutSessionId)
      : null;
    if (checkoutUrl) {
      return {
        checkoutSessionId: existingOrder.stripeCheckoutSessionId,
        checkoutUrl,
        orderId: existingOrder.id
      };
    }

    const session = await createCheckoutSessionForOrder({
      amountCents: existingOrderAmount(quote, payMode),
      buyerId,
      conversationId: quote.quoteRequest.conversation?.id ?? null,
      destinationAccountId: requireStripeReadyVendor(quote.quoteRequest.vendor),
      orderId: existingOrder.id,
      origin,
      payMode,
      productName: checkoutProductName(quote.quoteRequest.vendor.name, quote.quoteRequest.offering?.title),
      quoteId: quote.id,
      seller: existingOrder.seller ?? { offsiteAdsEnabled: false, offsiteAdsTier: OffsiteAdsTier.STANDARD },
      sellerId: null,
      shopId: null,
      vendorProfileId: quote.quoteRequest.vendorId
    });
    await db.order.update({
      where: { id: existingOrder.id },
      data: { stripeCheckoutSessionId: session.id }
    });
    return {
      checkoutSessionId: session.id,
      checkoutUrl: requireCheckoutUrl(session.url),
      orderId: existingOrder.id
    };
  }

  if (!canAcceptQuote(quote)) throw new Error("Quote is not payable");
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

  const order = await db.order.create({
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

  const session = await createCheckoutSessionForOrder({
    amountCents,
    buyerId,
    conversationId: quote.quoteRequest.conversation?.id ?? null,
    destinationAccountId,
    orderId: order.id,
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
  return null;
}

async function createCheckoutSessionForOrder(input: {
  amountCents: number;
  buyerId: string;
  conversationId: string | null;
  destinationAccountId: string;
  orderId: string;
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
      idempotencyKey: `quote-checkout:${input.quoteId}:${input.buyerId}:${input.payMode}`
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
