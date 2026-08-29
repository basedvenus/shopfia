import { expect, test } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const runId = `${Date.now()}`;
const baseUrl = "http://localhost:3000";
const email = `codex-my-parties-layout-${runId}@shopfia.test`;
const username = `codex-my-parties-layout-${runId}`;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
let userId = "";

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: {
      email,
      name: "Codex My Parties",
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

test("add-party form stays inside its card on desktop", async ({ page }) => {
  expect(authSecret).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 900 });

  const cookieName = "authjs.session-token";
  const sessionToken = await encode({
    maxAge: 30 * 24 * 60 * 60,
    salt: cookieName,
    secret: authSecret!,
    token: {
      email,
      name: "Codex My Parties",
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

  await page.goto("/my-parties");
  const panel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Add Party" }) });
  await expect(panel).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);

  const panelBox = await panel.boundingBox();
  expect(panelBox).toBeTruthy();
  const fields = page.locator(
    'input[placeholder="Theme, e.g. Citrus baby shower"], input[placeholder="Public Partyful invite URL"], input[placeholder="Venue, address, city, or neighborhood"], textarea[name="description"], select'
  );
  const count = await fields.count();
  for (let index = 0; index < count; index += 1) {
    const fieldBox = await fields.nth(index).boundingBox();
    expect(fieldBox).toBeTruthy();
    expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
  }
});
