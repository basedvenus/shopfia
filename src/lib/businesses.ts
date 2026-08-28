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
  { value: "MODERN", label: "Modern", description: "Manrope. Clean, effortless, and polished." },
  { value: "EDITORIAL", label: "Editorial", description: "Instrument Serif + Inter. Elegant and magazine-like." },
  { value: "ROMANTIC", label: "Romantic", description: "Cormorant Garamond + Manrope. Soft and thoughtful." },
  { value: "BOLD", label: "Bold", description: "Space Grotesk. Strong, graphic, and high-impact." },
  { value: "FASHION", label: "Fashion", description: "Bodoni Moda + DM Sans. Elevated and boutique." },
  { value: "PLAYFUL", label: "Playful", description: "Bricolage Grotesque. Colorful and friendly." },
  { value: "RETRO", label: "Retro", description: "Fraunces + Work Sans. Fresh with vintage charm." },
  { value: "COOL", label: "Cool", description: "Syne + Inter. Distinctive and modern." }
] as const;

export const STOREFRONT_FONT_STYLE_VALUES = STOREFRONT_FONT_STYLES.map((font) => font.value);

export function getStorefrontFontFamilies(value: string | null | undefined) {
  const requested = value?.trim();
  const fontStyle = STOREFRONT_FONT_STYLES.some((font) => font.value === requested) ? requested : "MODERN";
  if (fontStyle === "EDITORIAL") {
    return {
      body: "var(--font-shopfia-inter), Inter, ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-instrument-serif), 'Instrument Serif', Georgia, serif"
    };
  }
  if (fontStyle === "ROMANTIC") {
    return {
      body: "var(--font-shopfia-manrope), Manrope, ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-serif), 'Cormorant Garamond', Georgia, serif"
    };
  }
  if (fontStyle === "BOLD") {
    return {
      body: "var(--font-shopfia-space), 'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-space), 'Space Grotesk', ui-sans-serif, system-ui, sans-serif"
    };
  }
  if (fontStyle === "FASHION") {
    return {
      body: "var(--font-shopfia-dm), 'DM Sans', ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-bodoni), 'Bodoni Moda', Georgia, serif"
    };
  }
  if (fontStyle === "PLAYFUL") {
    return {
      body: "var(--font-shopfia-bricolage), 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-bricolage), 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
    };
  }
  if (fontStyle === "RETRO") {
    return {
      body: "var(--font-shopfia-work), 'Work Sans', ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-fraunces), Fraunces, Georgia, serif"
    };
  }
  if (fontStyle === "COOL") {
    return {
      body: "var(--font-shopfia-inter), Inter, ui-sans-serif, system-ui, sans-serif",
      heading: "var(--font-shopfia-syne), Syne, ui-sans-serif, system-ui, sans-serif"
    };
  }
  return {
    body: "var(--font-shopfia-manrope), Manrope, ui-sans-serif, system-ui, sans-serif",
    heading: "var(--font-shopfia-manrope), Manrope, ui-sans-serif, system-ui, sans-serif"
  };
}

export const STOREFRONT_PALETTES = [
  { value: "BLUSH", label: "Blush", description: "Soft pinks with a rose storefront accent.", className: "from-[#FFF8F7] via-[#F8DADD] to-[#FFFFFF]", accent: "#D98889", swatches: ["#F8DADD", "#D98889", "#FFF8F7", "#332A2B"] },
  { value: "BUBBLEGUM", label: "Bubblegum", description: "Bright party pink with crisp white contrast.", className: "from-[#FFF6FC] via-[#F7C7E3] to-[#FFFFFF]", accent: "#EB72B4", swatches: ["#F7C7E3", "#EB72B4", "#FFF6FC", "#392B34"] },
  { value: "CITRUS", label: "Citrus", description: "Sunny orange with warm cream support.", className: "from-[#FFF8F0] via-[#FFD2A6] to-[#FFFFFF]", accent: "#F07832", swatches: ["#FFD2A6", "#F07832", "#FFF8F0", "#352B25"] },
  { value: "MATCHA_SOFT", label: "Matcha Soft", description: "Light matcha greens and fresh natural whites.", className: "from-[#FAFCF5] via-[#DDE8C8] to-[#FFFFFF]", accent: "#91AA6B", swatches: ["#DDE8C8", "#91AA6B", "#FAFCF5", "#2D3329"] },
  { value: "MATCHA_BOLD", label: "Matcha Bold", description: "Deep botanical greens with strong contrast.", className: "from-[#F6F9EC] via-[#C3D889] to-[#FFFFFF]", accent: "#5B7A3D", swatches: ["#C3D889", "#5B7A3D", "#F6F9EC", "#263022"] },
  { value: "SKY", label: "Sky", description: "Airy blue with clean editorial contrast.", className: "from-[#F7FBFD] via-[#D5E9F4] to-[#FFFFFF]", accent: "#6599B5", swatches: ["#D5E9F4", "#6599B5", "#F7FBFD", "#26323A"] },
  { value: "LAVENDER", label: "Lavender", description: "Soft purple with polished deep neutrals.", className: "from-[#FBF8FE] via-[#E5D9F4] to-[#FFFFFF]", accent: "#9A76C1", swatches: ["#E5D9F4", "#9A76C1", "#FBF8FE", "#302A36"] },
  { value: "PASTEL_RAINBOW", label: "Pastel Rainbow", description: "Playful pastel mix for colorful celebrations.", className: "from-[#F7CFE1] via-[#BFE2D0] to-[#CFCBF3]", accent: "#8BBFB8", swatches: ["#F7CFE1", "#F8D98B", "#BFE2D0", "#CFCBF3"], gradient: "linear-gradient(90deg, #F7CFE1, #F8D98B, #BFE2D0, #CFCBF3)", ctaText: "#1F1F1F" },
  { value: "DISCO", label: "Disco", description: "Pearl and violet for glam, sparkle-forward storefronts.", className: "from-[#FCFAFD] via-[#E5E2E8] to-[#F5EFFA]", accent: "#B49AC8", swatches: ["#E5E2E8", "#B49AC8", "#FCFAFD", "#302D34"] },
  { value: "BLACK_AND_WHITE", label: "Black & White", description: "High-contrast monochrome with a boutique feel.", className: "from-[#FFFFFF] via-[#EFEDEB] to-[#F8F8F8]", accent: "#111111", swatches: ["#FFFFFF", "#1F1F1F", "#EFEDEB", "#111111"] },
  { value: "ESPRESSO", label: "Espresso", description: "Warm coffee browns with bakery-style cream.", className: "from-[#F8F4F0] via-[#D8C6B8] to-[#FFFFFF]", accent: "#5A4035", swatches: ["#D8C6B8", "#5A4035", "#F8F4F0", "#292421"] }
] as const;

export const STOREFRONT_PALETTE_VALUES = STOREFRONT_PALETTES.map((palette) => palette.value);

const LEGACY_STOREFRONT_PALETTE_MAP: Record<string, (typeof STOREFRONT_PALETTES)[number]["value"]> = {
  CHAMPAGNE: "CITRUS",
  MIDNIGHT: "BLACK_AND_WHITE",
  SAGE: "MATCHA_SOFT",
  WARM_NEUTRAL: "ESPRESSO"
};

export function normalizeStorefrontPalette(value: string | null | undefined) {
  const requested = value?.trim();
  if (STOREFRONT_PALETTES.some((palette) => palette.value === requested)) return requested as (typeof STOREFRONT_PALETTES)[number]["value"];
  return requested ? LEGACY_STOREFRONT_PALETTE_MAP[requested] ?? "BLUSH" : "BLUSH";
}

export function getStorefrontPalette(value: string | null | undefined) {
  const normalized = normalizeStorefrontPalette(value);
  return STOREFRONT_PALETTES.find((palette) => palette.value === normalized) ?? STOREFRONT_PALETTES[0];
}

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

export function coverageAreaLabels(serviceAreaNotes: string | null | undefined, fallback?: string | null) {
  const labels = (serviceAreaNotes ?? "")
    .split(/[\n;,•]+/)
    .map((label) => label.replace(/^[-–—\s]+/, "").trim())
    .filter((label) => label.length >= 2 && label.length <= 42)
    .slice(0, 10);
  const fallbackLabel = fallback?.trim();

  return Array.from(new Set([...labels, ...(fallbackLabel ? [fallbackLabel] : [])])).slice(0, 10);
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
  const palette = normalizeStorefrontPalette(value);
  if (palette === "MATCHA_SOFT" || palette === "MATCHA_BOLD") return "sage";
  if (palette === "LAVENDER" || palette === "DISCO") return "lilac";
  if (palette === "SKY") return "sky";
  if (palette === "BLUSH" || palette === "BUBBLEGUM" || palette === "PASTEL_RAINBOW") return "blush";
  return "champagne";
}

export function sanitizeHiddenStorefrontSections(sections: string[]) {
  const required = new Set(["hero"]);
  const approved = new Set<string>(APPROVED_STOREFRONT_SECTIONS);
  return Array.from(new Set(sections.map((section) => section === "services" ? "all-services" : section).filter((section) => approved.has(section) && !required.has(section))));
}
