"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/components/account/profile-provider";

const allowedPrefixes = [
  "/account/setup",
  "/account/reset-password",
  "/welcome"
];

export function RequiredProfileGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();

  useEffect(() => {
    if (!profile || profile.username) return;
    if (allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) return;

    router.replace("/account/setup");
  }, [pathname, profile, router]);

  return null;
}
