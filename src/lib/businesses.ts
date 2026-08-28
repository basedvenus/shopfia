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

export const STOREFRONT_LAYOUTS = [
  {
    value: "EDITORIAL",
    label: "Editorial",
    description: "Large hero image, elegant About section, then portfolio and services."
  },
  {
    value: "PORTFOLIO",
    label: "Portfolio",
    description: "Image grid first, best for florists, decorators, photographers, and bakers."
  },
  {
    value: "SERVICES",
    label: "Services",
    description: "Packages and starting prices first, best for rentals, entertainment, and caterers."
  }
] as const;

export const STOREFRONT_FONT_STYLES = [
  { value: "MODERN", label: "Modern", description: "Clean sans-serif." },
  { value: "EDITORIAL", label: "Editorial", description: "Elegant serif with simple body text." },
  { value: "ROMANTIC", label: "Romantic", description: "Soft serif with subtle script accents." },
  { value: "PLAYFUL", label: "Playful", description: "Rounded, friendly typography." }
] as const;

export const STOREFRONT_PALETTES = [
  { value: "BLUSH", label: "Blush", description: "Soft pinks and airy warm whites.", className: "from-[#fff7f6] via-[#fde8e8] to-[#fffaf8]", accent: "#c9828a" },
  { value: "WARM_NEUTRAL", label: "Warm Neutral", description: "Cream, taupe, and quiet clay accents.", className: "from-[#fbf5ef] via-[#efe4d9] to-[#fffdf9]", accent: "#9c7661" },
  { value: "SAGE", label: "Sage", description: "Fresh greens with natural light backgrounds.", className: "from-[#f6faf3] via-[#dfe9d8] to-[#fbfff8]", accent: "#6f8a63" },
  { value: "LAVENDER", label: "Lavender", description: "Soft purple tones with polished neutrals.", className: "from-[#faf7ff] via-[#e8def6] to-[#fffaff]", accent: "#8873a7" },
  { value: "CHAMPAGNE", label: "Champagne", description: "Golden neutrals for a warm premium feel.", className: "from-[#fff9ed] via-[#f6e4be] to-[#fffdf6]", accent: "#b38a45" },
  { value: "MIDNIGHT", label: "Midnight", description: "Deep contrast with elegant warm accents.", className: "from-[#201e2a] via-[#343044] to-[#f9efe9]", accent: "#d7b98f" }
] as const;

export const STOREFRONT_BUTTON_STYLES = [
  { value: "PILL", label: "Pill" },
  { value: "SOFT", label: "Soft" },
  { value: "OUTLINE", label: "Outline" }
] as const;

export const STOREFRONT_IMAGE_SHAPES = [
  { value: "ROUNDED", label: "Rounded" },
  { value: "SOFT", label: "Soft" },
  { value: "SQUARE", label: "Square" }
] as const;

export const APPROVED_STOREFRONT_SECTIONS = [
  "hero",
  "featured-services",
  "all-services",
  "about",
  "how-it-works",
  "portfolio",
  "reviews",
  "faq",
  "final-quote"
] as const;

export const STOREFRONT_SECTION_LABELS: Record<(typeof APPROVED_STOREFRONT_SECTIONS)[number], string> = {
  hero: "Hero",
  "featured-services": "Featured Services",
  "all-services": "All Services",
  about: "About Us",
  "how-it-works": "How It Works",
  portfolio: "Portfolio",
  reviews: "Reviews",
  faq: "FAQ",
  "final-quote": "Final Quote Section"
};

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
  const aliases: Record<string, string> = {
    services: "all-services",
    offerings: "all-services",
    "featured-parties": "portfolio",
    "service-area": "how-it-works",
    "inquiry-form": "final-quote",
    "social-links": "final-quote",
    credentials: "how-it-works"
  };
  const hasLegacySections = sections.some((section) => section in aliases);
  const requested = sections
    .map((section) => aliases[section] ?? section)
    .filter((section) => approved.has(section));
  const ordered = hasLegacySections
    ? APPROVED_STOREFRONT_SECTIONS
    : requested.includes("hero")
      ? requested
      : ["hero", ...requested];
  const combined = [...ordered, ...APPROVED_STOREFRONT_SECTIONS];
  return Array.from(new Set(combined));
}

export function normalizeStorefrontAccentColor(value: string | null | undefined) {
  const requested = value?.trim();
  return STOREFRONT_ACCENT_COLORS.some((color) => color.value === requested) ? requested : "blush";
}

export function storefrontAccentColorFromPalette(value: string | null | undefined) {
  const palette = STOREFRONT_PALETTES.find((item) => item.value === value);
  if (!palette) return "blush";
  if (palette.value === "SAGE") return "sage";
  if (palette.value === "LAVENDER") return "lilac";
  if (palette.value === "CHAMPAGNE" || palette.value === "MIDNIGHT") return "champagne";
  return palette.value === "BLUSH" ? "blush" : "champagne";
}

export function sanitizeHiddenStorefrontSections(sections: string[]) {
  const required = new Set(["hero"]);
  const approved = new Set<string>(APPROVED_STOREFRONT_SECTIONS);
  return Array.from(new Set(sections.map((section) => section === "services" ? "all-services" : section).filter((section) => approved.has(section) && !required.has(section))));
}
