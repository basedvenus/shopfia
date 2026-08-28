import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(mocks.tx)),
    category: {
      count: vi.fn()
    },
    user: {
      update: vi.fn()
    },
    vendorProfile: {
      findFirst: vi.fn(),
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
  requireRole: vi.fn(),
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
    mocks.db.vendorProfile.findUnique.mockResolvedValue({ id: "primary_vendor" });
    mocks.db.category.count.mockResolvedValue(1);
    mocks.tx.vendorProfile.create.mockResolvedValue({
      id: "second_vendor",
      slug: "second-studio"
    });
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
    mocks.db.vendorProfile.findFirst.mockResolvedValueOnce({
      id: "orphan_vendor",
      name: "Second Studio",
      slug: "second-studio",
      status: "CLAIMED",
      username: "second.studio",
      userId: null,
      managers: [],
      _count: { managers: 0 }
    });
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
});
