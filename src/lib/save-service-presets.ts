import type {Prisma} from "@prisma/client";
import type {ServicePricing} from "./service-pricing";
import {servicePresetEntries} from "./service-presets";
/** Called inside the service transaction, after business authorization. */
export async function saveServicePresetsForService(tx:Pick<Prisma.TransactionClient,"servicePreset">,businessId:string,service:ServicePricing){
 for(const item of servicePresetEntries(service)){
  const {kind,payload}=item;
  const name=payload.name;
  await tx.servicePreset.upsert({where:{businessId_kind_name:{businessId,kind,name}},create:{businessId,kind,name,payload},update:{payload}});
 }
}
