ALTER TABLE "Order" ADD COLUMN "stripeCheckoutSessionId" TEXT;

CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");
