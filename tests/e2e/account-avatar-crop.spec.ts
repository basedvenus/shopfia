import { expect, test } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import { PrismaClient, UserRole } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const runId = `${Date.now()}`;
const baseUrl = "http://localhost:3000";
const email = `codex-account-avatar-${runId}@shopfia.test`;
const username = `codex-account-avatar-${runId}`;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
let userId = "";

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: {
      email,
      image: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce",
      imageCrop: { x: 12, y: 88, zoom: 2 },
      name: "Codex Avatar Tester",
      role: UserRole.BUYER,
      username
    }
  });
  userId = user.id;
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("new personal profile photo starts from a fresh centered crop", async ({ page }) => {
  expect(authSecret).toBeTruthy();
  const cookieName = "authjs.session-token";
  const sessionToken = await encode({
    maxAge: 30 * 24 * 60 * 60,
    salt: cookieName,
    secret: authSecret!,
    token: {
      email,
      name: "Codex Avatar Tester",
      role: UserRole.BUYER,
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

  const imagePath = test.info().outputPath("account-avatar-upload.png");
  writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAIUlEQVR4nGNkaGD4z4AHMOKSAv2jUQMYcQkBAwMAAJa0BRUU/1RtAAAAAElFTkSuQmCC",
      "base64"
    )
  );

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Codex Avatar Tester" })).toBeVisible();
  await expect(page.locator('input[name="imageCrop"]')).toHaveValue(JSON.stringify({ x: 12, y: 88, zoom: 2 }));

  await page.locator('input[type="file"]').first().setInputFiles(imagePath);
  await expect(page.getByRole("heading", { name: "Position your image" })).toBeVisible();
  await expect(page.locator('input[name="imageCrop"]')).toHaveValue(JSON.stringify({ x: 50, y: 50, zoom: 1 }));

  await page.getByRole("button", { name: "Save positioning" }).click();
  await expect(page.getByText("Photo uploaded and saved.")).toBeVisible({ timeout: 10_000 });

  const savedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true, imageCrop: true }
  });
  expect(savedUser?.image).toMatch(/^\/api\/users\/.+\/avatar\?v=\d+$/);
  expect(savedUser?.imageCrop).toEqual({ x: 50, y: 50, zoom: 1 });
});
