import { VendorProfileStatus } from "@prisma/client";

type VendorStatusInput = {
  status: VendorProfileStatus | string;
  user?: unknown | null;
  verified: boolean;
};

export function getVendorTrustStatus(vendor: VendorStatusInput) {
  // Additional businesses use VendorProfileManager ownership instead of user.
  // The stored status applies to both ownership models.
  if (vendor.status === VendorProfileStatus.UNCLAIMED) {
    return { label: "Unclaimed", tone: "neutral" as const };
  }

  if (vendor.status === VendorProfileStatus.VERIFIED || vendor.verified) {
    return { label: "Verified", tone: "verified" as const };
  }

  return { label: "Claimed", tone: "claimed" as const };
}

export function isVendorVerified(vendor: VendorStatusInput) {
  return getVendorTrustStatus(vendor).label === "Verified";
}
