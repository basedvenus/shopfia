import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/actions/vendor", () => ({ updateUnclaimedVendorSocialsAction: mocks.save }));
import { UnclaimedVendorSocialEditor } from "@/components/parties/unclaimed-vendor-social-editor";
import type { VendorOption } from "@/components/parties/party-event-form";
const vendor: VendorOption = { id: "vendor", name: "Q Star", username: null, city: "Fairfield", state: "CA", logoUrl: null, status: "UNCLAIMED", instagramUrl: "https://www.instagram.com/qstar/", tiktokUrl: null, website: null };
beforeEach(() => vi.clearAllMocks());
const buttons = (view: ReactTestRenderer) => view.root.findAllByType("button");
describe("unclaimed vendor social editor", () => {
  it("prefills usernames, saves links, and confirms the public profile update", async () => {
    const onSaved = vi.fn();
    const socials = { instagramUrl: vendor.instagramUrl!, tiktokUrl: "https://www.tiktok.com/@qstar/", website: null };
    mocks.save.mockResolvedValue({ ok: true, socials });
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(UnclaimedVendorSocialEditor, { vendor, photoId: "photo", onSaved })); });
    act(() => buttons(view)[0].props.onClick());
    expect(view.root.findAllByType("input")[0].props.value).toBe("qstar");
    act(() => view.root.findAllByType("input")[1].props.onChange({ target: { value: "@qstar" } }));
    await act(async () => buttons(view).find((button) => button.props.children === "Save social links")!.props.onClick());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ vendorId: "vendor", photoId: "photo", instagram: "qstar", tiktok: "@qstar", original: { instagramUrl: vendor.instagramUrl, tiktokUrl: null, website: null } }));
    expect(onSaved).toHaveBeenCalledWith(socials);
    expect(view.root.findByProps({ role: "status" }).children.join("")).toContain("updated");
    expect(buttons(view)[0].props["aria-expanded"]).toBe(false);
    act(() => view.unmount());
  });
  it("keeps edits when the server rejects a claim race or stale links", async () => {
    mocks.save.mockResolvedValue({ ok: false, error: "This profile changed or was claimed." });
    const onSaved = vi.fn();
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(UnclaimedVendorSocialEditor, { vendor, photoId: "photo", onSaved })); });
    act(() => buttons(view)[0].props.onClick());
    act(() => view.root.findAllByType("input")[0].props.onChange({ target: { value: "newname" } }));
    await act(async () => buttons(view).find((button) => button.props.children === "Save social links")!.props.onClick());
    expect(view.root.findByProps({ role: "alert" }).children.join("")).toContain("claimed");
    expect(view.root.findAllByType("input")[0].props.value).toBe("newname");
    expect(onSaved).not.toHaveBeenCalled();
    act(() => view.unmount());
  });
  it.each(["CLAIMED", "VERIFIED"] as const)("hides community editing for %s profiles", (status) => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(UnclaimedVendorSocialEditor, { vendor: { ...vendor, status }, photoId: "photo", onSaved: vi.fn() })); });
    expect(view.toJSON()).toBeNull();
    act(() => view.unmount());
  });
});
