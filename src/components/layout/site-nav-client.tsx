"use client";

import Link from "next/link";
import {
  Heart,
  LayoutGrid,
  MapPinned,
  MessagesSquare,
  User
} from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/components/account/profile-provider";

const navItems = [
  { href: "/listings", label: "Listings", icon: LayoutGrid },
  { href: "/explore", label: "Explore", icon: MapPinned },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessagesSquare }
];

function getInitials(name?: string | null, email?: string | null) {
  const label = name || email || "ShopFia";
  return label
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SiteNavClient({
  signOutAction
}: {
  signOutAction: () => Promise<void>;
}) {
  const { profile } = useProfile();
  const signedIn = Boolean(profile?.id);
  const initials = getInitials(profile?.name, profile?.email);

  console.log("[profile] navbar render", profile);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          <img
            src="/logo.png"
            alt="ShopFia"
            className="block h-16 w-auto max-w-[170px] object-contain"
          />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link href="/vendor/dashboard" className="rounded-full px-4 py-2 text-sm hover:bg-muted">
            Vendor Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <AccountMenu initials={initials} signOutAction={signOutAction} />
          ) : (
            <>
              <Link href="/account" className="hidden md:inline-flex">
                <Button variant="secondary" size="sm">
                  <User className="h-4 w-4" />
                  Account
                </Button>
              </Link>
              <Link href="/account">
                <Button size="sm">Sign in</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
