import { z } from "zod";

const setupChoiceSchema = z.discriminatedUnion("isVendor", [
  z.object({ isVendor: z.literal("no") }),
  z.object({
    isVendor: z.literal("yes"),
    storefrontName: z.string().trim().min(2, "Enter your storefront name.").max(80, "Keep your storefront name under 80 characters.")
  })
]);

export function getAccountSetupDestination(formData: FormData) {
  const parsed = setupChoiceSchema.safeParse({
    isVendor: formData.get("isVendor"),
    storefrontName: formData.get("storefrontName")
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.path[0] === "storefrontName"
      ? parsed.error.issues[0].message
      : "Choose Yes or No for whether you are a vendor." };
  }
  if (parsed.data.isVendor === "no") return { ok: true as const, nextPath: "/explore" };
  const params = new URLSearchParams({ newBusiness: "1", storefrontName: parsed.data.storefrontName });
  return { ok: true as const, nextPath: `/onboarding?${params.toString()}#profile` };
}
