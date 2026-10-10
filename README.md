# ShopFia

ShopFia is a marketplace web app for local event services and artisan goods (bakers, balloon garlands, florals, rentals, custom gifts). The MVP focuses on an Instagram/OfferUp-style `Explore` experience with messaging, quote requests, booking/payment flow foundations, vendor onboarding, and basic admin moderation.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui-style component setup
- PostgreSQL + Prisma
- Auth.js (`next-auth` v5 beta) with Email magic link + Google OAuth
- Stripe PaymentIntents + Stripe Connect Express onboarding
- Cloudinary-ready upload utility stubs (URL-based MVP inputs)

## Current state (important)

This repository was scaffolded manually in an environment without `node`, `npm`, Prisma CLI, or `git` CLI. The codebase and file structure are implemented, but dependency installation, migrations, runtime verification, and commits could not be executed here.

## Setup

1. Install Node.js 20+ and npm.
2. Install dependencies:

```bash
npm install
```

3. Copy env file and fill values:

```bash
cp .env.example .env
```

4. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Seed demo data:

```bash
npm run prisma:seed
```

6. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000/explore](http://localhost:3000/explore).

## Environment variables

See `.env.example` for the full list:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `CLOUDINARY_URL`

## Stripe Connect marketplace payments setup

ShopFia uses Stripe Connect Express for marketplace payouts. Vendors connect a
Stripe Express account from the Vendor Dashboard, buyers eventually pay ShopFia,
and Stripe transfers the vendor share to the connected vendor account.

### Environment variables

Set these locally and in Vercel:

- `STRIPE_SECRET_KEY`: server-only secret key. Never expose this in client code.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: publishable browser key for future Stripe Elements checkout UI.
- `STRIPE_WEBHOOK_SECRET`: webhook signing secret for `/api/stripe/webhook`.

Use separate Stripe test and live keys for preview/development versus production.

### Stripe dashboard steps

1. Create or open the Stripe account that will own the ShopFia platform.
2. Enable Connect and choose Express connected accounts.
3. Enable the payment methods you want for checkout, starting with cards.
4. Add a webhook endpoint:
   - Local: use the Stripe CLI command below.
   - Production: `https://www.shopfia.app/api/stripe/webhook`
5. Subscribe the webhook endpoint to:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
6. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
7. In Vercel, add the same Stripe env vars for Production and Preview, then redeploy.

### Local webhook testing

Run Stripe CLI for local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the generated `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.

### App behavior

- Vendors open `/vendor/dashboard` and click `Connect bank account`.
- The app creates a Stripe Express connected account with card payments and
  transfers requested.
- Stripe webhook events update `stripeOnboardingComplete`,
  `stripeChargesEnabled`, and `stripePayoutsEnabled` on the vendor profile.
- Buyers cannot create quote payment intents until the vendor account is ready
  for both charges and payouts.
- Quote payment intents use destination charges with `application_fee_amount`,
  so ShopFia can collect marketplace/payment fees while the vendor receives the
  connected-account payout path.

The production-ready Stripe Elements confirmation UI can be added on top of the
existing PaymentIntent/client-secret action when the booking checkout screen is
ready.

## Auth setup (Google + magic link)

### Google OAuth

1. Create a Google OAuth client.
2. Add redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://www.shopfia.app/api/auth/callback/google`
3. In Vercel, set `AUTH_SECRET`, `AUTH_URL=https://www.shopfia.app`,
   `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`.
   `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are still
   accepted for local compatibility.

### Email magic link (SMTP)

Set:

- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

If these are omitted, the provider won’t be enabled.

## Seeding demo data

The seed script creates:

- Categories (Bakers, Balloon Garlands, Florals, Rentals, Custom Gifts, etc.)
- Demo vendors with profiles and offerings
- Demo buyer user
- Demo admin user

Run:

```bash
npm run prisma:seed
```

## Tests

### Unit tests (Vitest)

```bash
npm test
```

`npm test` and `npm run test:watch` run only `tests/unit`. They use a
disabled loopback `DATABASE_URL` and block construction of real Prisma clients.
Database-dependent unit tests must explicitly mock `@/lib/db`; an omitted mock
fails immediately instead of reading or writing the application database.

Included tests cover:

- Auth guard ownership logic
- Prisma create-flow payload (mocked client)
- Quote acceptance/payment amount logic
- Integration database target validation and rollback safety

### Opt-in database integration tests

The inquiry flow test lives in `tests/integration`. It requires a separate,
disposable local PostgreSQL database with the repository's migrations applied.
No seed data is needed. Never use a production database, a database containing
real user data, or a local port forwarded to a remote database.

Both `RUN_DB_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` must be explicitly set.
The URL must use PostgreSQL, numeric loopback `127.0.0.1` or `[::1]`, an explicit
port, and a database name beginning `shopfia_test_`. Query parameters and URL
fragments are rejected. Application `DATABASE_URL` and `.env` credentials are
never a fallback for integration tests.

For example, after provisioning and migrating a disposable local database:

```bash
env -i PATH="$PATH" HOME="$HOME" \
  RUN_DB_INTEGRATION_TESTS=1 \
  TEST_DATABASE_URL='postgresql://test:test@127.0.0.1:5433/shopfia_test_inquiries' \
  npm run test:integration
```

The inquiry test mocks email delivery and puts all fixture and application
writes into one transaction that is rolled back on success or failure. It also
checks that the vendor profile is absent after rollback. These tests do not
clean up previously leaked data or modify production data.

### E2E smoke tests (Playwright)

```bash
npm run test:e2e
```

Smoke tests include:

- Explore page loads
- Account guest sign-in UI loads

## App areas implemented

- `Explore` page with search and filters backed by real DB queries
- Vendor profile page with offerings, messaging, quote request form, reviews
- Offering detail page (service/product)
- Account page (auth entry, quote/order overview, review submit, quote acceptance -> PaymentIntent creation)
- Favorites
- Messages (threads + vendor quote responses)
- Vendor onboarding (profile + first offering)
- Vendor dashboard (overview, offerings, requests, orders, Stripe Connect status)
- Admin panel (users/vendors/offerings/categories/reports summary + moderation actions)
- Stripe Connect onboarding route + Stripe webhook route
- Prisma schema + seed script

## Recommended next steps

1. Install dependencies and run `npm run prisma:migrate` to generate the first migration.
2. Add Stripe Elements checkout UI (`@stripe/react-stripe-js`) for client-side payment confirmation.
3. Replace URL-based image inputs with real Cloudinary signed uploads.
4. Add pagination/cursor loading and geolocation distance sorting.
5. Harden rate limiting (Redis/upstash) and add audit logs for admin actions.
