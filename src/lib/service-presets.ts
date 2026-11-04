import {z} from "zod";
import {menuSchema,extraSchema,type ServicePricing} from "./service-pricing";
export const servicePresetInput = z.discriminatedUnion("kind", [
 z.object({kind:z.literal("options"),payload:menuSchema}),
 z.object({kind:z.literal("addon"),payload:extraSchema})
]);
export type ServicePresetInput = z.infer<typeof servicePresetInput>;
export type SavedServicePreset = ServicePresetInput & {id:string;name:string};
export function copyServicePreset(preset:ServicePresetInput):ServicePresetInput {
 return {...preset,payload:{...structuredClone(preset.payload),id:crypto.randomUUID()}} as ServicePresetInput;
}

/** The latest saved version of each chosen title is reusable; services keep copies. */
export function servicePresetEntries(service:ServicePricing):ServicePresetInput[]{
 const entries:ServicePresetInput[]=[...(service.menus??[]).map(payload=>({kind:"options" as const,payload})),...service.extras.map(payload=>({kind:"addon" as const,payload}))];
 return [...new Map(entries.map(item=>{const parsed=servicePresetInput.parse(item);return [`${parsed.kind}:${parsed.payload.name}`,parsed] as const;})).values()];
}
export function savePreviewServicePresets(service:ServicePricing){
 const key="shopfia-service-presets-preview:demo";
 const raw=JSON.parse(localStorage.getItem(key)??"[]") as SavedServicePreset[];
 const current=Array.isArray(raw)?raw.filter(item=>servicePresetInput.safeParse(item).success):[];
 const map=new Map(current.map(item=>[`${item.kind}:${item.name}`,item]));
 for(const item of servicePresetEntries(service)){
  const key=`${item.kind}:${item.payload.name}`;
  map.set(key,{...item,id:map.get(key)?.id??crypto.randomUUID(),name:item.payload.name});
 }
 localStorage.setItem(key,JSON.stringify([...map.values()]));
 window.dispatchEvent(new Event("shopfia-presets-updated"));
}
