import {db} from "@/lib/db";
import {readRequestPricing} from "@/lib/structured-quote";
import {waiverApplies,waiverQuoteHash} from "@/lib/waiver-policy";
export async function buyerQuoteWaivers(quoteId:string,buyerId:string){
 const quote=await db.quote.findUnique({where:{id:quoteId},include:{quoteRequest:true}});
 if(!quote||quote.quoteRequest.buyerId!==buyerId)throw new Error("Quote not found.");
 const offeringId=quote.quoteRequest.offeringId;
 const selected=readRequestPricing(quote.quoteRequest.pricingSnapshot)?.selection.packageId;
 const assignments=offeringId?await db.waiverAssignment.findMany({where:{offeringId,waiver:{vendorId:quote.quoteRequest.vendorId,archived:false}},include:{waiver:{select:{id:true,title:true,sha256:true}}}}):[];
 const required=[...new Map(assignments.filter(row=>waiverApplies(row.packageId,selected)).map(row=>[row.waiver.id,row.waiver])).values()];
 const quoteHash=waiverQuoteHash(quote);
 const signatures=await db.waiverSignature.findMany({where:{quoteId,buyerId,quoteHash},select:{waiverId:true,documentHash:true}});
 return {quote,quoteHash,required,pending:required.filter(doc=>!signatures.some(signature=>signature.waiverId===doc.id&&signature.documentHash===doc.sha256))};
}
