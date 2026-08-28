# ShopFia Mobile

Expo and React Native foundation for ShopFia's separate native mobile app. This is a second product alongside the existing browser-based website, not a replacement or conversion of the website.

The mobile app keeps all mobile-specific code in `/mobile` and calls the same ShopFia backend for accounts, marketplace data, vendor listings, messages, quote/bookings, and Stripe-backed payment flows so data stays synchronized across website and app.

## Physical iPhone authentication baseline

ShopFia uses the website's Auth.js JWT session and Prisma `User`/`Account` records. The mobile app does not have a separate account store. Public Explore, vendor, offering, and party pages work while signed out. Existing ShopFia email/password accounts work in Expo Go and development builds through the hosted mobile auth endpoint. Google sign-in exchanges a Google iOS ID token for the same Auth.js session cookie used by the website.

Google OAuth cannot be tested in Expo Go because Expo Go cannot use ShopFia's custom OAuth redirect scheme. Use email/password in Expo Go or install an iOS development build for Google sign-in.

### One-time Google Cloud and hosted-backend setup

1. Keep the existing Google **Web application** OAuth client and its website callback unchanged: `https://www.shopfia.app/api/auth/callback/google`.
2. In the same Google Cloud project, create an **iOS** OAuth client with bundle ID `app.shopfia.mobile`.
3. Copy that iOS client ID (it ends in `.apps.googleusercontent.com`). Set it as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in the Expo/EAS `development` environment.
4. Set the identical client ID as `GOOGLE_IOS_CLIENT_ID` (or `AUTH_GOOGLE_IOS_ID`) on the hosted ShopFia backend, then deploy the backend route in this repository.
5. Keep `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` on the hosted backend unchanged. They continue to power the website's Auth.js flow.

ShopFia does not use Clerk. Supabase is used only for optional message realtime and does not need an OAuth change for this flow.

### Install and run the development build

```bash
npm install
npx eas login
eas env:create --environment development --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value YOUR_IOS_CLIENT_ID --visibility plaintext
npm run build:ios:development
npm run start:dev-client
```

Install the EAS build on the iPhone from its internal-distribution link. The app is pinned to `https://www.shopfia.app`; it does not use localhost for physical-device requests.

After installing, verify: launch opens public Explore; email/password or Google returns to ShopFia; force-quitting and reopening restores the session; Account → Sign out returns to public Explore; and reopening remains signed out.

## App Store Build

The app is configured for native iOS distribution through Expo Application Services.

```bash
npm install
npx eas login
npm run build:ios
```

Before submitting to Apple App Store Connect, fill the production `submit.ios` identifiers in `eas.json`, configure the iOS client ID for the production EAS environment, and confirm `EXPO_PUBLIC_SHOPFIA_API_URL` points at the production ShopFia backend.
