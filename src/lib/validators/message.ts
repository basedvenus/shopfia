import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  vendorProfileId: z.string().cuid().optional(),
  body: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).max(5).default([])
});
