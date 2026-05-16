import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  vendorProfileId: z.string().cuid().optional(),
  body: z.string().min(1, "Write a message before sending.").max(2000, "Message is a little too long."),
  attachments: z.array(z.string().url()).max(5, "Add up to 5 attachments.").default([])
});
