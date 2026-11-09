import {describe,it,expect} from "vitest";
import {serviceDraftSchema,serviceDraftToForm} from "@/lib/service-ai-draft";
import {servicePricingSchema} from "@/lib/service-pricing";
const draft={name:"Pole rental",description:"Portable pole rental for your party.",inclusions:"Portable pole",pricingType:"package" as const,rateCents:null,minimum:null,itemLabel:"",packages:[{name:"Four-hour rental",priceCents:10000,inclusions:"Portable pole",coverage:"4 hours"},{name:"Daily rental",priceCents:null,inclusions:"Portable pole",coverage:"1 day"}],addons:[],questions:["What is the daily price?"]};
describe("AI service drafts",()=>{
 it("preserves supplied money without treating missing prices as free",()=>{const form=serviceDraftToForm(draft);expect(form.base.type).toBe("package");if(form.base.type!=="package")throw Error();expect(form.base.packages[0].price).toBe(10000);expect(form.base.packages[1].price).toBeUndefined();expect(servicePricingSchema.safeParse(form).success).toBe(false);});
 it("rejects extra permissions and website fields",()=>{expect(serviceDraftSchema.safeParse({...draft,code:"delete users",publish:true}).success).toBe(false);});
 it("creates independent identifiers each time",()=>{const a=serviceDraftToForm(draft),b=serviceDraftToForm(draft);expect(a.id).not.toBe(b.id);if(a.base.type==="package"&&b.base.type==="package")expect(a.base.packages[0].id).not.toBe(b.base.packages[0].id);});
 it("rejects negative and oversized output",()=>{expect(serviceDraftSchema.safeParse({...draft,rateCents:-100}).success).toBe(false);expect(serviceDraftSchema.safeParse({...draft,description:"x".repeat(2001)}).success).toBe(false);});
});
