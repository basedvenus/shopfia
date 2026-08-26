import type { Prisma, UserRole } from "@prisma/client";

export const RESERVED_STOREFRONT_SLUGS = new Set([
  "account",
  "admin",
  "api",
  "businesses",
  "categories",
  "explore",
  "favorites",
  "login",
  "messages",
  "my-parties",
  "offering",
  "onboarding",
  "parties",
  "profiles",
  "settings",
  "vendor",
  "welcome"
]);

export const STOREFRONT_ACCENT_COLORS = [
  { value: "blush", label: "Blush", className: "from-[#f6d8dd] to-[#fff7f4]" },
  { value: "sage", label: "Sage", className: "from-[#dfe8d8] to-[#fbfcf7]" },
  { value: "champagne", label: "Champagne", className: "from-[#f5e4c8] to-[#fffaf1]" },
  { value: "sky", label: "Sky", className: "from-[#dceaf7] to-[#f7fbff]" },
  { value: "lilac", label: "Lilac", className: "from-[#e8def6] to-[#fbf8ff]" }
] as const;

export const APPROVED_STOREFRONT_SECTIONS = ["about", "offerings", "portfolio", "credentials", "reviews"] as const;

export function slugifyBusinessUrl(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function suggestBusinessSlug(name: string) {
  return slugifyBusinessUrl(name) || "my-business";
}

export function isReservedStorefrontSlug(slug: string) {
  return RESERVED_STOREFRONT_SLUGS.has(slugifyBusinessUrl(slug));
}

export function storefrontPath(slug: string) {
  return `/${slugifyBusinessUrl(slug)}`;
}

export function storefrontUrl(slug: string, baseUrl?: string | null) {
  const normalizedBase = (baseUrl || process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://www.shopfia.app").replace(/\/$/, "");
  return `${normalizedBase}${storefrontPath(slug)}`;
}

export function businessManagerWhere(userId: string, role?: UserRole | string | null): Prisma.VendorProfileWhereInput {
  if (role === "ADMIN") return {};
  return {
    OR: [
      { userId },
      { managers: { some: { userId } } }
    ]
  };
}

export function sanitizeStorefrontSections(sections: string[]) {
  const approved = new Set<string>(APPROVED_STOREFRONT_SECTIONS);
  const requested = sections.filter((section) => approved.has(section));
  const combined = [...requested, ...APPROVED_STOREFRONT_SECTIONS];
  return Array.from(new Set(combined));
}

export function normalizeStorefrontAccentColor(value: string | null | undefined) {
  const requested = value?.trim();
  return STOREFRONT_ACCENT_COLORS.some((color) => color.value === requested) ? requested : "blush";
}
