import { describe, expect, it, vi } from "vitest";
import { createQuoteRequestRecord } from "@/lib/services/quote-requests";

describe("prisma create flow", () => {
  it("builds a quote request create payload and calls prisma create", async () => {
    const create = vi.fn().mockResolvedValue({ id: "qr_1" });
    const prismaLike = { quoteRequest: { create } };

    await createQuoteRequestRecord(prismaLike, {
      buyerId: "buyer_1",
      vendorId: "vendor_1",
      eventLocation: "Fairfield, CA",
      notes: "Birthday setup"
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [arg] = create.mock.calls[0];
    expect(arg).toMatchObject({
      data: {
        buyerId: "buyer_1",
        vendorId: "vendor_1",
        eventLocation: "Fairfield, CA",
        status: "SUBMITTED",
        attachments: []
      }
    });
  });
});
