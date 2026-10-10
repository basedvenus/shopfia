import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(mocks.tx)),
    category: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    user: {
      update: vi.fn()
    },
    vendorProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  },
  tx: {
    vendorCategory: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    vendorProfile: {
      create: vi.fn(),
      update: vi.fn()
    },
    vendorProfileManager: {
      upsert: vi.fn()
    }
  },
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(async () => ({ user: { id: "user_1", role: "VENDOR" } })),
  requireSession: vi.fn(async () => ({
    user: {
      id: "user_1",
      role: "VENDOR"
    }
  })),
  requireVerifiedVendorProfile: vi.fn()
}));
vi.mock("@/lib/security/request", () => ({
  checkServerActionRateLimit: vi.fn(async () => ({ ok: true }))
}));
vi.mock("@/lib/services/marketplace-fees", () => ({
  createListing: vi.fn(),
  ensureSellerAccountForVendorProfile: vi.fn()
}));

import { upsertVendorProfileAction } from "@/app/actions/vendor";
import VendorOnboardingPage from "@/app/onboarding/page";

function findBusinessIdInput(node: ReactNode): string | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const businessId = findBusinessIdInput(child);
      if (businessId) return businessId;
    }
    return undefined;
  }
  if (!isValidElement<{ name?: string; value?: string; children?: ReactNode }>(node)) return undefined;
  if (node.type === "input" && node.props.name === "businessId") return node.props.value;
  return findBusinessIdInput(node.props.children);
}

function secondBusinessFormData() {
  const formData = new FormData();
  formData.set("newBusiness", "1");
  formData.set("name", "Second Studio");
  formData.set("username", "second.studio");
  formData.set("slug", "second-studio");
  formData.set("city", "Napa");
  formData.set("state", "CA");
  formData.set("bio", "");
  formData.set("serviceAreaNotes", "");
  formData.set("serviceRadiusMiles", "25");
  formData.append("categoryIds", "vendor-catering-beverages");
  return formData;
}

describe("vendor profile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.vendorProfile.findFirst.mockResolvedValue(null);
    mocks.db.vendorProfile.findMany.mockResolvedValue([]);
    mocks.db.vendorProfile.findUnique.mockResolvedValue({ id: "primary_vendor" });
    mocks.db.category.count.mockResolvedValue(1);
    mocks.db.category.findMany.mockResolvedValue([]);
    mocks.tx.vendorProfile.create.mockResolvedValue({
      id: "second_vendor",
      slug: "second-studio"
    });
  });

  it.each(["slug", "username"] as const)("rejects editing a business to another managed business's %s without changing either business", async (conflictField) => {
    const currentBusiness = {
      id: "primary_vendor",
      name: "Primary Studio",
      slug: "primary-studio",
      status: "CLAIMED",
      username: "primary.studio",
      userId: "user_1",
      managers: [],
      _count: { managers: 0 }
    };
    mocks.db.vendorProfile.findFirst.mockResolvedValueOnce(currentBusiness);
    mocks.db.vendorProfile.findMany.mockResolvedValueOnce([{
      ...currentBusiness,
      id: "second_vendor",
      name: "Second Studio",
      slug: "second-studio",
      username: "second.studio"
    }]);
    const formData = secondBusinessFormData();
    formData.delete("newBusiness");
    formData.set("businessId", currentBusiness.id);
    formData.set("slug", conflictField === "slug" ? "second-studio" : currentBusiness.slug);
    formData.set("username", conflictField === "username" ? "second.studio" : currentBusiness.username);

    await expect(upsertVendorProfileAction(formData)).rejects.toThrow("NEXT_REDIRECT:/onboarding?");

    const redirectUrl = new URL(mocks.redirect.mock.calls[0][0], "http://localhost");
    expect(redirectUrl.searchParams.get("profileError")).toBe(
      "That username or storefront URL belongs to another business. Choose an available one."
    );
    expect(redirectUrl.searchParams.get("business")).toBe(currentBusiness.slug);
    expect(mocks.db.vendorProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: currentBusiness.id } })
    }));
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.vendorProfile.create).not.toHaveBeenCalled();
    expect(mocks.tx.vendorProfile.update).not.toHaveBeenCalled();
  });

  it("keeps a managed secondary business selected through a collision and corrected retry", async () => {
    const secondaryBusiness = {
      id: "second_vendor", name: "Second Studio", slug: "second-studio", username: "second.studio",
      status: "CLAIMED", userId: null, managers: [{ userId: "user_1" }], _count: { managers: 1 },
      city: "Napa", photos: [], categories: [], offerings: []
    };
    const primaryBusiness = {
      ...secondaryBusiness, id: "primary_vendor", name: "Primary Studio", slug: "primary-studio",
      username: "primary.studio", userId: "user_1", managers: [], _count: { managers: 0 }
    };
    mocks.db.vendorProfile.findFirst.mockImplementation(async ({ where }) =>
      where.id === secondaryBusiness.id || where.slug === secondaryBusiness.slug ? secondaryBusiness : primaryBusiness
    );
    mocks.db.vendorProfile.findMany.mockResolvedValueOnce([primaryBusiness]);
    const formData = secondBusinessFormData();
    formData.delete("newBusiness");
    formData.set("businessId", secondaryBusiness.id);
    formData.set("slug", primaryBusiness.slug);

    await expect(upsertVendorProfileAction(formData)).rejects.toThrow("NEXT_REDIRECT:/onboarding?");
    const errorUrl = new URL(mocks.redirect.mock.calls[0][0], "http://localhost");
    expect(errorUrl.searchParams.get("business")).toBe(secondaryBusiness.slug);
    expect(errorUrl.searchParams.has("newBusiness")).toBe(false);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();

    const reloadedPage = await VendorOnboardingPage({
      searchParams: Promise.resolve(Object.fromEntries(errorUrl.searchParams))
    });
    const retryBusinessId = findBusinessIdInput(reloadedPage);
    expect(retryBusinessId).toBe(secondaryBusiness.id);
    expect(mocks.db.vendorProfile.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: secondaryBusiness.slug })
    }));

    formData.set("businessId", retryBusinessId!);
    formData.set("slug", secondaryBusiness.slug);
    mocks.tx.vendorProfile.update.mockResolvedValueOnce(secondaryBusiness);
    await expect(upsertVendorProfileAction(formData)).rejects.toThrow("NEXT_REDIRECT:/vendor/business/second-studio");
    expect(mocks.tx.vendorProfile.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.vendorProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: secondaryBusiness.id }
    }));
    expect(mocks.tx.vendorProfile.create).not.toHaveBeenCalled();
  });

  it("links a newly created second business to the current vendor account", async () => {
    await expect(upsertVendorProfileAction(secondBusinessFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/vendor/business/second-studio"
    );

    expect(mocks.tx.vendorProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Second Studio",
          userId: null
        })
      })
    );
    expect(mocks.tx.vendorProfileManager.upsert).toHaveBeenCalledWith({
      where: {
        vendorProfileId_userId: {
          vendorProfileId: "second_vendor",
          userId: "user_1"
        }
      },
      update: { role: "OWNER" },
      create: {
        role: "OWNER",
        userId: "user_1",
        vendorProfileId: "second_vendor"
      }
    });
  });

  it("repairs an ownerless matching business from a previous second-business save", async () => {
    mocks.db.vendorProfile.findMany.mockResolvedValueOnce([{
      id: "orphan_vendor",
      name: "Second Studio",
      slug: "second-studio",
      status: "CLAIMED",
      username: "second.studio",
      userId: null,
      managers: [],
      _count: { managers: 0 }
    }]);
    mocks.tx.vendorProfile.update.mockResolvedValue({
      id: "orphan_vendor",
      slug: "second-studio"
    });

    await expect(upsertVendorProfileAction(secondBusinessFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/vendor/business/second-studio"
    );

    expect(mocks.tx.vendorProfile.create).not.toHaveBeenCalled();
    expect(mocks.tx.vendorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "orphan_vendor" },
        data: expect.objectContaining({
          name: "Second Studio"
        })
      })
    );
    expect(mocks.tx.vendorProfileManager.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vendorProfileId_userId: {
            vendorProfileId: "orphan_vendor",
            userId: "user_1"
          }
        }
      })
    );
  });

  it("repairs an ownerless matching business when the vendor username is the conflict", async () => {
    mocks.db.vendorProfile.findMany.mockResolvedValueOnce([{
      id: "orphan_vendor",
      name: "Second Studio",
      slug: "second-studio-copy",
      status: "CLAIMED",
      username: "second.studio",
      userId: null,
      managers: [],
      _count: { managers: 0 }
    }]);
    mocks.tx.vendorProfile.update.mockResolvedValue({
      id: "orphan_vendor",
      slug: "second-studio"
    });

    await expect(upsertVendorProfileAction(secondBusinessFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/vendor/business/second-studio"
    );

    expect(mocks.tx.vendorProfile.create).not.toHaveBeenCalled();
    expect(mocks.tx.vendorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "orphan_vendor" },
        data: expect.objectContaining({
          slug: "second-studio",
          username: "second.studio"
        })
      })
    );
    expect(mocks.tx.vendorProfileManager.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vendorProfileId_userId: {
            vendorProfileId: "orphan_vendor",
            userId: "user_1"
          }
        }
      })
    );
  });
});
