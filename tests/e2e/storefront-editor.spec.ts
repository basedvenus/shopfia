import { expect, test } from "@playwright/test";
import { PrismaClient, UserRole } from "@prisma/client";
import { encode } from "@auth/core/jwt";
import { writeFileSync } from "node:fs";

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
  const editorPanel = page.locator("aside").last();
  await editorPanel.getByRole("button", { name: "Collapse" }).nth(1).click();
  await expect(editorPanel.getByRole("button", { name: "Expand" })).toBeVisible();
  await editorPanel.getByRole("button", { name: "Expand" }).click();
  await editorPanel.getByRole("button", { name: "Up" }).last().click();

  await page.getByRole("button", { name: "Mobile" }).click();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByTestId("storefront-preview-frame")).toHaveCSS("max-width", "390px");
  await expect(page.getByText("Checklist", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Desktop" }).click();

  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("button", { name: /Citrus/ }).click();
  await page.getByLabel("Font pairing").selectOption("BOLD");
  await page.getByRole("button", { exact: true, name: "Light" }).click();
  await page.getByRole("button", { exact: true, name: "Square" }).click();
  await expect(page.getByText("Live theme sample")).toBeVisible();

  await editorPanel.getByRole("button", { name: "Collapse" }).first().click();
  await expect(editorPanel.getByRole("button", { name: "Edit" })).toBeVisible();
  await editorPanel.getByRole("button", { name: "Edit" }).click();

  await page.getByTestId("storefront-section-reviews").getByText("Visible").click();
  await expect(page.getByTestId("storefront-section-reviews")).toContainText("Hidden");
  await page.getByTestId("storefront-section-reviews").getByText("Hidden").click();
  await expect(page.getByTestId("storefront-section-reviews")).toContainText("Visible");
  await page.getByTestId("storefront-section-portfolio").dragTo(page.getByTestId("storefront-section-all-services"));
  await expect(page.getByTestId("storefront-section-all-services")).toBeVisible();

  const imagePath = test.info().outputPath("portfolio-upload.png");
  writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGElEQVR4nGP8z8AARLJgwiM3gqUBAQBNDgQH9cz5PwAAAABJRU5ErkJggg==",
      "base64"
    )
  );
  const portfolioPreview = page.getByTestId("preview-section-portfolio");
  await portfolioPreview.click();
  await portfolioPreview.locator('input[type="file"]').first().setInputFiles(imagePath);
  await page.getByRole("button", { name: "Save positioning" }).click();
  await expect(portfolioPreview.getByText(/photo uploaded/i).first()).toBeVisible({ timeout: 10_000 });

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
      photos: true,
      storefrontDraftJson: true,
      storefrontFeaturedOfferingIds: true,
      storefrontFontStyle: true,
      storefrontHiddenSections: true,
      storefrontImageShape: true,
      storefrontPalette: true,
      storefrontSectionOrder: true,
      storefrontTagline: true
    }
  });
  expect(savedVendor?.city).toBe("Vacaville");
  expect(savedVendor?.photos.length).toBeGreaterThanOrEqual(4);
  expect(savedVendor?.storefrontDraftJson).toBeNull();
  expect(savedVendor?.storefrontFeaturedOfferingIds).toHaveLength(1);
  expect(savedVendor?.storefrontFontStyle).toBe("BOLD");
  expect(savedVendor?.storefrontHiddenSections).not.toContain("reviews");
  expect(savedVendor?.storefrontImageShape).toBe("SQUARE");
  expect(savedVendor?.storefrontPalette).toBe("CITRUS");
  expect(savedVendor?.storefrontSectionOrder[2]).toBe("portfolio");
  expect(savedVendor?.storefrontSectionOrder[3]).toBe("all-services");
  expect(savedVendor?.storefrontTagline).toBe("Live editor changes should draft and publish cleanly.");
});
