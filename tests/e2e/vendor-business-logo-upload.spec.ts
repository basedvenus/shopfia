import { expect, test } from "@playwright/test";
import { PrismaClient, UserRole } from "@prisma/client";
import { encode } from "@auth/core/jwt";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const runId = `${Date.now()}`;
const baseUrl = "http://localhost:3000";
const email = `codex-vendor-logo-e2e-${runId}@shopfia.test`;
const slug = `codex-vendor-logo-e2e-${runId}`;
const username = `codex-vendor-logo-${runId}`;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
let userId = "";

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.vendorProfile.deleteMany({ where: { slug } });

  const user = await prisma.user.create({
    data: {
      email,
      name: "Codex Logo Vendor",
      role: UserRole.VENDOR,
      username
    }
  });
  userId = user.id;

  await prisma.vendorProfile.create({
    data: {
      bio: "A vendor profile used for logo upload testing.",
      city: "Fairfield",
      logoUrl: null,
      name: "Codex Logo Studio",
      photos: [],
      serviceRadiusMiles: 25,
      slug,
      state: "CA",
      userId: user.id
    }
  });
});

test.afterAll(async () => {
  await prisma.vendorProfile.deleteMany({ where: { slug } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("existing vendor setup saves uploaded logo to the business profile", async ({ page }) => {
  expect(authSecret).toBeTruthy();
  const cookieName = "authjs.session-token";
  const sessionToken = await encode({
    maxAge: 30 * 24 * 60 * 60,
    salt: cookieName,
    secret: authSecret!,
    token: {
      email,
      name: "Codex Logo Vendor",
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

  const imagePath = test.info().outputPath("vendor-logo-upload.png");
  writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAIUlEQVR4nGNkaGD4z4AHMOKSAv2jUQMYcQkBAwMAAJa0BRUU/1RtAAAAAElFTkSuQmCC",
      "base64"
    )
  );

  await page.goto(`${baseUrl}/onboarding?business=${slug}#profile`);
  await expect(page.getByRole("heading", { name: "Build your beautiful ShopFia storefront." })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles(imagePath);
  await page.getByRole("button", { name: "Save positioning" }).click();
  await expect(page.getByText("Photo uploaded and saved.").first()).toBeVisible({ timeout: 10_000 });

  const savedVendor = await prisma.vendorProfile.findUnique({
    where: { slug },
    select: { logoUrl: true }
  });
  expect(savedVendor?.logoUrl).toMatch(/^\/api\/vendor-media\/.+\?v=\d+$/);

  await page.goto(`${baseUrl}/vendor/dashboard`);
  const logo = page.getByRole("img", { name: "Codex Logo Studio logo" });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", savedVendor!.logoUrl!);
});
