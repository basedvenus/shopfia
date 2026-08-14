import { describe, expect, it, vi } from "vitest";
import { ensureQuoteRequestForInquiry } from "@/lib/services/inquiry-quote-requests";

describe("inquiry quote request linking", () => {
  it("creates or updates one quote request per inquiry and keeps the conversation link", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "quote_request_1" });

    await ensureQuoteRequestForInquiry({ upsert }, {
      attachments: ["https://example.com/inspiration.png"],
      budgetCents: 12500,
      buyerId: "buyer_1",
      conversationId: "conversation_1",
      eventDate: new Date("2026-09-15T00:00:00.000Z"),
      eventLocation: "Fairfield, CA",
      inquiryId: "inquiry_1",
      notes: "I would love a quote.",
      offeringId: "offering_1",
      vendorId: "vendor_profile_1"
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { inquiryId: "inquiry_1" },
      create: {
        buyerId: "buyer_1",
        conversationId: "conversation_1",
        inquiryId: "inquiry_1",
        status: "SUBMITTED",
        vendorId: "vendor_profile_1"
      },
      update: {
        conversationId: "conversation_1",
        status: "SUBMITTED"
      }
    });
  });
});
