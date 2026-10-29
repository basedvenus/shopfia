import { z } from "zod";
import { servicePricingSchema, selectionSchema, promotionSchema } from "./service-pricing";

export const priceLineSchema = z.object({ id: z.string().min(1).max(150), name: z.string().trim().min(1).max(200), scope: z.string().trim().min(1).max(4000), quantity: z.number().positive().max(100000), unit: z.string().min(1).max(120), rate: z.number().int().min(0).max(100000000).nullable(), amount: z.number().nullable(), calculation: z.string().max(500) });
export const requestPricingSchema = z.object({ version: z.literal(1), service: servicePricingSchema, selection: selectionSchema, lines: z.array(priceLineSchema).max(50), promotions: z.array(promotionSchema).max(30) });
export function readRequestPricing(value: unknown) { const parsed = requestPricingSchema.safeParse(value); return parsed.success ? parsed.data : null; }
export const structuredQuoteInput = z.object({
  quoteRequestId: z.string().cuid(), previousQuoteId: z.string().cuid().nullable(),
  lines: z.array(priceLineSchema).min(1).max(50),
  finalPrice: z.number().int().min(0).max(100000000),
  charges: z.array(z.object({ id: z.string().max(150), name: z.string().trim().min(1).max(120), amount: z.number().int().min(0).max(100000000) })).max(20),
  tax: z.number().int().min(0).max(100000000), depositPercent: z.number().min(0).max(100),
  explanation: z.string().max(2000), expiresAt: z.string().datetime()
});
