import {assertSameOrigin} from "@/lib/security/request";
import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {z} from "zod";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {readStructuredPricing} from "@/lib/service-pricing";
import {enforceRequestRateLimit} from "@/lib/security/request";
export const runtime="nodejs";
async function businessAccess(businessId:string){const session=await auth();if(!session?.user?.id)return null;const business=await db.vendorProfile.findFirst({where:{id:businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}});return business?session:null;}
export async function GET(request:Request,{params}:{params:Promise<{businessId:string}>}){
 const {businessId}=await params;if(!await businessAccess(businessId))return NextResponse.json({error:"Business not found."},{status:404});
 const [documents,services]=await Promise.all([
  db.businessWaiver.findMany({where:{vendorId:businessId},select:{id:true,title:true,fileName:true,archived:true,createdAt:true,assignments:{select:{offeringId:true,packageId:true}},signatures:{select:{id:true,signerName:true,signedAt:true,quoteId:true}}},orderBy:{createdAt:"desc"}}),
  db.offering.findMany({where:{vendorId:businessId},select:{id:true,title:true,faqJson:true}})
 ]);
 return NextResponse.json({documents,services:services.map(service=>{const pricing=readStructuredPricing((service.faqJson as {pricing?:unknown}|null)?.pricing);return {id:service.id,title:service.title,packages:pricing?.base.type==="package"?pricing.base.packages.map(p=>({id:p.id,name:p.name})):[]};})});
}
const assignmentSchema=z.object({waiverId:z.string().cuid(),assignments:z.array(z.object({offeringId:z.string().cuid(),packageId:z.string().max(120)})).max(500),archived:z.boolean().optional()});
export async function POST(request:Request,{params}:{params:Promise<{businessId:string}>}){
 if(!assertSameOrigin(request))return new Response("Invalid origin.",{status:403});
 const limited=enforceRequestRateLimit(request,[{key:"business-waivers:ip:{ip}",limit:20,intervalMs:60000}]);if(limited)return limited;
 const {businessId}=await params,session=await businessAccess(businessId);if(!session)return NextResponse.json({error:"Business not found."},{status:404});
 try{
 if(request.headers.get("content-type")?.includes("multipart/form-data")){
  const form=await request.formData(),file=form.get("file"),title=String(form.get("title")??"").trim();
  if(!(file instanceof File)||file.type!=="application/pdf"||file.size>4*1024*1024||file.size<5||title.length<2||title.length>120)return NextResponse.json({error:"Add a title and choose a PDF under 4 MB."},{status:400});
  const data=Buffer.from(await file.arrayBuffer());if(data.subarray(0,5).toString()!=="%PDF-")return NextResponse.json({error:"Choose a valid PDF file."},{status:400});
  const doc=await db.businessWaiver.create({data:{vendorId:businessId,title,fileName:file.name.slice(0,200),data,sha256:createHash("sha256").update(data).digest("hex"),uploadedById:session.user.id}});
  return NextResponse.json({ok:true,id:doc.id});
 }
 const parsed=assignmentSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Check the waiver assignments."},{status:400});
 const input=parsed.data,doc=await db.businessWaiver.findFirst({where:{id:input.waiverId,vendorId:businessId},select:{id:true}});if(!doc)return NextResponse.json({error:"Waiver not found."},{status:404});
 const services=await db.offering.findMany({where:{vendorId:businessId,id:{in:input.assignments.map(row=>row.offeringId)}},select:{id:true,faqJson:true}});
 for(const row of input.assignments){const service=services.find(s=>s.id===row.offeringId),pricing=readStructuredPricing((service?.faqJson as {pricing?:unknown}|null)?.pricing);if(!service||(row.packageId&&!(pricing?.base.type==="package"&&pricing.base.packages.some(p=>p.id===row.packageId))))return NextResponse.json({error:"Choose a service or package belonging to this business."},{status:400});}
 const assignments=[...new Map(input.assignments.map(row=>[JSON.stringify(row),row])).values()];
 await db.$transaction(async tx=>{await tx.businessWaiver.update({where:{id:doc.id},data:{archived:input.archived??false}});await tx.waiverAssignment.deleteMany({where:{waiverId:doc.id}});if(assignments.length)await tx.waiverAssignment.createMany({data:assignments.map(row=>({...row,waiverId:doc.id}))});});
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Waivers could not be saved. Please try again."},{status:400});}
}
