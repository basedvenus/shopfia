"use server";
import {readStructuredPricing} from "@/lib/service-pricing";
import {serviceTemplates} from "@/lib/service-templates";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {servicePresetInput,type SavedServicePreset} from "@/lib/service-presets";
async function authorize(businessId:string){
 const session=await auth();
 if(!session?.user?.id)throw new Error("Sign in to use saved options and add-ons.");
 const business=await db.vendorProfile.findFirst({where:{id:businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}});
 if(!business)throw new Error("You do not have access to this business’s saved items.");
}
export async function loadServicePresets(businessId:string):Promise<SavedServicePreset[]>{
 await authorize(businessId);
 const rows=await db.servicePreset.findMany({where:{businessId},orderBy:{createdAt:"desc"},take:100});
 return rows.flatMap(row=>{const parsed=servicePresetInput.safeParse({kind:row.kind,payload:row.payload});return parsed.success?[{...parsed.data,id:row.id,name:row.name}]:[];});
}
export async function saveServicePreset(businessId:string,input:unknown):Promise<SavedServicePreset>{
 await authorize(businessId);
 const parsed=servicePresetInput.safeParse(input);
 if(!parsed.success)throw new Error("Complete the section or add-on before saving it for reuse. Include a title, choices, and any required price details.");
 const {kind,payload}=parsed.data;
 const row=await db.servicePreset.create({data:{businessId,kind,name:payload.name,payload}});
 return {...parsed.data,id:row.id,name:row.name};
}
export async function removeServicePreset(businessId:string,id:string){
 await authorize(businessId);
 await db.servicePreset.deleteMany({where:{id,businessId}});
}

export async function loadPastServices(businessId:string){
 await authorize(businessId);
 const rows=await db.offering.findMany({where:{vendorId:businessId},select:{id:true,title:true,description:true,faqJson:true,basePriceCents:true},orderBy:{updatedAt:"desc"},take:100});
 return rows.map(row=>({id:row.id,title:row.title,description:row.description,pricing:readStructuredPricing((row.faqJson as Record<string,unknown>|null)?.pricing) ?? {...serviceTemplates.blank,id:row.id,name:row.title,description:row.description,base:row.basePriceCents===null?{type:"custom" as const,questions:[""]}:{type:"fixed" as const,rate:row.basePriceCents}}}));
}
