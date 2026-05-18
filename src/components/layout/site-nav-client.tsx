"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  CalendarHeart,
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
  { href: "/explore", label: "Explore", icon: MapPinned },
  { href: "/parties", label: "Parties", icon: CalendarHeart },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessagesSquare }
];

const mobileNavItems = [
  { href: "/explore", label: "Explore", icon: MapPinned },
  { href: "/parties", label: "Parties", icon: CalendarHeart },
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
  signOutAction,
  unreadMessagesCount = 0
}: {
  signOutAction: () => Promise<void>;
  unreadMessagesCount?: number;
}) {
  const { profile } = useProfile();
  const pathname = usePathname();
  const signedIn = Boolean(profile?.id);
  const initials = getInitials(profile?.name, profile?.email);

  useEffect(() => {
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadMessagesCount > 0 ? `(${unreadMessagesCount}) ${baseTitle}` : baseTitle;
  }, [unreadMessagesCount]);

  return (
    <>
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
                  className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b9ae]"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.href === "/messages" && unreadMessagesCount > 0 ? (
                    <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#e3a7a7] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unreadMessagesCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
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
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/12 bg-background/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2.5 shadow-[0_-8px_26px_rgba(82,55,55,0.07)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex min-h-[3.45rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b9ae] ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`grid place-items-center rounded-full transition ${
                    active
                      ? "h-8 w-8 bg-primary/10"
                      : "h-8 w-8 group-hover:bg-muted"
                  }`}
                >
                  {item.href === "/messages" && unreadMessagesCount > 0 ? (
                    <span className="absolute right-4 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e3a7a7] px-1 text-[10px] font-bold text-white shadow-sm">
                      {unreadMessagesCount}
                    </span>
                  ) : null}
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
