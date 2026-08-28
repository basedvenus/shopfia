import type { Metadata } from "next";
import {
  Bodoni_Moda,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  DM_Sans,
  Fraunces,
  Instrument_Sans,
  Instrument_Serif,
  Inter,
  Manrope,
  Space_Grotesk,
  Syne,
  Work_Sans
} from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { ProfileProvider } from "@/components/account/profile-provider";
import { RequiredProfileGate } from "@/components/account/required-profile-gate";
import { SiteNav } from "@/components/layout/site-nav";
import { db } from "@/lib/db";
import {
  serializeUserProfile,
  userProfileSelect,
  type SharedUserProfile
} from "@/lib/user-profile";

const title = "ShopFia - Discover Local Vendors & Real Party Inspiration";
const description =
  "Browse real celebrations, discover trusted vendors, and plan beautiful events.";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-sans"
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-inter"
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-manrope"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-shopfia-serif",
  weight: ["400", "500", "600", "700"]
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-shopfia-instrument-serif",
  weight: "400"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-space"
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-bodoni"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-dm"
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-bricolage"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-fraunces"
});

const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-work"
});

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shopfia-syne"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.shopfia.app"),
  title: {
    default: title,
    template: "%s | ShopFia"
  },
  description,
  applicationName: "ShopFia",
  icons: {
    icon: [
      { url: "/favicon.svg?v=9", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" }
    ],
    apple: "/logo.png"
  },
  openGraph: {
    title,
    description,
    url: "https://www.shopfia.app",
    siteName: "ShopFia",
    type: "website",
    images: [
      {
        url: "/og-shopfia.svg",
        width: 1200,
        height: 630,
        alt: "ShopFia event inspiration preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-shopfia.svg"]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth().catch((error) => {
    console.error("ShopFia root auth failed", error);
    return null;
  });
  let initialProfile: SharedUserProfile | null = null;

  if (session?.user?.id) {
    try {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: userProfileSelect
      });

      if (dbUser) {
        initialProfile = serializeUserProfile(dbUser);
      }
    } catch (error) {
      console.error("ShopFia profile bootstrap failed", error);
    }
  }

  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${inter.variable} ${manrope.variable} ${cormorant.variable} ${instrumentSerif.variable} ${spaceGrotesk.variable} ${bodoniModa.variable} ${dmSans.variable} ${bricolageGrotesque.variable} ${fraunces.variable} ${workSans.variable} ${syne.variable}`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
        >
          Skip to main content
        </a>
        <ProfileProvider initialProfile={initialProfile}>
          <RequiredProfileGate />
          <SiteNav />
          <main id="main-content" className="container py-6 pb-28 md:pb-6">
            {children}
          </main>
        </ProfileProvider>
      </body>
    </html>
  );
}
