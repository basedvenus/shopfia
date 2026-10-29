import type { CSSProperties } from "react";
import { STOREFRONT_SECTION_LABELS } from "@/lib/businesses";

type Section = keyof typeof STOREFRONT_SECTION_LABELS;
const sectionLinks: ReadonlyArray<{ section: Section; href: string }> = [
  { section: "hero", href: "#storefront-home" },
  { section: "effects", href: "#effects" },
  { section: "all-services", href: "#services" },
  { section: "portfolio", href: "#portfolio" },
  { section: "about", href: "#about" },
  { section: "parties", href: "#party-credits" },
  { section: "reviews", href: "#reviews" },
  { section: "final-quote", href: "#inquiry" },
  { section: "socials", href: "#socials" },
  { section: "faq", href: "#faq" }
];

export function StorefrontNavigation({ visibleSections, sectionLabels, style, activeItemStyle }: {
  visibleSections: readonly string[];
  sectionLabels: Partial<Record<Section, string>>;
  style?: CSSProperties;
  activeItemStyle?: CSSProperties;
}) {
  const links = visibleSections.flatMap(section => {
    const link = sectionLinks.find(item=>item.section===section);
    return link ? [{href:link.href,label:sectionLabels[link.section] ?? STOREFRONT_SECTION_LABELS[link.section]}] : [];
  });

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
