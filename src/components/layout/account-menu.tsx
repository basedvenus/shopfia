"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarHeart,
  Heart,
  LogOut,
  MessagesSquare,
  Settings,
  Store,
  User
} from "lucide-react";
import { useProfile } from "@/components/account/profile-provider";

type AccountMenuProps = {
  initials: string;
  signOutAction: () => Promise<void>;
};

export function AccountMenu({ initials, signOutAction }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { profile } = useProfile();

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handle =
    profile?.username ??
    (profile?.email?.includes("@")
      ? profile.email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase()
      : null);

  const links = [
    { href: "/account", label: "My Profile", icon: User },
    { href: "/my-parties", label: "My Parties", icon: CalendarHeart },
    { href: "/favorites", label: "Favorites", icon: Heart },
    { href: "/messages", label: "Messages", icon: MessagesSquare },
    ...(profile?.vendorProfile
      ? [{ href: "/vendor/dashboard", label: "Vendor Dashboard", icon: Store }]
      : []),
    { href: "/account#settings", label: "Settings", icon: Settings }
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-white px-2 py-1.5 text-sm shadow-sm transition hover:bg-muted"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="grid aspect-square h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-foreground"
        >
          {profile?.image ? (
            <img src={profile.image} alt="" className="h-full w-full object-cover object-center" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden max-w-[120px] truncate pr-2 text-muted-foreground md:block">
          {profile?.name || "Profile"}
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-3xl border border-border bg-white p-2 shadow-soft"
          role="menu"
        >
          <div className="border-b border-border/70 px-3 py-3">
            <div className="font-medium">{profile?.name || "ShopFia profile"}</div>
            <div className="truncate text-xs text-muted-foreground">
              {handle ? `@${handle}` : "@choose-your-handle"}
            </div>
          </div>
          <nav className="grid py-2 text-sm">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form action={signOutAction} className="border-t border-border/70 pt-2">
            <button className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
