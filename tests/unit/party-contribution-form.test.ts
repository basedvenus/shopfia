import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
const mocks = vi.hoisted(() => ({ submit: vi.fn(), refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/party-contributions", () => ({ submitPartyContributionAction: mocks.submit, reviewPartyContributionAction: vi.fn() }));
import { PartyContributionForm } from "@/components/parties/party-contribution-form";
let view: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:${Math.random()}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ photo: { id: "photo-upload" } }) });
  mocks.submit.mockResolvedValue({ ok: true });
  act(() => { view = create(createElement(PartyContributionForm, { eventId: "party" })); });
});
afterEach(() => { act(() => view.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const file = (name = "memory.jpg", type = "image/jpeg") => new File(["photo"], name, { type });
const drop = (files: File[]) => act(() => view.root.findByProps({ "aria-label": "Add guest photos by dropping files or choosing photos" }).props.onDrop({ preventDefault() {}, dataTransfer: { files } }));
describe("guest memory composer", () => {
  it("supports dropping, previewing, and removing photos before sending", () => {
    drop([file("first.jpg"), file("second.jpg")]);
    expect(view.root.findAllByType("img")).toHaveLength(3);
    act(() => view.root.findByProps({ "aria-label": "Preview second.jpg" }).props.onClick());
    expect(view.root.findByProps({ alt: "Preview of second.jpg" })).toBeDefined();
    act(() => view.root.findByProps({ "aria-label": "Remove second.jpg" }).props.onClick());
    expect(view.root.findAllByProps({ "aria-label": "Preview second.jpg" })).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("sends each selected photo for host approval and removes only successful items", async () => {
    drop([file("first.jpg"), file("second.jpg")]);
    mocks.submit.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Please wait" });
    await act(async () => view.root.findByType("form").props.action());
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.submit.mock.calls[0][0].get("eventId")).toBe("party");
    expect(mocks.submit.mock.calls[0][0].get("kind")).toBe("PHOTO");
    expect(view.root.findAllByProps({ "aria-label": "Preview first.jpg" })).toHaveLength(0);
    expect(view.root.findByProps({ "aria-label": "Preview second.jpg" })).toBeDefined();
    expect(view.root.findByProps({ role: "status" }).children.join("")).toContain("1 sent successfully");
    mocks.submit.mockResolvedValue({ ok: true });
    await act(async () => view.root.findByType("form").props.action());
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects non-photos and caps the pending selection at eight", () => {
    drop([file("bad.mp4", "video/mp4")]);
    expect(view.root.findAllByType("img")).toHaveLength(0);
    drop(Array.from({ length: 10 }, (_, i) => file(`photo-${i}.jpg`)));
    expect(view.root.findAllByType("img")).toHaveLength(9);
  });
  it("offers video links without requiring a photo upload", async () => {
    act(() => view.root.findAllByType("button").find((node) => node.children.includes("Video link"))!.props.onClick());
    act(() => view.root.findAllByType("input").find((node) => node.props.type === "url")!.props.onChange({ target: { value: "https://www.tiktok.com/@test/video/123" } }));
    await act(async () => view.root.findByType("form").props.action());
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.submit.mock.calls[0][0].get("kind")).toBe("TIKTOK");
  });
});
