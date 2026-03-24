import Link from "next/link";
import { MapPinned, Heart, MessagesSquare, User, LayoutGrid, Shield } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/listings", label: "Listings", icon: LayoutGrid },
  { href: "/explore", label: "Explore", icon: MapPinned },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessagesSquare }
];

export async function SiteNav() {
  const session = await auth();
  const role = session?.user?.role;

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
          {role === "VENDOR" && (
            <Link href="/vendor/dashboard" className="rounded-full px-4 py-2 text-sm hover:bg-muted">
              Vendor Dashboard
            </Link>
          )}
          {role === "ADMIN" && (
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm hover:bg-muted">
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/account" className="hidden md:inline-flex">
            <Button variant="secondary" size="sm">
              <User className="h-4 w-4" />
              Account
            </Button>
          </Link>
          {!session && (
            <Link href="/account">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
