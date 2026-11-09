import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {buyerQuoteWaivers} from "@/lib/services/waivers";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{waiverId:string}>}){
 const session=await auth();if(!session?.user?.id)return new Response("Sign in to view this document.",{status:401});
 const {waiverId}=await params,doc=await db.businessWaiver.findUnique({where:{id:waiverId}});if(!doc)return new Response("Not found",{status:404});
 let allowed=Boolean(await db.vendorProfile.findFirst({where:{id:doc.vendorId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}}));
 if(!allowed)allowed=Boolean(await db.waiverSignature.findFirst({where:{waiverId,buyerId:session.user.id},select:{id:true}}));
 const quoteId=new URL(request.url).searchParams.get("quoteId");
 if(!allowed&&quoteId){try{allowed=(await buyerQuoteWaivers(quoteId,session.user.id)).required.some(row=>row.id===waiverId);}catch{}}
 if(!allowed)return new Response("Not found",{status:404});
 return new NextResponse(new Uint8Array(doc.data),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
}
