import type { CSSProperties } from "react";
import type { SectionDesign, StorefrontTemplate } from "./storefront-template-library";

export const SECTION_PATTERNS = ["solid","clouds","stripes","grid","dots","checker","waves"] as const;
export function patternBackground(design: SectionDesign): string {
  const color=design.patternColor ?? "#ffffff";
  if(design.pattern === "clouds") return 'url("/preview-templates/cloud-sky.svg")';
  if(design.pattern === "stripes") return `repeating-linear-gradient(90deg,transparent 0 22px,${color} 22px 44px)`;
  if(design.pattern === "grid") return `linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px)`;
  if(design.pattern === "dots") return `radial-gradient(${color} 1.6px,transparent 1.8px)`;
  if(design.pattern === "checker") return `conic-gradient(${color} 25%,transparent 0 50%,${color} 0 75%,transparent 0)`;
  if(design.pattern === "waves") return `radial-gradient(circle at 12px 0,${color} 12px,transparent 12.5px)`;
  return "none";
}
export function sectionDesignStyle(design?: SectionDesign): CSSProperties {
  if(!design)return {};
  const opacity=Math.max(0,Math.min(1,design.overlayOpacity ?? 0));
  const overlay=/^#[0-9a-f]{6}$/i.test(design.overlayColor ?? "") ? design.overlayColor! : "#ffffff";
  const rgba=`rgba(${[1,3,5].map(index=>parseInt(overlay.slice(index,index+2),16)).join(",")},${opacity})`;
  const pattern=patternBackground(design);
  const image=opacity ? `linear-gradient(${rgba},${rgba}),${pattern}` : pattern;
  const size=design.pattern === "clouds" ? "320px 320px" : design.pattern === "stripes" ? "auto" : "28px 28px";
  return {"--section-background":design.background,"--section-ink":design.ink,"--section-pattern":image,"--section-pattern-size":size,backgroundColor:design.background,backgroundImage:image,backgroundSize:size,color:design.ink} as CSSProperties;
}
export function getSectionDesign(template: StorefrontTemplate, section: string): SectionDesign {
  return template.sectionDesigns?.[section] ?? {background:section === "hero" ? template.heroBackground ?? template.colors.surface : template.colors.surface,ink:section === "hero" ? template.heroInk ?? template.colors.ink : template.colors.ink,pattern:"solid",patternColor:template.colors.secondary,overlayColor:"#ffffff",overlayOpacity:0};
}
