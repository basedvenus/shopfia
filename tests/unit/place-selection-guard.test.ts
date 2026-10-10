import { describe, expect, it, vi } from "vitest";
import { createPlaceSelectionGuard } from "@/lib/place-selection-guard";

describe("place selection request guard", () => {
  it("ignores a pending lookup after the address is edited manually", async () => {
    const guard = createPlaceSelectionGuard();
    const isCurrentRequest = guard.start();
    const applyPlace = vi.fn();
    let finishLookup!: (city: string) => void;
    const lookup = new Promise<string>((resolve) => { finishLookup = resolve; });
    const result = lookup.then((city) => {
      if (isCurrentRequest()) applyPlace(city);
    });

    guard.invalidate();
    finishLookup("Previous city");
    await result;

    expect(applyPlace).not.toHaveBeenCalled();
  });

  it("only allows the newest selection to update the address", () => {
    const guard = createPlaceSelectionGuard();
    const firstRequest = guard.start();
    const secondRequest = guard.start();

    expect(firstRequest()).toBe(false);
    expect(secondRequest()).toBe(true);
  });

  it("allows a new lookup after cancellation without reviving old responses", () => {
    const guard = createPlaceSelectionGuard();
    const cancelledRequest = guard.start();
    guard.invalidate();
    const currentRequest = guard.start();

    expect(cancelledRequest()).toBe(false);
    expect(currentRequest()).toBe(true);
    guard.invalidate();
    expect(currentRequest()).toBe(false);
  });
});
