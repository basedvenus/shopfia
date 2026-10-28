import references from "./storefront-reference-templates.json";

export type SectionDesign = { background: string; ink: string; pattern: "solid" | "clouds" | "stripes" | "grid" | "dots" | "checker" | "waves"; patternColor?: string; overlayColor?: string; overlayOpacity?: number };

export type StorefrontTemplate = {
  id: string; name: string; photoLayout?: "quartet";
  backgroundDesign?: SectionDesign; sectionDesigns?: Record<string,SectionDesign>;
  specimenParts?: [string,string,string];
  headingTreatment?: "plain" | "mixed-script" | "sandwich"; accentHeadingFamily?: string;
  subheadingFamily?: string; subheadingStyle?: "normal" | "italic"; illustration?: "ribbon" | "botanical" | "cake" | "balloons" | "bouquet" | "sparkle" | "citrus";
  source: { url: string; title: string; number: number; notes: string };
  headingFamily?: string; bodyFamily?: string; headingWeight?: number; headingSize?: number; sample?: string;
  headingCase?: "lowercase" | "uppercase"; headingFontStyle?: "italic" | "normal";
  button?: "pill" | "block" | "outline" | "offset" | "ticket";
  frame?: "none" | "scallop" | "double" | "ticket" | "outlined" | "offset" | "checker" | "stripe" | "grid" | "wave";
  description: string; fonts: string; fontStyle: string; imageShape: string;
  composition: "split" | "centered" | "reverse" | "poster" | "masthead" | "collage" | "billboard" | "rail" | "stacked" | "postcard" | "overlay";
  imageMask: "arch" | "soft" | "square" | "portrait" | "circle";
  sections: "cards" | "bands" | "ruled";
  services: "cards" | "rows" | "editorial";
  heroBackground?: string; heroInk?: string;
  colors: { background: string; surface: string; ink: string; muted: string; accent: string; accentInk: string; secondary: string };
};

// One entry for every observed saved reference; no unrelated mood-name variants.
export const STOREFRONT_TEMPLATES = references as StorefrontTemplate[];
