import { describe, expect, it } from "vitest";
import { DEFAULT_STOREFRONT_DESIGN, bookingWithDesign, readStorefrontDesign, storefrontDesignSchema } from "@/lib/storefront-design";
import { STOREFRONT_TEMPLATES } from "@/lib/storefront-template-library";

describe("published storefront design", () => {
 it.each(STOREFRONT_TEMPLATES.map(template => [template.name,template] as const))("round-trips %s without changing its fonts or colors",(_,template)=>{
  const design={...DEFAULT_STOREFRONT_DESIGN,template,depth:"floating" as const};
  const parsed=storefrontDesignSchema.parse(design);
  expect(parsed.template?.colors).toEqual(template.colors);
  expect(parsed.template?.headingFamily).toEqual(template.headingFamily);
  expect(readStorefrontDesign(JSON.parse(JSON.stringify(bookingWithDesign({deposit:"Saved deposit"},parsed))))).toEqual(parsed);
 });
 it("keeps unpublished edits separate from the published design",()=>{
  const published={...DEFAULT_STOREFRONT_DESIGN,template:STOREFRONT_TEMPLATES[0]};
  const draft={...DEFAULT_STOREFRONT_DESIGN,template:STOREFRONT_TEMPLATES[1],depth:"layered" as const};
  const booking=bookingWithDesign({deposit:"Original",leadTime:"Two weeks"},published);
  expect(readStorefrontDesign(booking,{design:draft}).template?.id).toBe(draft.template.id);
  expect(readStorefrontDesign(booking).template?.id).toBe(published.template.id);
  expect(booking).toMatchObject({deposit:"Original"});
 });
 it("rejects unsafe CSS, unknown fonts, and unrecognized sections",()=>{
  const template=STOREFRONT_TEMPLATES[0];
  expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,edge:"url(https://external.test)"}).success).toBe(false);
  expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,template:{...template,headingFamily:"unknown"}}).success).toBe(false);
  expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,template:{...template,sectionDesigns:{"__other":{background:"#ffffff",ink:"#000000",pattern:"solid"}}}}).success).toBe(false);
 });
 it("leaves existing businesses unchanged when no design is saved",()=>{
  expect(readStorefrontDesign({deposit:"Existing text"})).toEqual(DEFAULT_STOREFRONT_DESIGN);
 });
});
