import { isQuarantinedVendorId } from "@/lib/public-marketplace";

/** Decorative examples, never counted as published parties or booked vendor credits. */
export const partyInspirationExamples = [
  {
    slug: "citrus-garden-brunch",
    title: "Citrus Garden Brunch",
    theme: "Lemon garden party",
    tags: ["brunch", "lemons", "floral", "garden party"],
    description: "A soft citrus tablescape with blush linens, lemon accents, candlelight, and modern florals.",
    coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
    imageUrls: ["/demo/fairfield-lemon-tablescape.png"]
  },
  {
    slug: "tulip-cookie-shower",
    title: "Tulip Cookie Shower",
    theme: "Pastel floral baby shower",
    tags: ["baby shower", "pastel", "cookies", "floral"],
    description: "A sweet pastel favor moment built around hand-piped tulip and floral cookies.",
    coverImageUrl: "/demo/vacaville-cookie-tulips.png",
    imageUrls: ["/demo/vacaville-cookie-tulips.png"]
  }
];

export function getPartyInspirationExample(slug: string, hasPublishedEvent: boolean) {
  // A real post owns all of its content, even when its slug matches an example.
  return hasPublishedEvent ? undefined : partyInspirationExamples.find((example) => example.slug === slug);
}

export function getUniquePartyVendors<T extends { id: string }>(party: {
  taggedVendors: T[];
  photos: Array<{ taggedVendors: T[] }>;
}) {
  return Array.from(new Map([
    ...party.taggedVendors,
    ...party.photos.flatMap((photo) => photo.taggedVendors)
  ].filter((vendor) => !isQuarantinedVendorId(vendor.id)).map((vendor) => [vendor.id, vendor])).values());
}
