import {z} from "zod";
import type {ServicePricing} from "./service-pricing";
const amount=z.number().int().min(0).max(100000000).nullable();
export const serviceDraftSchema=z.object({
 name:z.string().max(120),description:z.string().max(2000),inclusions:z.string().max(2000),
 pricingType:z.enum(["fixed","hour","person","item","package","custom"]),rateCents:amount,
 minimum:z.number().positive().max(100000).nullable(),itemLabel:z.string().max(100),
 packages:z.array(z.object({name:z.string().max(120),priceCents:amount,inclusions:z.string().max(2000),coverage:z.string().max(500)}).strict()).max(12),
 addons:z.array(z.object({name:z.string().max(120),description:z.string().max(500),priceCents:amount} ).strict()).max(20),
 menus:z.array(z.object({name:z.string().max(120),options:z.array(z.string().max(200)).max(50),selection:z.enum(["display","single","multiple"]),maxChoices:z.number().int().min(1).max(50).nullable()}).strict()).max(12).optional(),
 questions:z.array(z.string().max(300)).max(8)
}).strict();
export type ServiceDraft=z.infer<typeof serviceDraftSchema>;
// Missing amounts stay undefined so existing form validation requires entry before saving.
export function serviceDraftToForm(draft:ServiceDraft):ServicePricing{
 const id=()=>crypto.randomUUID();
 const base=draft.pricingType==="package"?{type:"package",packages:draft.packages.map(pkg=>({id:id(),name:pkg.name,price:pkg.priceCents??undefined,inclusions:pkg.inclusions,coverage:pkg.coverage}))}:draft.pricingType==="custom"?{type:"custom",questions:["Describe your event and requirements."]}:draft.pricingType==="fixed"?{type:"fixed",rate:draft.rateCents??undefined}:{type:draft.pricingType,rate:draft.rateCents??undefined,minimum:draft.minimum??undefined,...(draft.pricingType==="hour"?{increment:1}:draft.pricingType==="item"?{increment:1,label:draft.itemLabel}:{})};
 return {version:1,id:id(),name:draft.name,description:draft.description,inclusions:draft.inclusions,base,extras:draft.addons.map(extra=>({id:id(),name:extra.name,description:extra.description,type:extra.priceCents===null?"quoted":"flat",...(extra.priceCents===null?{}:{rate:extra.priceCents}),minimum:1,increment:1,separateHours:false,locationRequired:false})),menus:(draft.menus??[]).map(menu=>({id:id(),name:menu.name,options:menu.options,selection:menu.selection,required:false,...(menu.selection==="multiple"&&menu.maxChoices!==null&&menu.options.length?{maxChoices:Math.min(menu.maxChoices,menu.options.length)}:{})}))} as ServicePricing;
}
