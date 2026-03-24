import { z } from "zod";

export const quoteRequestSchema = z.object({
  vendorId: z.string().cuid(),
  offeringId: z.string().cuid().optional().or(z.literal("")),
  eventDate: z.string().optional().or(z.literal("")),
  eventLocation: z.string().min(2).max(200),
  budgetCents: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  attachments: z.array(z.string().url()).max(6).default([])
});

export const quoteResponseSchema = z.object({
  quoteRequestId: z.string().cuid(),
  amountCents: z.coerce.number().int().min(1),
  depositAmountCents: z.coerce.number().int().min(0).optional(),
  expiresAt: z.string().min(1),
  notes: z.string().max(2000).optional().or(z.literal("")),
  paymentPreference: z.enum(["DEPOSIT", "FULL"]).default("DEPOSIT")
});

export const acceptQuoteSchema = z.object({
  quoteId: z.string().cuid(),
  payMode: z.enum(["deposit", "full"]).default("deposit")
});
