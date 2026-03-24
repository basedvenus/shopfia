import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

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

export async function createConnectAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const stripe = getStripeServer();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding"
  });
}
