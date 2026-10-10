import { describe, expect, it } from "vitest";
import { getAccountSetupDestination } from "@/lib/account-setup";
import { getSafeProfileImage, getUserProfileImage } from "@/lib/profile-image";
import { publicUserProfile } from "@/lib/public-user-profile";
function form(isVendor?: string, storefrontName?: string) {
 const data = new FormData();
 if (isVendor !== undefined) data.set("isVendor", isVendor);
 if (storefrontName !== undefined) data.set("storefrontName", storefrontName);
 return data;
}
describe("personal profile and storefront choice", () => {
 it("takes a non-vendor to Explore without starting a storefront", () => {
  expect(getAccountSetupDestination(form("no", "Ignored store"))).toEqual({ ok: true, nextPath: "/explore" });
 });
 it("passes a vendor's public business name to the separate setup form", () => {
  const result = getAccountSetupDestination(form("yes", "  Venus & Aura  "));
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error("expected success");
  const url = new URL(result.nextPath, "https://www.shopfia.app");
  expect(url.pathname).toBe("/onboarding");
  expect(url.searchParams.get("newBusiness")).toBe("1");
  expect(url.searchParams.get("storefrontName")).toBe("Venus & Aura");
 });
 it("requires an explicit Yes/No choice", () => {
  expect(getAccountSetupDestination(form())).toMatchObject({ ok: false });
 });
 it("requires a name only for a vendor and rejects oversized names", () => {
  expect(getAccountSetupDestination(form("yes", ""))).toMatchObject({ ok: false });
  expect(getAccountSetupDestination(form("yes", "x".repeat(81)))).toMatchObject({ ok: false });
  expect(getAccountSetupDestination(form("no"))).toMatchObject({ ok: true });
 });
 it("keeps untrusted business names encoded within the same-site setup URL", () => {
  const result = getAccountSetupDestination(form("yes", "//evil.test/?x=1&name=other"));
  if (!result.ok) throw new Error("expected success");
  expect(new URL(result.nextPath,"https://www.shopfia.app").origin).toBe("https://www.shopfia.app");
 });
});
describe("user-selected profile photos only", () => {
 it.each(["https://lh3.googleusercontent.com/picture", "https://lh4.googleusercontent.com/picture", "//lh3.googleusercontent.com/picture"])("hides an imported Google photo without altering stored data: %s", (image) => {
  expect(getSafeProfileImage(image)).toBeNull();
  expect(publicUserProfile({ id: "user_1", image, name: "User", username: "user" })?.image).toBeNull();
 });
 it("preserves uploaded local and legacy custom-hosted images", () => {
  expect(getSafeProfileImage("/api/users/user_1/avatar?v=1")).toBe("/api/users/user_1/avatar?v=1");
  expect(getSafeProfileImage("https://res.cloudinary.com/custom/profile.jpg")).toBe("https://res.cloudinary.com/custom/profile.jpg");
 });
 it("keeps a saved uploaded image even if a provider URL remains on the record", () => {
  const record = { id: "user_1", image: "https://lh3.googleusercontent.com/picture", avatar: { updatedAt: new Date(1000) } };
  expect(getUserProfileImage(record)).toBe("/api/users/user_1/avatar?v=1000");
  expect(record.image).toContain("googleusercontent.com");
 });
});
