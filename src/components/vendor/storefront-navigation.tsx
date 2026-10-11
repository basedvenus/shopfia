import type { CSSProperties } from "react";
import { STOREFRONT_SECTION_LABELS } from "@/lib/businesses";

type Section = keyof typeof STOREFRONT_SECTION_LABELS;
const sectionLinks: ReadonlyArray<{ section: Section; href: string }> = [
  { section: "all-services", href: "#services" },
  { section: "portfolio", href: "#portfolio" },
  { section: "about", href: "#about" },
  { section: "reviews", href: "#reviews" },
  { section: "faq", href: "#faq" }
];

export function StorefrontNavigation({ visibleSections, sectionLabels, style, activeItemStyle }: {
  visibleSections: readonly string[];
  sectionLabels: Partial<Record<Section, string>>;
  style?: CSSProperties;
  activeItemStyle?: CSSProperties;
}) {
  const links = [
    { href: "#storefront-home", label: "Home" },
    ...sectionLinks.filter(({ section }) => visibleSections.includes(section)).map(({ section, href }) => ({
      href,
      label: sectionLabels[section] ?? STOREFRONT_SECTION_LABELS[section]
    }))
  ];
  return (
    <nav aria-label="Storefront sections" className="sticky top-16 z-10 flex gap-1 overflow-x-auto border-t bg-white px-3 py-1.5 text-sm font-medium backdrop-blur" style={style}>
      {links.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="whitespace-nowrap rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground"
          style={href === "#storefront-home" ? activeItemStyle : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
