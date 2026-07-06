import type { Metadata } from "next";
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
      <body>
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
