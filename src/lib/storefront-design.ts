import { z } from "zod";
import { STOREFRONT_TEMPLATES, type StorefrontTemplate } from "./storefront-template-library";
import { APPROVED_STOREFRONT_SECTIONS, STOREFRONT_FONT_STYLES, getStorefrontFontFamilies } from "./businesses";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const families = new Set(STOREFRONT_TEMPLATES.flatMap(t => [t.headingFamily, t.bodyFamily, t.subheadingFamily, t.accentHeadingFamily]).concat(STOREFRONT_FONT_STYLES.flatMap(t => Object.values(getStorefrontFontFamilies(t.value)))).filter(Boolean));
const family = z.string().max(250).refine(value => families.has(value), "Choose a font from the library.");
const section = z.object({ background: color, ink: color, pattern: z.enum(["solid","clouds","stripes","grid","dots","checker","waves"]), patternColor: color.optional(), overlayColor: color.optional(), overlayOpacity: z.number().min(0).max(.8).optional() });
const template = z.object({
  id: z.string().refine(id => STOREFRONT_TEMPLATES.some(t => t.id === id)),
  colors: z.object({ background:color, surface:color, ink:color, muted:color, accent:color, accentInk:color, secondary:color }),
  headingFamily: family.optional(), bodyFamily: family.optional(), subheadingFamily: family.optional(),
  subheadingStyle: z.enum(["normal","italic"]).optional(), headingWeight: z.number().int().min(100).max(900).optional(),
  fontStyle: z.enum(["MODERN","EDITORIAL","ROMANTIC","BOLD","FASHION","PLAYFUL","RETRO","COOL"]),
  backgroundDesign: section.optional(), sectionDesigns: z.record(section).refine(value => Object.keys(value).every(key => (APPROVED_STOREFRONT_SECTIONS as readonly string[]).includes(key))).optional(),
  illustration: z.enum(["ribbon","botanical","cake","balloons","bouquet","sparkle","citrus"]).nullish()
}).transform(patch => ({ ...STOREFRONT_TEMPLATES.find(t => t.id === patch.id)!, ...patch, illustration: patch.illustration ?? undefined, headingFamily:patch.headingFamily, bodyFamily:patch.bodyFamily } as StorefrontTemplate));
export const storefrontDesignSchema = z.object({
  version: z.literal(1), template: template.nullable(), depth: z.enum(["flat","floating","layered"]),
  mount: z.enum(["round","square","artwork"]), edge:color, background:color,
  headingFamily:family.optional(), subheadingFamily:family.optional(),
  socialVisibility:z.object({instagram:z.boolean(),tiktok:z.boolean()}).optional(),
  aboutPhotos:z.array(z.string().max(2048).refine(v=>v==="" || /^https?:\/\//.test(v) || v.startsWith("/"))).max(12).optional(),
  aboutPhotoLayout:z.enum(["grid","row","layered","offset","cascade","six","banner","scallop"]).optional(),
  effectImage:z.string().max(2048).refine(v=>v==="" || /^https?:\/\//.test(v) || v.startsWith("/")).optional(),
  effectPresentation:z.enum(["emblem","product","spin"]).optional(),effectWord:z.string().max(24).optional()
});
export type StorefrontDesign = z.infer<typeof storefrontDesignSchema>;
export const DEFAULT_STOREFRONT_DESIGN: StorefrontDesign = { version:1, template:null, depth:"flat", mount:"round", edge:"#877a78", background:"#e6dfd4" };
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
// A versioned namespace in the existing storefront settings JSON keeps this release
// backward compatible: old readers still use deposit, leadTime and process normally.
export function readStorefrontDesign(booking: unknown, draft?: unknown): StorefrontDesign {
  const draftValue=record(draft);
  const raw=Object.prototype.hasOwnProperty.call(draftValue,"design") ? draftValue.design : record(booking)._design;
  const result=storefrontDesignSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_STOREFRONT_DESIGN;
}
export function hasStorefrontDesign(booking: unknown): boolean { return storefrontDesignSchema.safeParse(record(booking)._design).success; }
export function bookingWithDesign(booking: unknown, design: StorefrontDesign) { return { ...record(booking), _design:design }; }
export const storefrontDesignJsonSchema = z.string().max(30000).transform((value,context) => {
  try { return storefrontDesignSchema.parse(JSON.parse(value)); }
  catch { context.addIssue({code:z.ZodIssueCode.custom,message:"Choose a valid storefront design."}); return z.NEVER; }
});
