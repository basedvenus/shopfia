import { test, expect } from "@playwright/test";

test("explore page loads and shows heading", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /discover local vendors/i })).toBeVisible();
});

test("account page loads sign in panel for guests", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Sign in to ShopFia" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});
