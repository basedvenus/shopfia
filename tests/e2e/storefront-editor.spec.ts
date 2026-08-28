import { expect, test } from "@playwright/test";
import { PrismaClient, UserRole } from "@prisma/client";
import { encode } from "@auth/core/jwt";

const prisma = new PrismaClient();
const runId = `${Date.now()}`;
const baseUrl = "http://localhost:3000";
const email = `codex-storefront-e2e-${runId}@shopfia.test`;
const slug = `codex-storefront-e2e-${runId}`;
const username = `codex-storefront-${runId}`;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
let userId = "";

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.vendorProfile.deleteMany({ where: { slug } });

  const category = await prisma.category.upsert({
    where: { name: "E2E Storefront Styling" },
    update: {},
    create: {
      audience: "VENDOR",
      iconName: "Sparkles",
      name: "E2E Storefront Styling"
    }
  });
  const user = await prisma.user.create({
    data: {
      email,
      name: "Codex Storefront Vendor",
      role: UserRole.VENDOR,
      username
    }
  });
  userId = user.id;
  const vendor = await prisma.vendorProfile.create({
    data: {
      availabilityNotes: "Initial availability note.",
      bio: "Initial storefront bio for the authenticated editor audit.",
      city: "Fairfield",
      coverPhoto: "https://images.unsplash.com/photo-1519225421980-715cb0215aed",
      logoUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce",
      name: "Codex Storefront Studio",
      photos: [
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed",
        "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
        "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92"
      ],
      serviceAreaNotes: "Initial service area.",
      serviceRadiusMiles: 25,
      slug,
      startingPriceCents: 15000,
      state: "CA",
      storefrontFeaturedOfferingIds: [],
      storefrontTagline: "Initial tagline",
      verified: true,
      userId: user.id
    }
  });
  await prisma.offering.createMany({
    data: [
      {
        active: true,
        basePriceCents: 15000,
        categoryId: category.id,
        description: "A complete styling package used for storefront editor testing.",
        messageForPricing: false,
        photos: ["https://images.unsplash.com/photo-1519225421980-715cb0215aed"],
        slug: "full-party-styling",
        tags: ["e2e"],
        title: "Full Party Styling",
        turnaroundDays: 14,
        type: "SERVICE",
        vendorId: vendor.id
      },
      {
        active: true,
        basePriceCents: null,
        categoryId: category.id,
        description: "A custom balloon service used for storefront editor testing.",
        messageForPricing: true,
        photos: ["https://images.unsplash.com/photo-1530103862676-de8c9debad1d"],
        slug: "balloon-install",
        tags: ["e2e"],
        title: "Balloon Install",
        turnaroundDays: 7,
        type: "SERVICE",
        vendorId: vendor.id
      }
    ]
  });
});

test.afterAll(async () => {
  await prisma.vendorProfile.deleteMany({ where: { slug } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("vendor can edit, draft, publish, and view storefront changes", async ({ page }) => {
  expect(authSecret).toBeTruthy();
  const cookieName = "authjs.session-token";
  const sessionToken = await encode({
    maxAge: 30 * 24 * 60 * 60,
    salt: cookieName,
    secret: authSecret!,
    token: {
      email,
      name: "Codex Storefront Vendor",
      role: UserRole.VENDOR,
      sub: userId,
      username
    }
  });
  await page.context().addCookies([
    {
      httpOnly: true,
      name: cookieName,
      sameSite: "Lax",
      url: baseUrl,
      value: sessionToken
    }
  ]);

  const editorPath = `/vendor/business/${slug}/storefront`;
  const businessPath = `/vendor/business/${slug}`;
  const fixture = await prisma.vendorProfile.findFirst({
    where: { slug, userId },
    select: { id: true, slug: true, userId: true }
  });
  expect(fixture).toEqual(expect.objectContaining({ slug, userId }));

  await page.goto(`${baseUrl}${businessPath}`);
  await expect(page.getByRole("heading", { name: "Codex Storefront Studio" })).toBeVisible();

  await page.goto(`${baseUrl}${editorPath}`);
  await expect(page).toHaveURL(new RegExp(`${editorPath}$`));
  await expect(page.getByTestId("storefront-editor-shell")).toBeVisible();
  await expect(page.getByText("Storefront checklist")).toBeVisible();

  const heroPreview = page.getByTestId("preview-section-hero");
  await heroPreview.click();
  await heroPreview.getByLabel("Hero headline").fill("Browser-audited celebrations");
  await heroPreview.getByLabel("Hero supporting text").fill("Live editor changes should draft and publish cleanly.");
  await heroPreview.getByLabel("City").fill("Vacaville");
  await heroPreview.getByLabel("State").fill("CA");
  await expect(page.getByText("Unpublished changes").or(page.getByText("Draft autosaved"))).toBeVisible();

  await page.getByTestId("preview-section-all-services").click();
  await page.getByRole("button", { name: "Not featured" }).first().click();
  await page.getByRole("button", { name: "Down" }).first().click();

  await page.getByTestId("preview-section-faq").click();
  await page.getByRole("button", { name: "Add FAQ" }).first().click();
  await page.getByLabel("FAQ question").last().fill("Can I preview before publishing?");
  await page.getByLabel("FAQ answer").last().fill("Yes. Draft changes stay in the editor until publish.");

  await page.getByRole("button", { name: "Mobile" }).click();
  await expect(page.getByTestId("storefront-preview-frame")).toHaveCSS("max-width", "390px");
  await page.getByRole("button", { name: "Desktop" }).click();

  await page.getByTestId("storefront-section-reviews").getByText("Visible").click();
  await expect(page.getByTestId("storefront-section-reviews")).toContainText("Hidden");
  await page.getByTestId("storefront-section-reviews").getByText("Hidden").click();
  await expect(page.getByTestId("storefront-section-reviews")).toContainText("Visible");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/draft saved|draft autosaved/i).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { exact: true, name: "Publish" }).click();
  await expect(page).toHaveURL(new RegExp(`${editorPath}\\?published=1$`));
  await expect(page.getByText("Published")).toBeVisible();

  await page.goto(`${baseUrl}/${slug}`);
  await expect(page.getByRole("heading", { name: "Browser-audited celebrations" }).first()).toBeVisible();
  await expect(page.getByText("Live editor changes should draft and publish cleanly.").first()).toBeVisible();

  const savedVendor = await prisma.vendorProfile.findUnique({
    where: { slug },
    select: {
      city: true,
      storefrontDraftJson: true,
      storefrontFeaturedOfferingIds: true,
      storefrontHiddenSections: true,
      storefrontTagline: true
    }
  });
  expect(savedVendor?.city).toBe("Vacaville");
  expect(savedVendor?.storefrontDraftJson).toBeNull();
  expect(savedVendor?.storefrontFeaturedOfferingIds).toHaveLength(1);
  expect(savedVendor?.storefrontHiddenSections).not.toContain("reviews");
  expect(savedVendor?.storefrontTagline).toBe("Live editor changes should draft and publish cleanly.");
});
