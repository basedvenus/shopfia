import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { canViewVendorScopedResource } from "@/lib/auth/guards";

describe("auth guards", () => {
  it("allows admin to view vendor scoped resource", () => {
    expect(
      canViewVendorScopedResource({
        sessionUserId: "u1",
        sessionRole: UserRole.ADMIN,
        vendorUserId: "u2"
      })
    ).toBe(true);
  });

  it("allows vendor owner to view their resource", () => {
    expect(
      canViewVendorScopedResource({
        sessionUserId: "u1",
        sessionRole: UserRole.VENDOR,
        vendorUserId: "u1"
      })
    ).toBe(true);
  });

  it("blocks other vendors", () => {
    expect(
      canViewVendorScopedResource({
        sessionUserId: "u1",
        sessionRole: UserRole.VENDOR,
        vendorUserId: "u2"
      })
    ).toBe(false);
  });
});
