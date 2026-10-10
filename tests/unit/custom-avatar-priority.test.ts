import { describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getUserProfileImage } from "@/lib/profile-image";
import { serializeUserProfile, userProfileSelect } from "@/lib/user-profile";
import { ProfileProvider } from "@/components/account/profile-provider";
import { AccountMenu } from "@/components/layout/account-menu";
import { AccountProfileEditor } from "@/components/account/account-profile-editor";
import { CroppedImage } from "@/components/ui/cropped-image";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/app/actions/auth", () => ({ updateAccountProfileAction: vi.fn(), toggleFollowAction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/profile-badges", () => ({ getOriginalMemberCutoffDate: vi.fn(async () => null), getProfileBadges: vi.fn(() => []) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("not found"); } }));
import PublicProfilePage from "@/app/profiles/[username]/page";

const updatedAt = new Date("2026-10-01T12:00:00Z");
const uploadedUrl = `/api/users/user_1/avatar?v=${updatedAt.getTime()}`;
const googleUrl = "https://lh3.googleusercontent.com/provider-picture";
function savedUser() {
  return { id: "user_1", avatar: { updatedAt }, email: "existing@example.com", name: "Existing", username: "saved", image: googleUrl, imageCrop: { x: 20, y: 60, zoom: 2 }, role: "BUYER" as const, bio: null, instagramUrl: null, partyfulUrl: null, tiktokUrl: null, vendorProfile: null };
}
function elements(node: ReactNode): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

describe("saved custom avatar priority", () => {
  it("uses the same user's saved upload instead of a stale Google URL", () => {
    expect(getUserProfileImage(savedUser())).toBe(uploadedUrl);
  });
  it("recovers the upload reference read-only even when the image string was cleared", () => {
    expect(getUserProfileImage({ ...savedUser(), image: null })).toBe(uploadedUrl);
  });
  it("does not invent an upload when there is no persisted avatar", () => {
    expect(getUserProfileImage({ ...savedUser(), avatar: null })).toBe(googleUrl);
    expect(getUserProfileImage({ ...savedUser(), avatar: null, image: null })).toBeNull();
  });
  it("keeps an existing custom URL when there is no stored byte record", () => {
    expect(getUserProfileImage({ ...savedUser(), avatar: null, image: "https://res.cloudinary.com/existing/custom.jpg" })).toBe("https://res.cloudinary.com/existing/custom.jpg");
  });
  it("versions the served URL when uploaded bytes change so caches cannot keep the old photo", () => {
    const later = new Date(updatedAt.getTime() + 1000);
    expect(getUserProfileImage({ ...savedUser(), avatar: { updatedAt: later } })).toBe(`/api/users/user_1/avatar?v=${later.getTime()}`);
  });
  it("selects only upload metadata and does not send it or any image bytes to the client", () => {
    expect(userProfileSelect.avatar).toEqual({ select: { updatedAt: true } });
    const serialized = serializeUserProfile(savedUser());
    expect(serialized.image).toBe(uploadedUrl);
    expect(serialized.imageCrop).toEqual({ x: 20, y: 60, zoom: 2 });
    expect(serialized).not.toHaveProperty("avatar");
    expect(serialized).not.toHaveProperty("data");
    expect(savedUser().image).toBe(googleUrl);
  });
  it("renders the same custom upload in the navbar and account editor", () => {
    const serialized = serializeUserProfile(savedUser());
    const html = renderToStaticMarkup(createElement(ProfileProvider, { initialProfile: serialized },
      createElement(AccountMenu, { initials: "EX", signOutAction: async () => {} }),
      createElement(AccountProfileEditor, { displayName: "Existing", handle: "@saved", initials: "EX", signOutAction: async () => {} })
    ));
    expect(html).toContain(uploadedUrl.replace(/&/g, "&amp;"));
    expect(html).not.toContain(googleUrl);
  });
  it("renders the saved custom photo and crop on the public profile", async () => {
    mocks.findUnique.mockResolvedValue({ ...savedUser(), createdAt: updatedAt, managedBusinesses: [], partyEvents: [], partyCollaborations: [], _count: { followers: 0, following: 0 } });
    const nodes = elements(await PublicProfilePage({ params: Promise.resolve({ username: "saved" }) }));
    const avatar = nodes.find((node) => node.type === CroppedImage && node.props.alt === "Existing");
    expect(avatar?.props.src).toBe(uploadedUrl);
    expect(avatar?.props.crop).toEqual({ x: 20, y: 60, zoom: 2 });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { username: "saved" }, select: expect.objectContaining({ avatar: { select: { updatedAt: true } } }) }));
  });
});
