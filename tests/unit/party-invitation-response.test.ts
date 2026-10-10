import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const mocks = vi.hoisted(() => ({ respond: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ updatePartyCollaborationAction: mocks.respond }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { PartyInvitationResponse } from "@/components/parties/party-invitation-response";

let root: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.respond.mockResolvedValue({ ok: true });
  act(() => { root = create(createElement(PartyInvitationResponse, { collaborationId: "test-invitation" })); });
});
afterEach(() => { act(() => root.unmount()); });

describe("party invitation response controls", () => {
  it.each([[0, "accept"], [1, "decline"]] as const)("submits %s as %s and refreshes the private inbox", async (index, action) => {
    await act(async () => { root.root.findAllByType("button")[index].props.onClick(); });
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    const form = mocks.respond.mock.calls[0][0] as FormData;
    expect(form.get("collaborationId")).toBe("test-invitation");
    expect(form.get("action")).toBe(action);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(root.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it("disables both buttons and suppresses repeated or conflicting clicks while saving", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    mocks.respond.mockReturnValue(new Promise((done) => { resolve = done; }));
    const buttons = root.root.findAllByType("button");
    act(() => {
      buttons[0].props.onClick();
      buttons[0].props.onClick();
      buttons[1].props.onClick();
    });
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(root.root.findAllByType("button").every((button) => button.props.disabled)).toBe(true);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: true }); });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows stale or unauthorized response errors without claiming success and allows retry", async () => {
    mocks.respond.mockResolvedValueOnce({ ok: false, error: "That collaboration could not be found." });
    await act(async () => { root.root.findAllByType("button")[0].props.onClick(); });
    expect(root.root.findByProps({ role: "alert" }).children).toEqual(["That collaboration could not be found."]);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(root.root.findAllByType("button").every((button) => !button.props.disabled)).toBe(true);
    await act(async () => { root.root.findAllByType("button")[1].props.onClick(); });
    expect(mocks.respond).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(root.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  });

  it("recovers from a transport failure without exposing raw errors", async () => {
    mocks.respond.mockRejectedValueOnce(new Error("internal test-only failure"));
    await act(async () => { root.root.findAllByType("button")[0].props.onClick(); });
    expect(root.root.findByProps({ role: "alert" }).children).toEqual(["This collaboration could not be updated. Refresh and try again."]);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(root.root.findAllByType("button").every((button) => !button.props.disabled)).toBe(true);
  });
});

describe("accepted host withdrawal controls", () => {
  beforeEach(() => {
    act(() => { root.update(createElement(PartyInvitationResponse, { collaborationId: "test-invitation", mode: "accepted" })); });
  });

  it("shows Leave without accept/decline and submits a recipient-only remove before refreshing", async () => {
    const buttons = root.root.findAllByType("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].children).toEqual(["Leave party"]);
    await act(async () => { buttons[0].props.onClick(); });
    const form = mocks.respond.mock.calls[0][0] as FormData;
    expect(form.get("collaborationId")).toBe("test-invitation");
    expect(form.get("action")).toBe("remove");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("disables withdrawal while saving and prevents duplicate remove requests", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    mocks.respond.mockReturnValue(new Promise((done) => { resolve = done; }));
    const leave = root.root.findByType("button").props.onClick;
    act(() => { leave(); leave(); });
    expect(mocks.respond).toHaveBeenCalledTimes(1);
    expect(root.root.findByType("button").props.disabled).toBe(true);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: true }); });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps an unsuccessful withdrawal visible and allows a retry", async () => {
    mocks.respond.mockResolvedValueOnce({ ok: false, error: "That collaboration could not be found." });
    await act(async () => { root.root.findByType("button").props.onClick(); });
    expect(root.root.findByProps({ role: "alert" }).children).toEqual(["That collaboration could not be found."]);
    expect(root.root.findByType("button").props.disabled).toBe(false);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => { root.root.findByType("button").props.onClick(); });
    expect(mocks.respond).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("recovers from a withdrawal transport failure without claiming the host has left", async () => {
    mocks.respond.mockRejectedValueOnce(new Error("internal test-only failure"));
    await act(async () => { root.root.findByType("button").props.onClick(); });
    expect(root.root.findByProps({ role: "alert" }).children).toEqual(["This collaboration could not be updated. Refresh and try again."]);
    expect(root.root.findByType("button").props.disabled).toBe(false);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
