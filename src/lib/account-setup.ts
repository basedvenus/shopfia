import { z } from "zod";
import { isReservedStorefrontSlug } from "@/lib/businesses";

const setupChoiceSchema = z.discriminatedUnion("isVendor", [
  z.object({ isVendor: z.literal("no") }),
  z.object({
    isVendor: z.literal("yes"),
    storefrontUsername: z.string().trim().toLowerCase().min(2, "Enter your business username.").max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes.").refine(value => !isReservedStorefrontSlug(value), "That business username is reserved."),
    storefrontName: z.string().trim().min(2, "Enter your storefront name.").max(80, "Keep your storefront name under 80 characters.")
  })
]);

export function getAccountSetupDestination(formData: FormData) {
  const parsed = setupChoiceSchema.safeParse({
    isVendor: formData.get("isVendor"),
    storefrontUsername: formData.get("storefrontUsername"),
    storefrontName: formData.get("storefrontName")
  });
  if (!parsed.success) {
    return { ok: false as const, error: ["storefrontName", "storefrontUsername"].includes(String(parsed.error.issues[0]?.path[0]))
      ? parsed.error.issues[0].message
      : "Choose Yes or No for whether you are a vendor." };
  }
  if (parsed.data.isVendor === "no") return { ok: true as const, nextPath: "/explore" };
  const params = new URLSearchParams({ newBusiness: "1", storefrontName: parsed.data.storefrontName, storefrontUsername: parsed.data.storefrontUsername });
  return { ok: true as const, nextPath: `/onboarding?${params.toString()}#profile` };
}
