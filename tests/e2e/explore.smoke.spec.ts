import { test, expect } from "@playwright/test";

test("explore page loads and shows heading", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /discover local vendors/i })).toBeVisible();
});

test("account page loads sign in panel for guests", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByText(/magic link/i)).toBeVisible();
});
