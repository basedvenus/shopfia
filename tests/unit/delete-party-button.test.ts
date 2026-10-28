import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/party-events", () => ({ deletePartyEventAction: mocks.remove }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@radix-ui/react-dialog", () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => children;
  return { Root: passthrough, Trigger: passthrough, Portal: passthrough, Overlay: () => null, Content: passthrough, Title: passthrough, Description: passthrough };
});
import { DeletePartyButton } from "@/components/parties/delete-party-button";
let view: ReactTestRenderer;
function mount() { act(() => { view = create(React.createElement(DeletePartyButton, { eventId: "party", title: "Birthday party" })); }); }
function button(text: string) { return view.root.findAllByType("button").find((node) => node.children.includes(text))!; }
beforeEach(() => vi.resetAllMocks());
describe("party deletion confirmation", () => {
  it("opens a confirmation without deleting, and Cancel leaves the party untouched", () => {
    mount();
    act(() => button("Delete party").props.onClick());
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(button("Cancel")).toBeDefined();
    act(() => button("Cancel").props.onClick());
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(view.root.findAllByType("button")).toHaveLength(1);
    act(() => view.unmount());
  });
  it("requires the second explicit Delete action and prevents double submission", async () => {
    let finish!: (result: { ok: boolean }) => void;
    mocks.remove.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount();
    act(() => button("Delete party").props.onClick());
    const confirm = view.root.findAllByType("button").filter((node) => node.children.includes("Delete party")).slice(-1)[0]!;
    act(() => { confirm.props.onClick(); confirm.props.onClick(); });
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith("party");
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { finish({ ok: true }); });
    expect(mocks.push).toHaveBeenCalledWith("/my-parties");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    act(() => view.unmount());
  });
  it("keeps the confirmation open and shows a failure without redirecting", async () => {
    mocks.remove.mockResolvedValue({ ok: false, error: "Please try again." });
    mount();
    act(() => button("Delete party").props.onClick());
    await act(async () => { view.root.findAllByType("button").filter((node) => node.children.includes("Delete party")).slice(-1)[0]!.props.onClick(); });
    expect(view.root.findByProps({ role: "alert" }).children).toContain("Please try again.");
    expect(button("Cancel")).toBeDefined();
    expect(mocks.push).not.toHaveBeenCalled();
    act(() => view.unmount());
  });
});
