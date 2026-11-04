import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const router = { refresh: mocks.refresh };
import { SessionKeepAlive } from "@/components/account/session-keep-alive";
let view: ReturnType<typeof create>;
let page: EventTarget & { visibilityState: string };
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { act(() => view?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function mount(signedIn = true) {
  await act(async () => { view = create(createElement(SessionKeepAlive, { signedIn })); });
}
describe("browser session renewal", () => {
  it("renews through the session endpoint on open and after iOS resumes", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { id: "user_1" } }) });
    await mount();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(16 * 60_000); });
    const before = mocks.fetch.mock.calls.length;
    page.visibilityState = "hidden";
    await act(async () => { await vi.advanceTimersByTimeAsync(16 * 60_000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(before);
    page.visibilityState = "visible";
    await act(async () => { page.dispatchEvent(new Event("visibilitychange")); });
    expect(mocks.fetch).toHaveBeenCalledTimes(before + 1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("keeps the current login during an outage and retries", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => ({ user: { id: "user_1" } }) });
    await mount();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("restores server UI after a temporary signed-out render", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { id: "user_1" } }) });
    await mount(false);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("refreshes expired sessions without treating an error as logout", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => null });
    await mount();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
