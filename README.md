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
- `NEXTAUTH_SECRET`
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

## Stripe Connect + payments setup

1. Create a Stripe account and enable Connect.
2. Create a Connect platform and use Express accounts.
3. Add API keys to `.env`.
4. Run Stripe CLI for local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

5. Copy the generated webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
6. In the app, sign in as a vendor and open `/vendor/dashboard`, then click `Connect Stripe`.

Notes:

- The MVP creates Stripe PaymentIntents when a buyer accepts a quote from `/account`.
- Webhook handling updates `Order` status to `paid` on `payment_intent.succeeded`.
- A production-ready Stripe Elements checkout UI can be added on top of the existing PaymentIntent action/metadata flow.

## Auth setup (Google + magic link)

### Google OAuth

1. Create a Google OAuth client.
2. Add redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

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

Included tests cover:

- Auth guard ownership logic
- Prisma create-flow payload (mocked client)
- Quote acceptance/payment amount logic

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
