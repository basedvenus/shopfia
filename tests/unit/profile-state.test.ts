import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useLayoutEffect, type ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ProfileProvider, useProfile } from "@/components/account/profile-provider";
import { ProfileImage } from "@/components/account/profile-image";
import { RequiredProfileGate } from "@/components/account/required-profile-gate";
import { RequiredProfileForm } from "@/components/account/required-profile-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { SharedUserProfile } from "@/lib/user-profile";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), complete: vi.fn(), path: "/explore" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useRouter: () => mocks }));
vi.mock("@/app/actions/auth", () => ({ completeRequiredProfileAction: mocks.complete }));

function profile(overrides = {}): SharedUserProfile {
  return { id: "user_1", email: "existing@example.com", name: "Existing", username: "saved", image: "/saved.jpg", imageCrop: null, role: "BUYER", bio: null, instagramUrl: null, partyfulUrl: null, tiktokUrl: null, vendorProfile: null, ...overrides };
}
let current: ReturnType<typeof useProfile>;
function Probe() { const value = useProfile(); useLayoutEffect(() => { current = value; }); return null; }
const roots: ReactTestRenderer[] = [];
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); vi.clearAllMocks(); mocks.path = "/explore"; });
function mount(initialProfile: SharedUserProfile | null, extra?: React.ReactNode) {
  let root!: ReactTestRenderer;
  act(() => { root = create(createElement(ProfileProvider, { initialProfile }, createElement(Probe), extra)); });
  roots.push(root);
  return root;
}
function refresh(root: ReactTestRenderer, initialProfile: SharedUserProfile | null, extra?: React.ReactNode) {
  act(() => { root.update(createElement(ProfileProvider, { initialProfile }, createElement(Probe), extra)); });
}

describe("profile state reconciliation", () => {
  it("uses a refreshed same-user snapshot before the gate can redirect on stale data", () => {
    mocks.path = "/account/setup";
    const root = mount(profile({ username: null }), createElement(RequiredProfileGate, { key: "gate" }));
    mocks.path = "/explore";
    refresh(root, profile(), createElement(RequiredProfileGate, { key: "gate" }));
    expect(current.profile?.username).toBe("saved");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("replaces the previous profile on account change and clears it on sign-out", () => {
    const root = mount(profile());
    refresh(root, profile({ id: "user_2", username: "other", image: "/other.jpg" }));
    expect(current.profile).toMatchObject({ id: "user_2", username: "other", image: "/other.jpg" });
    refresh(root, null);
    expect(current.profile).toBeNull();
  });
  it("keeps local profile changes while the server snapshot stays unchanged", () => {
    const original = profile();
    const root = mount(original);
    act(() => current.setProfile(profile({ username: "updated" })));
    refresh(root, original);
    expect(current.profile?.username).toBe("updated");
  });
  it("ignores delayed avatar updates for another account", () => {
    const root = mount(profile());
    const updateBeforeSwitch = current.updateProfile;
    refresh(root, profile({ id: "user_2", image: "/other.jpg" }));
    act(() => updateBeforeSwitch({ image: "/old-upload.jpg" }, "user_1"));
    expect(current.profile?.image).toBe("/other.jpg");
  });
  it("a delayed avatar snapshot cannot remove a newly saved username", () => {
    const root = mount(profile({ username: null }), createElement(RequiredProfileForm, { key: "form", profileId: "user_1" }));
    const upload = root.root.findByType(ImageUploadField).props.onUploadComplete;
    act(() => current.setProfile(profile({ username: "completed" })));
    act(() => upload({ profile: profile({ username: null, image: "/uploaded.jpg" }) }));
    expect(current.profile).toMatchObject({ username: "completed", image: "/uploaded.jpg" });
  });
  it.each([{ username: null }, { name: null }, { name: null, username: null }])(
    "offers setup without redirecting incomplete profiles: %j", (missing) => {
      const original = profile(missing);
      const root = mount(original, createElement(RequiredProfileGate));
      expect(JSON.stringify(root.toJSON())).toContain("Your profile is missing");
      expect(root.root.findAllByType("a").map((link) => link.props.href)).toEqual([
        "/account/setup", "/account/setup#account-recovery"
      ]);
      expect(current.profile).toEqual(original);
      expect(mocks.replace).not.toHaveBeenCalled();
    }
  );
  it("keeps navigation available across tabs, Back, and a refreshed incomplete snapshot", () => {
    const root = mount(profile({ username: null }), createElement(RequiredProfileGate));
    for (const path of ["/account/setup", "/explore", "/messages", "/my-parties", "/account", "/explore", "/account/setup", "/explore"]) {
      mocks.path = path;
      refresh(root, profile({ username: null }), createElement(RequiredProfileGate));
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(root.root.findAllByType("aside")).toHaveLength(path === "/account/setup" ? 0 : 1);
    }
    act(() => root.unmount());
    const reloaded = mount(profile({ username: null }), createElement(RequiredProfileGate));
    expect(reloaded.root.findAllByType("aside")).toHaveLength(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("reconciles notices when completing setup, signing out, or switching accounts", () => {
    const root = mount(profile({ username: null }), createElement(RequiredProfileGate));
    act(() => current.updateProfile({ username: "completed" }, "user_1"));
    expect(root.toJSON()).toBeNull();
    refresh(root, null, createElement(RequiredProfileGate));
    expect(root.toJSON()).toBeNull();
    refresh(root, profile({ id: "user_2", name: null }), createElement(RequiredProfileGate));
    expect(root.root.findAllByType("aside")).toHaveLength(1);
    refresh(root, profile({ id: "user_3" }), createElement(RequiredProfileGate));
    expect(root.toJSON()).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("does not apply an old completion response to a different signed-in account", async () => {
    let finish!: (result: { ok: boolean; profile: SharedUserProfile }) => void;
    const response = new Promise<{ ok: boolean; profile: SharedUserProfile }>((resolve) => { finish = resolve; });
    mocks.complete.mockReturnValue(response);
    const root = mount(profile({ username: null }), createElement(RequiredProfileForm, { profileId: "user_1" }));
    act(() => root.root.findByType("form").props.action(new FormData()));
    refresh(root, profile({ id: "user_2", username: "other" }));
    await act(async () => { finish({ ok: true, profile: profile() }); await response; });
    expect(current.profile).toMatchObject({ id: "user_2", username: "other" });
  });
});

describe("unavailable photo presentation", () => {
  it("shows initials instead of an imported Google profile photo", () => {
    let root!: ReactTestRenderer;
    act(() => { root = create(createElement(ProfileImage, { image: "https://lh3.googleusercontent.com/provider", initials: "EN" })); });
    roots.push(root);
    expect(root.root.findAllByType(CroppedImage)).toHaveLength(0);
    expect(root.toJSON()).toMatchObject({ type: "span", children: ["EN"] });
  });
  it("shows initials when an image fails and attempts a replacement URL", () => {
    let root!: ReactTestRenderer;
    act(() => { root = create(createElement(ProfileImage, { image: "/broken.jpg", initials: "EN" })); });
    roots.push(root);
    act(() => root.root.findByType(CroppedImage).props.onError());
    expect(root.toJSON()).toMatchObject({ type: "span", props: { "aria-label": "Profile photo unavailable" }, children: ["EN"] });
    act(() => root.update(createElement(ProfileImage, { image: "/new.jpg", initials: "EN" })));
    expect(root.root.findByType(CroppedImage).props.src).toBe("/new.jpg");
  });
  it("keeps the saved image value when the upload preview fails", () => {
    let root!: ReactTestRenderer;
    act(() => { root = create(createElement(ImageUploadField, { name: "image", label: "Profile photo", value: "/saved.jpg" })); });
    roots.push(root);
    act(() => root.root.findByType(CroppedImage).props.onError());
    expect(root.root.findAllByType("input").find((input) => input.props.name === "image")?.props.value).toBe("/saved.jpg");
    expect(JSON.stringify(root.toJSON())).toContain("Your saved photo has not been changed");
  });
});

describe("personal and vendor setup form", () => {
  it("shows a separate storefront name only for Yes and keeps it when toggling", () => {
    const root = mount(profile({ username: null }), createElement(RequiredProfileForm, { profileId: "user_1" }));
    const inputs = () => root.root.findAllByType("input");
    expect(inputs().find((input) => input.props.name === "name")?.props.readOnly).toBe(true);
    expect(JSON.stringify(root.toJSON())).toContain("you can edit them later in Account settings");
    expect(inputs().filter((input) => input.props.name === "storefrontName")).toHaveLength(0);
    act(() => inputs().find((input) => input.props.name === "isVendor" && input.props.value === "yes")?.props.onChange());
    const field = inputs().find((input) => input.props.name === "storefrontName");
    expect(field?.props.required).toBe(true);
    act(() => field?.props.onChange({ target: { value: "Venus & Aura" } }));
    act(() => inputs().find((input) => input.props.name === "isVendor" && input.props.value === "no")?.props.onChange());
    expect(inputs().filter((input) => input.props.name === "storefrontName")).toHaveLength(0);
    act(() => inputs().find((input) => input.props.name === "isVendor" && input.props.value === "yes")?.props.onChange());
    expect(inputs().find((input) => input.props.name === "storefrontName")?.props.value).toBe("Venus & Aura");
    expect(JSON.stringify(root.toJSON())).toContain("separate storefront URL");
  });
});
