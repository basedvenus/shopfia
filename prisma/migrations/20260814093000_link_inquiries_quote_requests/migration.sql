ALTER TABLE "QuoteRequest" ADD COLUMN "inquiryId" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "conversationId" TEXT;

CREATE UNIQUE INDEX "QuoteRequest_inquiryId_key" ON "QuoteRequest"("inquiryId");
CREATE INDEX "QuoteRequest_conversationId_idx" ON "QuoteRequest"("conversationId");

ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_inquiryId_fkey"
  FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
