import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

type ConnectAccountInput = {
  businessName?: string | null;
  email?: string | null;
  vendorProfileId: string;
  userId: string;
};

export function getStripeServer() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    });
  }

  return stripeInstance;
}

export async function createConnectAccount() {
  const stripe = getStripeServer();
  return stripe.accounts.create({ type: "express" });
}

export async function createVendorConnectAccount(input: ConnectAccountInput) {
  const stripe = getStripeServer();
  return stripe.accounts.create({
    type: "express",
    country: "US",
    email: input.email ?? undefined,
    business_profile: {
      name: input.businessName ?? undefined,
      product_description: "Event services and party goods booked through ShopFia"
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    metadata: {
      platform: "shopfia",
      userId: input.userId,
      vendorProfileId: input.vendorProfileId
    }
  });
}

export async function createConnectAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const stripe = getStripeServer();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding"
  });
}

export async function createConnectLoginLink(accountId: string) {
  const stripe = getStripeServer();
  return stripe.accounts.createLoginLink(accountId);
}

export async function retrieveConnectAccount(accountId: string) {
  const stripe = getStripeServer();
  return stripe.accounts.retrieve(accountId);
}

export function getConnectReadiness(account: Stripe.Account) {
  return {
    onboardingComplete: Boolean(account.details_submitted),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled)
  };
}
