# ShopFia Mobile

Expo and React Native foundation for ShopFia's separate native mobile app. This is a second product alongside the existing browser-based website, not a replacement or conversion of the website.

The mobile app keeps all mobile-specific code in `/mobile` and calls the same ShopFia backend for accounts, marketplace data, vendor listings, messages, quote/bookings, and Stripe-backed payment flows so data stays synchronized across website and app.

## Run

```bash
npm install
EXPO_PUBLIC_SHOPFIA_API_URL=http://localhost:3000 npm run start
```

Use a LAN or tunneled URL for `EXPO_PUBLIC_SHOPFIA_API_URL` when testing on a physical phone.

## App Store Build

The app is configured for native iOS distribution through Expo Application Services.

```bash
npm install
npx eas login
npm run build:ios
```

Before submitting to Apple App Store Connect, fill the production `submit.ios` identifiers in `eas.json` and confirm `EXPO_PUBLIC_SHOPFIA_API_URL` points at the production ShopFia backend.
