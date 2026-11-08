"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/components/account/profile-provider";

export function RequiredProfileGate({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const setupRoute = pathname === "/account/setup" || pathname === "/account/verify-phone";
  const recoveryRoute = pathname === "/account/reset-password" || pathname === "/account/forgot-password";
  const blocked = Boolean(profile && (!profile.username?.trim() || !profile.name?.trim()) && !setupRoute && !recoveryRoute);

  useEffect(() => {
    if (blocked) router.replace("/account/setup");
  }, [blocked, pathname, router]);

  if (!blocked) return <>{children}</>;
  return (
    <aside aria-label="Profile setup" className="rounded-2xl border bg-white p-5 text-sm">
      <p className="font-semibold">Choose a username and display name to continue.</p>
      <Link href="/account/setup" className="mt-3 inline-block font-semibold underline">Set up your profile</Link>
    </aside>
  );
}
