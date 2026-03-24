import { QuoteRequestStatus } from "@prisma/client";

type PrismaLike = {
  quoteRequest: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export async function createQuoteRequestRecord(
  client: PrismaLike,
  data: {
    buyerId: string;
    vendorId: string;
    offeringId?: string | null;
    eventDate?: Date | null;
    eventLocation: string;
    budgetCents?: number | null;
    notes?: string | null;
    attachments?: string[];
  }
) {
  return client.quoteRequest.create({
    data: {
      ...data,
      offeringId: data.offeringId ?? null,
      eventDate: data.eventDate ?? null,
      budgetCents: data.budgetCents ?? null,
      notes: data.notes ?? null,
      attachments: data.attachments ?? [],
      status: QuoteRequestStatus.SUBMITTED
    }
  });
}
