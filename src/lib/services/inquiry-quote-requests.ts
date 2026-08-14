import { QuoteRequestStatus, type Prisma } from "@prisma/client";

type InquiryQuoteRequestInput = {
  attachments: string[];
  budgetCents: number | null;
  buyerId: string;
  conversationId: string;
  eventDate: Date | null;
  eventLocation: string | null;
  inquiryId: string;
  notes: string | null;
  offeringId: string | null;
  vendorId: string;
};

type QuoteRequestDelegate = {
  upsert(args: Prisma.QuoteRequestUpsertArgs): Promise<{ id: string }>;
};

export async function ensureQuoteRequestForInquiry(
  quoteRequest: QuoteRequestDelegate,
  input: InquiryQuoteRequestInput
) {
  return quoteRequest.upsert({
    where: { inquiryId: input.inquiryId },
    update: {
      attachments: input.attachments,
      budgetCents: input.budgetCents,
      conversationId: input.conversationId,
      eventDate: input.eventDate,
      eventLocation: input.eventLocation ?? "Event location TBD",
      notes: input.notes,
      offeringId: input.offeringId,
      status: QuoteRequestStatus.SUBMITTED
    },
    create: {
      attachments: input.attachments,
      budgetCents: input.budgetCents,
      buyerId: input.buyerId,
      conversationId: input.conversationId,
      eventDate: input.eventDate,
      eventLocation: input.eventLocation ?? "Event location TBD",
      inquiryId: input.inquiryId,
      notes: input.notes,
      offeringId: input.offeringId,
      status: QuoteRequestStatus.SUBMITTED,
      vendorId: input.vendorId
    }
  });
}
