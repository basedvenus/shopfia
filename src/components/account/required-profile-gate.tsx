"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/account/profile-provider";

export function RequiredProfileGate() {
  const pathname = usePathname();
  const { profile } = useProfile();

  // Missing profile fields do not tell us whether this is a new account or an
  // existing account needing recovery. Never turn that ambiguity into a global
  // navigation redirect, or treat it as permission to create a replacement.
  if (!profile || (profile.username && profile.name)) return null;
  if (pathname === "/account/setup" || pathname === "/account/reset-password") return null;

  return (
    <aside aria-label="Profile setup" className="mb-6 rounded-2xl border border-border bg-[#fff8f5] p-4 text-sm">
      <p className="font-semibold">Your profile is missing a name or username.</p>
      <p className="mt-1 text-muted-foreground">
        You can keep browsing and return to setup later. If you already had a
        profile or storefront, check your existing login before creating anything new.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        <Link href="/account/setup" className="font-semibold underline">Finish profile setup</Link>
        <Link href="/account/setup#account-recovery" className="font-semibold underline">Find my existing account</Link>
      </div>
    </aside>
  );
}
