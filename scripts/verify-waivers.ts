import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {buyerQuoteWaivers} from '../src/lib/services/waivers';
import {serviceTemplates} from '../src/lib/service-templates';
import {initialSelection} from '../src/lib/service-pricing';
async function main(){
 assert.equal(process.env.WAIVER_VALIDATION_BRANCH,"br-raspy-sea-aicqt5ju","Use the isolated waiver validation branch only.");
 const business=await db.vendorProfile.findFirst({where:{slug:'moonmatcha'},select:{id:true,categories:{select:{categoryId:true}}}});assert(business);
 const buyer=await db.user.create({data:{email:`waiver-test-${Date.now()}@example.invalid`,name:'TEST ONLY - NO LEGAL EFFECT',role:'BUYER'}});
 const pricing={...serviceTemplates.blank,name:'TEST ONLY SERVICE',description:'TEST ONLY - NO LEGAL EFFECT',inclusions:'Testing only',base:{type:'package' as const,packages:[{id:'test-a',name:'A',price:10000,inclusions:'Test only',coverage:'1'},{id:'test-b',name:'B',price:15000,inclusions:'Test only',coverage:'1'}]}};
 const offering=await db.offering.create({data:{vendorId:business.id,type:'SERVICE',title:'TEST ONLY - NO LEGAL EFFECT',slug:`waiver-test-${Date.now()}`,description:'Test fixture',categoryId:business.categories[0].categoryId,tags:[],photos:[],active:false,faqJson:{pricing}}});
 const request=await db.quoteRequest.create({data:{buyerId:buyer.id,vendorId:business.id,offeringId:offering.id,eventLocation:'Test only',attachments:[],pricingSnapshot:{version:1,service:pricing,selection:initialSelection(pricing),lines:[],promotions:[]}}});
 const quote=await db.quote.create({data:{quoteRequestId:request.id,amountCents:10000,expiresAt:new Date(Date.now()+86400000),status:'SENT'}});
 const documents=await Promise.all(['all','test-a','test-b'].map((pkg)=>db.businessWaiver.create({data:{vendorId:business.id,title:'TEST DOCUMENT ONLY - NO LEGAL EFFECT',fileName:'test.pdf',data:Buffer.from('%PDF-1.4\nTEST ONLY'),sha256:'test-'+pkg,uploadedById:buyer.id,assignments:{create:{offeringId:offering.id,packageId:pkg==='all'?'':pkg}}}})));
 try{
  let info=await buyerQuoteWaivers(quote.id,buyer.id);assert.equal(info.required.length,2);assert.equal(info.pending.length,2);
  for(const doc of info.required)await db.waiverSignature.create({data:{waiverId:doc.id,quoteId:quote.id,buyerId:buyer.id,signerName:'AUTOMATED TEST - NO LEGAL EFFECT',consentText:'TEST RECORD ONLY',documentHash:doc.sha256,quoteHash:info.quoteHash,userAgent:'Integration test'}});
  assert.equal((await buyerQuoteWaivers(quote.id,buyer.id)).pending.length,0);
  await db.quote.update({where:{id:quote.id},data:{amountCents:11000}});
  assert.equal((await buyerQuoteWaivers(quote.id,buyer.id)).pending.length,2);
  await assert.rejects(()=>buyerQuoteWaivers(quote.id,'someone-else'));
  console.log('PASS: service/package matching, unsigned gate, signed gate, revised quote re-signing, buyer authorization');
 }finally{
  await db.waiverSignature.deleteMany({where:{buyerId:buyer.id}});await db.waiverAssignment.deleteMany({where:{offeringId:offering.id}});await db.businessWaiver.deleteMany({where:{id:{in:documents.map(d=>d.id)}}});await db.quote.delete({where:{id:quote.id}});await db.quoteRequest.delete({where:{id:request.id}});await db.offering.delete({where:{id:offering.id}});await db.user.delete({where:{id:buyer.id}});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
