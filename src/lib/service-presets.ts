import {z} from "zod";
import {menuSchema,extraSchema} from "./service-pricing";
export const servicePresetInput = z.discriminatedUnion("kind", [
 z.object({kind:z.literal("options"),payload:menuSchema}),
 z.object({kind:z.literal("addon"),payload:extraSchema})
]);
export type ServicePresetInput = z.infer<typeof servicePresetInput>;
export type SavedServicePreset = ServicePresetInput & {id:string;name:string};
export function copyServicePreset(preset:ServicePresetInput):ServicePresetInput {
 return {...preset,payload:{...structuredClone(preset.payload),id:crypto.randomUUID()}} as ServicePresetInput;
}
