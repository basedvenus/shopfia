import Link from "next/link";
import {
  CalendarHeart,
  Heart,
  LayoutGrid,
  LogOut,
  MapPinned,
  MessagesSquare,
  Settings,
  Shield,
  Store,
  User
} from "lucide-react";
import { signOut, auth } from "@/auth";
import { Button } from "@/components/ui/button";

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

export async function SiteNav() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const initials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
    <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/explore" className="text-lg font-semibold tracking-tight">
         <img
  src="/logo.png"
  alt="ShopFia"
  className="h-[95px] w-auto max-w-[180px] object-contain block"
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
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm hover:bg-muted">
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-white px-2 py-1.5 text-sm shadow-sm transition hover:bg-muted">
                <span
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-foreground"
                  style={
                    session?.user?.image
                      ? {
                          backgroundImage: `url(${session.user.image})`,
                          backgroundPosition: "center",
                          backgroundSize: "cover"
                        }
                      : undefined
                  }
                >
                  {session?.user?.image ? <span className="sr-only">{initials}</span> : initials}
                </span>
                <span className="hidden max-w-[120px] truncate pr-2 text-muted-foreground md:block">
                  {session?.user?.name || "Profile"}
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-3xl border border-border bg-white p-2 shadow-soft">
                <div className="border-b border-border/70 px-3 py-3">
                  <div className="font-medium">{session?.user?.name || "ShopFia profile"}</div>
                  <div className="truncate text-xs text-muted-foreground">{session?.user?.email}</div>
                </div>
                <nav className="grid py-2 text-sm">
                  <Link href="/account" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                  <Link href="/account#my-parties" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <CalendarHeart className="h-4 w-4" />
                    My Parties
                  </Link>
                  <Link href="/favorites" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <Heart className="h-4 w-4" />
                    Favorites
                  </Link>
                  <Link href="/messages" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <MessagesSquare className="h-4 w-4" />
                    Messages
                  </Link>
                  <Link href="/vendor/dashboard" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <Store className="h-4 w-4" />
                    Vendor Dashboard
                  </Link>
                  <Link href="/account#settings" className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-muted">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </nav>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/explore" });
                  }}
                  className="border-t border-border/70 pt-2"
                >
                  <button className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </form>
              </div>
            </details>
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
