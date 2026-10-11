import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signOut: vi.fn(),
  db: {
    user: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn() },
    quoteRequest: { findMany: vi.fn() },
    favorite: { count: vi.fn() },
    conversation: { count: vi.fn() }
  },
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); })
}));
vi.mock("@/auth", () => ({ auth: mocks.auth, signOut: mocks.signOut }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));

import { completeRequiredProfileAction } from "@/app/actions/auth";
import SetupPage from "@/app/account/setup/page";
import AccountPage from "@/app/account/page";
import { RequiredProfileForm } from "@/components/account/required-profile-form";
import { AccountRecovery } from "@/components/account/account-recovery";

function profile(overrides = {}) {
  return { id: "user_1", email: "existing@example.com", name: "Existing Name", username: "saved-handle", image: "/api/users/user_1/avatar?v=1", imageCrop: { x: 20, y: 60, zoom: 2 }, role: "BUYER", bio: null, instagramUrl: null, partyfulUrl: null, tiktokUrl: null, vendorProfile: null, ...overrides };
}
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ profileId: "user_1", isVendor: "no", name: "New Name", username: "new-handle", image: "", imageCrop: '{"x":50,"y":50,"zoom":1}', ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}
function elements(node: ReactNode): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user_1", email: "existing@example.com" } });
  mocks.db.user.findUnique.mockResolvedValue(profile());
  mocks.db.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.order.findMany.mockResolvedValue([]);
  mocks.db.quoteRequest.findMany.mockResolvedValue([]);
  mocks.db.favorite.count.mockResolvedValue(0);
  mocks.db.conversation.count.mockResolvedValue(0);
});

describe("safe onboarding completion", () => {
  it("returns an existing profile unchanged even for an invalid stale submission", async () => {
    const result = await completeRequiredProfileAction(form({ username: "!", name: "" }));
    expect(result).toMatchObject({ ok: true, profile: profile() });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });
  it("preserves a saved username and photo when only display name is missing", async () => {
    const saved = profile({ name: null });
    mocks.db.user.findUnique.mockResolvedValueOnce(saved).mockResolvedValueOnce(profile({ name: "New Name" }));
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: true });
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({ where: { id: "user_1", name: null, username: "saved-handle" }, data: { name: "New Name" } });
  });
  it("preserves an existing name and image crop when only username is missing", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(profile({ username: null })).mockResolvedValueOnce(profile({ username: "new-handle" }));
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: true });
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({ where: { id: "user_1", name: "Existing Name", username: null }, data: { username: "new-handle" } });
  });
  it("keeps the saved winner when another tab completes onboarding first", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(profile({ name: null, username: null })).mockResolvedValueOnce(profile({ name: "Other tab", username: "other-tab" }));
    mocks.db.user.updateMany.mockResolvedValue({ count: 0 });
    const result = await completeRequiredProfileAction(form());
    expect(result).toMatchObject({ ok: true, profile: { name: "Other tab", username: "other-tab" } });
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({ where: { id: "user_1", name: null, username: null }, data: { name: "New Name", username: "new-handle" } });
  });
  it("rejects an old form after the signed-in account changes", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user_2" } });
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: false, error: expect.stringContaining("account changed") });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: false });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
  it("does not create a profile when the session has no matching database user", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: false, error: expect.stringContaining("could not be loaded") });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it("validates required identity for a genuinely new user", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ name: null, username: null }));
    expect(await completeRequiredProfileAction(form({ username: "!" }))).toMatchObject({ ok: false });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it("saves a first-time buyer's personal identity then goes straight to Explore", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(profile({ name: null, username: null })).mockResolvedValueOnce(profile());
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: true, nextPath: "/explore" });
  });
  it("validates personal identity before continuing a new vendor to separate storefront setup", async () => {
    mocks.db.user.findUnique.mockResolvedValueOnce(profile({ name: null, username: null })).mockResolvedValueOnce(profile());
    const result = await completeRequiredProfileAction(form({ isVendor: "yes", storefrontName: "Venus & Aura" }));
    expect(result).toMatchObject({ ok: true, nextPath: "/onboarding?newBusiness=1&storefrontName=Venus+%26+Aura#profile" });
    expect(mocks.db.user.updateMany.mock.calls[0][0].data).toEqual({ name: "New Name", username: "new-handle" });
  });
  it("does not save partial identity when the vendor name is missing", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ name: null, username: null }));
    expect(await completeRequiredProfileAction(form({ isVendor: "yes", storefrontName: "" }))).toMatchObject({ ok: false });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it("skips onboarding choices for an already-complete account without modifying it", async () => {
    expect(await completeRequiredProfileAction(form({ isVendor: "yes", storefrontName: "" }))).toMatchObject({ ok: true, nextPath: "/account" });
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it("only reports username collision for a unique constraint failure", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ username: null }));
    mocks.db.user.updateMany.mockRejectedValueOnce({ code: "P2002" });
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: false, error: expect.stringContaining("already taken") });
    mocks.db.user.updateMany.mockRejectedValueOnce(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await completeRequiredProfileAction(form())).toMatchObject({ ok: false, error: expect.stringContaining("could not be saved") });
    log.mockRestore();
  });
});

describe("setup and account reads", () => {
  it.each([{ username: null }, { name: null }, { name: null, username: null }])(
    "allows Account navigation with missing fields without writing replacements: %j", async (missing) => {
      mocks.db.user.findUnique.mockResolvedValue(profile(missing));
      const nodes = elements(await AccountPage({}));
      expect(nodes.some((node) => node.props.href === "/messages")).toBe(true);
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.db.user.update).not.toHaveBeenCalled();
      expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
    }
  );
  it("provides setup-later links alongside the new-user form without a write", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ username: null, name: null }));
    const nodes = elements(await SetupPage());
    expect(nodes.some((node) => node.type === RequiredProfileForm)).toBe(true);
    expect(nodes.some((node) => node.props.href === "/explore")).toBe(true);
    expect(nodes.some((node) => node.props.href === "/account")).toBe(true);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it("does not present an empty replacement dashboard for a missing account row", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    const nodes = elements(await AccountPage({}));
    expect(nodes.some((node) => node.type === AccountRecovery)).toBe(true);
    expect(nodes.some((node) => node.props.href === "/messages")).toBe(false);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("still requires authentication for setup and shows sign-in for Account", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/account");
    await AccountPage({});
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
  it("redirects complete accounts instead of offering new setup", async () => {
    await expect(SetupPage()).rejects.toThrow("NEXT_REDIRECT:/account");
  });
  it("shows recovery without a creation form when a user row is missing", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    const nodes = elements(await SetupPage());
    expect(nodes.some((node) => node.type === RequiredProfileForm)).toBe(false);
    expect(nodes.find((node) => node.type === AccountRecovery)?.props.email).toBe("existing@example.com");
  });
  it("shows recovery instead of new setup during a database failure", async () => {
    mocks.db.user.findUnique.mockRejectedValueOnce(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const nodes = elements(await SetupPage());
    expect(nodes.some((node) => node.type === RequiredProfileForm)).toBe(false);
    log.mockRestore();
  });
  it("shows only the current authenticated user's email and preserves saved form defaults", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ username: null }));
    const nodes = elements(await SetupPage());
    expect(mocks.db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user_1" } }));
    expect(nodes.find((node) => node.type === AccountRecovery)?.props.email).toBe("existing@example.com");
    expect(nodes.find((node) => node.type === RequiredProfileForm)?.props).toMatchObject({ profileId: "user_1", defaultDisplayName: "Existing Name", defaultImage: "/api/users/user_1/avatar?v=1", defaultUsername: null });
  });
  it("changes login only when the recovery form is submitted", async () => {
    const nodes = elements(AccountRecovery({ email: "existing@example.com" }));
    expect(mocks.signOut).not.toHaveBeenCalled();
    const action = nodes.find((node) => node.type === "form")?.props.action as () => Promise<void>;
    await action();
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/account" });
  });
  it("prefills the saved custom upload instead of a stale Google photo", async () => {
    const updatedAt = new Date("2026-10-01T12:00:00Z");
    mocks.db.user.findUnique.mockResolvedValue(profile({ username: null, avatar: { updatedAt } }));
    const nodes = elements(await SetupPage());
    expect(nodes.find((node) => node.type === RequiredProfileForm)?.props.defaultImage).toBe(`/api/users/user_1/avatar?v=${updatedAt.getTime()}`);
  });
  it("does not delete a stored legacy image when opening the account page", async () => {
    mocks.db.user.findUnique.mockResolvedValue(profile({ image: "data:image/png;base64,legacy" }));
    await AccountPage({});
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
});
