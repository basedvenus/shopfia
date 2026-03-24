import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function requireSession() {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    redirect("/explore");
  }
  return session;
}

export function canViewVendorScopedResource({
  sessionUserId,
  sessionRole,
  vendorUserId
}: {
  sessionUserId: string;
  sessionRole: UserRole;
  vendorUserId: string;
}) {
  return sessionRole === "ADMIN" || sessionUserId === vendorUserId;
}

export async function requireVerifiedVendorProfile(userId: string) {
  const vendorProfile = await db.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, verified: true, slug: true }
  });
  if (!vendorProfile) {
    throw new Error("Vendor profile not found");
  }
  if (!vendorProfile.verified) {
    throw new Error("Vendor account is suspended");
  }
  return vendorProfile;
}
