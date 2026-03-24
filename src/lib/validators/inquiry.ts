import { z } from "zod";

export const publicInquirySchema = z.object({
  vendorProfileId: z.string().cuid(),
  listingId: z.string().cuid().optional().or(z.literal("")),
  offeringId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  eventDate: z.string().optional().or(z.literal("")),
  eventLocation: z.string().trim().min(2).max(200),
  budgetDollars: z.coerce.number().min(0).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal(""))
});
