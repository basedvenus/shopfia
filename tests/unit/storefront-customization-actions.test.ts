import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    vendorProfile: {
      findFirst: vi.fn(),
      update: vi.fn()
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

import { autosaveStorefrontDraftAction, updateStorefrontCustomizationAction } from "@/app/actions/vendor";

const businessId = "clv0000000000000000000000";
const serviceOneId = "clv0000000000000000000001";
const serviceTwoId = "clv0000000000000000000002";

function basePayload() {
  const services = [
    {
      active: true,
      basePriceCents: 12500,
      categoryId: null,
      clientId: serviceOneId,
      description: "Full service styling for a polished celebration.",
      featured: true,
      id: serviceOneId,
      messageForPricing: false,
      photos: ["/api/vendor-media/photo-one"],
      title: "Party Styling",
      turnaroundDays: 14
    },
    {
      active: false,
      basePriceCents: null,
      categoryId: null,
      clientId: serviceTwoId,
      description: "Custom balloon installations sized for the event.",
      featured: false,
      id: serviceTwoId,
      messageForPricing: true,
      photos: ["/api/vendor-media/photo-two"],
      title: "Balloon Install",
      turnaroundDays: 7
    }
  ];

  return {
    aboutHeading: "Celebrations with feeling",
    aboutImage: "/api/vendor-media/founder",
    availabilityNotes: "Weekends book first.",
    bio: "A design studio for thoughtful party details.",
    bookingJson: JSON.stringify({
      deposit: "Deposit is confirmed in the quote.",
      leadTime: "Two weeks preferred.",
      process: "Send inspiration, confirm scope, then book through ShopFia."
    }),
    businessId,
    buttonStyle: "PILL",
    city: "Fairfield",
    coverPhoto: "/api/vendor-media/cover",
    faqJson: JSON.stringify([{ id: "faq_1", question: "Can this be customized?", answer: "Yes, every quote is tailored." }]),
    featuredOfferingIds: [serviceOneId, serviceTwoId],
    fontStyle: "EDITORIAL",
    hiddenSections: ["reviews"],
    imageShape: "SOFT",
    instagramUrl: "",
    intent: "draft",
    layout: "EDITORIAL",
    logoUrl: "/api/vendor-media/logo",
    name: "Venus & Aura",
    offeringOrder: [serviceTwoId, serviceOneId],
    palette: "DISCO",
    photoUrls: ["/api/vendor-media/gallery-one", "/api/vendor-media/gallery-two"],
    policiesJson: JSON.stringify([{ id: "policy_1", title: "Changes", body: "Final scope is confirmed before booking." }]),
    sectionOrder: ["hero", "portfolio", "all-services", "faq"],
    sectionLabelsJson: JSON.stringify({ portfolio: "Our Work", faq: "Questions" }),
    serviceAreaNotes: "Serving Solano County and nearby Bay Area events.",
    servicesJson: JSON.stringify(services),
    state: "CA",
    tagline: "Editorial party styling for real life.",
    textTone: "LIGHT",
    tiktokUrl: "",
    website: ""
  };
}

function formDataFromPayload(payload: ReturnType<typeof basePayload>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
    } else {
      formData.set(key, String(value));
    }
  }
  formData.set("businessSlug", "venus-aura");
  return formData;
}

describe("storefront customization actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.vendorProfile.findFirst.mockResolvedValue({
      id: businessId,
      slug: "venus-aura",
      offerings: [{ id: serviceOneId }, { id: serviceTwoId }]
    });
    mocks.db.vendorProfile.update.mockResolvedValue({ id: businessId });
  });

  it("autosaves a storefront draft without redirecting away from the editor", async () => {
    const result = await autosaveStorefrontDraftAction(basePayload());

    expect(result.ok).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.db.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: businessId },
      data: {
        storefrontDraftJson: expect.objectContaining({
          aboutHeading: "Celebrations with feeling",
          hiddenOfferingIds: [serviceTwoId],
          hiddenSections: [],
          imageShape: "SOFT",
          palette: "DISCO",
          sectionLabels: { portfolio: "Our Work", faq: "Questions" },
          services: expect.arrayContaining([
            expect.objectContaining({ id: serviceOneId, active: true, featured: true }),
            expect.objectContaining({ id: serviceTwoId, active: false, featured: false })
          ])
        })
      }
    });
  });

  it("publishes storefront display settings without rewriting service records", async () => {
    const payload = basePayload();
    payload.intent = "publish";

    await expect(updateStorefrontCustomizationAction(formDataFromPayload(payload))).rejects.toThrow(
      "NEXT_REDIRECT:/vendor/business/venus-aura/storefront?published=1"
    );

    expect(mocks.db.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: businessId },
      data: expect.objectContaining({
        storefrontDraftJson: expect.anything(),
        storefrontFeaturedOfferingIds: [serviceOneId],
        storefrontHiddenOfferingIds: [serviceTwoId],
        storefrontImageShape: "SOFT",
        storefrontOfferingOrder: [serviceTwoId, serviceOneId],
        storefrontPalette: "DISCO",
        storefrontSectionLabels: { portfolio: "Our Work", faq: "Questions" },
        storefrontSectionOrder: ["hero", "portfolio", "all-services", "faq", "featured-services", "about", "how-it-works", "reviews", "final-quote"]
      })
    });
    expect(mocks.db.vendorProfile.update.mock.calls[0]?.[0]?.data).not.toHaveProperty("offerings");
  });
});
