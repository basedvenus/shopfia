import {assertSameOrigin} from "@/lib/security/request";
import {NextResponse} from "next/server";
import {z} from "zod";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {buyerQuoteWaivers} from "@/lib/services/waivers";
import {WAIVER_CONSENT} from "@/lib/waiver-policy";
import {canPrepareQuoteCheckout} from "@/lib/services/quote-checkout";
import {enforceRequestRateLimit} from "@/lib/security/request";
const schema=z.object({waiverId:z.string().cuid(),quoteHash:z.string().length(64),signerName:z.string().trim().min(2).max(120),consent:z.literal(true)});
export async function POST(request:Request,{params}:{params:Promise<{quoteId:string}>}){
 if(!assertSameOrigin(request))return new Response("Invalid origin.",{status:403});
 const limited=enforceRequestRateLimit(request,[{key:"waiver-sign:ip:{ip}",limit:15,intervalMs:60000}]);if(limited)return limited;
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:"Sign in to sign this waiver."},{status:401});
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Enter your full name and agree to sign electronically."},{status:400});
 try{
  const {quoteId}=await params,{quote,quoteHash,required}=await buyerQuoteWaivers(quoteId,session.user.id),doc=required.find(doc=>doc.id===parsed.data.waiverId);
  if(!doc||quoteHash!==parsed.data.quoteHash||!canPrepareQuoteCheckout(quote))throw new Error("This waiver or quote changed. Refresh before signing.");
  await db.waiverSignature.upsert({where:{waiverId_quoteId_buyerId_quoteHash:{waiverId:doc.id,quoteId,buyerId:session.user.id,quoteHash}},update:{},create:{waiverId:doc.id,quoteId,buyerId:session.user.id,quoteHash,documentHash:doc.sha256,signerName:parsed.data.signerName,consentText:WAIVER_CONSENT,userAgent:(request.headers.get("user-agent")??"").slice(0,1000)}});
  return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof Error&&(error.message==="Quote not found."||error.message.startsWith("This waiver or quote changed"))?error.message:"Could not sign this waiver. Please try again."},{status:400});}
}
