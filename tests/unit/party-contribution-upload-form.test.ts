import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(), refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/party-contributions", () => ({ submitPartyContributionAction: mocks.submit, reviewPartyContributionAction: vi.fn() }));
import { PartyContributionForm } from "@/components/parties/party-contribution-form";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("uploads a photo once and sends only its ID to the server action", async () => {
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ photo: { id: "uploaded-photo" } }) });
  mocks.submit.mockResolvedValue({ ok: true });
  let view!: ReactTestRenderer;
  act(() => { view = create(React.createElement(PartyContributionForm, { eventId: "party" })); });
  const form = new FormData();
  form.set("eventId", "party"); form.set("kind", "PHOTO");
  form.set("file", new File([new Uint8Array(2 * 1024 * 1024)], "large.png", { type: "image/png" }));
  await act(async () => { view.root.findByType("form").props.action(form); });
  expect(mocks.fetch).toHaveBeenCalledOnce();
  const submission = mocks.submit.mock.calls[0][0] as FormData;
  expect(submission.get("file")).toBeNull();
  expect([...submission.entries()]).toEqual([["eventId", "party"], ["kind", "PHOTO"], ["photoId", "uploaded-photo"]]);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(view.root.findByProps({ role: "status" }).children.join("")).toContain("Sent to the host for approval");
  act(() => view.unmount());
});
