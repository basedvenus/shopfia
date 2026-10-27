import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/app/actions/password-reset", () => ({ requestPasswordResetAction: mocks.request }));
vi.mock("@/app/actions/auth", () => ({ createPasswordAccountAction: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import { SignInPanel } from "@/components/account/sign-in-panel";

describe("forgot password button", () => {
  beforeEach(() => vi.resetAllMocks());

  async function clickForgot() {
    let view!: ReactTestRenderer;
    act(() => { view = create(React.createElement(SignInPanel, { emailEnabled: true, googleEnabled: false })); });
    act(() => view.root.findByProps({ type: "email" }).props.onChange({ target: { value: "person@example.com" } }));
    const button = view.root.findAllByType("button").find((node) => node.children.includes("Forgot Password?"))!;
    await act(async () => { button.props.onClick(); });
    return view;
  }

  it("requests the entered email without requiring a password and displays the result", async () => {
    mocks.request.mockResolvedValue({ ok: true, message: "Check your email for a reset link." });
    const view = await clickForgot();
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.request.mock.calls[0][0].get("email")).toBe("person@example.com");
    expect(view.root.findByProps({ role: "status" }).children).toContain("Check your email for a reset link.");
    act(() => view.unmount());
  });

  it("shows delivery failure rather than a success message", async () => {
    mocks.request.mockResolvedValue({ ok: false, error: "Email delivery unavailable." });
    const view = await clickForgot();
    expect(view.root.findByProps({ role: "status" }).children).toContain("Email delivery unavailable.");
    act(() => view.unmount());
  });

  it("handles network errors", async () => {
    mocks.request.mockRejectedValue(new Error("network offline"));
    const view = await clickForgot();
    expect(view.root.findByProps({ role: "status" }).children).toContain("Could not request a reset link. Please try again shortly.");
    act(() => view.unmount());
  });
});
