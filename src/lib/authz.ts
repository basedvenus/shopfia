import { UserRole } from "@prisma/client";

export function assertBuyerOwns(resourceBuyerId: string, sessionUserId: string, role: UserRole) {
  if (role !== "ADMIN" && resourceBuyerId !== sessionUserId) {
    throw new Error("Forbidden");
  }
}

export function assertVendorOwns(resourceVendorUserId: string, sessionUserId: string, role: UserRole) {
  if (role !== "ADMIN" && resourceVendorUserId !== sessionUserId) {
    throw new Error("Forbidden");
  }
}
