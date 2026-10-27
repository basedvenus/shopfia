import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/app/actions/password-reset", () => ({ requestPasswordResetAction: mocks.request }));
vi.mock("@/app/actions/auth", () => ({ createPasswordAccountAction: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
import { SignInPanel } from "@/components/account/sign-in-panel";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";

describe("dedicated password recovery", () => {
  beforeEach(() => vi.resetAllMocks());
  function mountForm() {
    let view!: ReactTestRenderer;
    act(() => { view = create(React.createElement(ForgotPasswordForm)); });
    act(() => view.root.findByProps({ type: "email" }).props.onChange({ target: { value: "person@example.com" } }));
    return view;
  }
  it("opens recovery independently of the sign-in fields", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(React.createElement(SignInPanel, { emailEnabled: true, googleEnabled: false })); });
    expect(view.root.findAllByType("a").find((link) => link.props.href === "/account/forgot-password")?.children).toContain("Forgot Password?");
    expect(mocks.request).not.toHaveBeenCalled();
    act(() => view.unmount());
  });
  it("requests the email without a password or magic-link control", async () => {
    mocks.request.mockResolvedValue({ ok: true, message: "Check your email for a reset link." });
    const view = mountForm();
    expect(view.root.findAllByProps({ type: "password" })).toHaveLength(0);
    await act(async () => { await view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(mocks.request.mock.calls[0][0].get("email")).toBe("person@example.com");
    expect(view.root.findByProps({ role: "status" }).children).toContain("Check your email for a reset link.");
    act(() => view.unmount());
  });
  it("blocks duplicate requests until delivery finishes", async () => {
    let finish!: (result: { ok: boolean; message: string }) => void;
    mocks.request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = mountForm();
    let submission!: Promise<void>;
    act(() => { submission = view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(view.root.findByType("button").props.disabled).toBe(true);
    await act(async () => { await view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(mocks.request).toHaveBeenCalledOnce();
    await act(async () => { finish({ ok: true, message: "Sent" }); await submission; });
    expect(view.root.findByType("button").props.disabled).toBe(false);
    act(() => view.unmount());
  });
  it.each(["delivery", "network"])("shows %s errors and allows retry", async (failure) => {
    if (failure === "delivery") mocks.request.mockResolvedValue({ ok: false, error: "Email delivery unavailable." });
    else mocks.request.mockRejectedValue(new Error("network offline"));
    const view = mountForm();
    await act(async () => { await view.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(view.root.findByProps({ role: "status" }).children.join("")).toContain(failure === "delivery" ? "Email delivery unavailable." : "Please try again");
    expect(view.root.findByType("button").props.disabled).toBe(false);
    act(() => view.unmount());
  });
});
